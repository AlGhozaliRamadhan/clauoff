import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type {
  ChatBackend,
  NormalizedChatRequest,
  NormalizedImageRequest,
  NormalizedImageResult,
  NormalizedModel,
} from '@/lib/types';
import { parseSSE } from '@/lib/stream-parser';
import { getReasoningRequestParams } from '@/lib/model-variants';
import { decodeBase64Image, readBoundedImageResponse } from '@/lib/images/codec';
import { fetchWithRetry, friendlyFetchError } from '@/lib/fetch-retry';

const MAX_IMAGE_JSON_CHARS = 36 * 1024 * 1024;
const IMAGE_POLL_INTERVAL_MS = 1_500;
const IMAGE_POLL_TIMEOUT_MS = 5 * 60 * 1_000;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function backendErrorText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('<')) {
    return 'HTML error response received (possibly a proxy or Cloudflare block).';
  }
  return trimmed.slice(0, 2_000) || 'Unknown error';
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '');
  if (normalized === '::1' || normalized === '::' || normalized === '0.0.0.0') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }
  if (isIP(normalized) !== 4) return false;

  const parts = normalized.split('.').map(Number);
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function assertSafeImageUrl(url: URL, trustedOrigin: string): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Image backend returned an unsupported download URL.');
  }
  if (url.origin === trustedOrigin) return;
  if (url.protocol !== 'https:') {
    throw new Error('Cross-origin image downloads must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('Image download URLs cannot contain credentials.');
  }
  if (url.port && url.port !== '443') {
    throw new Error('Cross-origin image downloads must use the standard HTTPS port.');
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Image download URL resolves to a private or reserved address.');
  }
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    }, { once: true });
  });
}

/**
 * OpenAI-compatible backend client.
 * Speaks the standard OpenAI chat-completions wire protocol against any
 * compatible endpoint (LM Studio, Ollama's /v1, Cloudflare-tunneled APIs,
 * vLLM, DeepSeek, etc.).
 */
export class OpenAiClient implements ChatBackend {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    // Strip trailing slash for consistent URL construction
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'HTTP-Referer': `http://localhost:${process.env.PORT || '2648'}`, // Required by some OpenAI-compatible proxies
      'X-Title': 'Cogito AI',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async streamChat(request: NormalizedChatRequest): Promise<ReadableStream<string>> {
    const reasoningParams = getReasoningRequestParams(
      request.model,
      request.reasoning_effort === 'high' ? 'High' : request.reasoning_effort === 'low' ? 'Low' : 'Medium',
      request.reasoning_effort !== undefined,
    );

    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      stream: true,
      max_tokens: request.max_tokens || 8192,
      options: {
        num_ctx: 32768,
      },
      ...(request.reasoning_effort && { reasoning_effort: request.reasoning_effort }),
      ...(request.frequency_penalty !== undefined && { frequency_penalty: request.frequency_penalty }),
      // Some backends (cogito.py / llama.cpp) only honor repeat_penalty.
      // Send both so either implementation applies anti-repetition.
      ...(request.repeat_penalty !== undefined && { repeat_penalty: request.repeat_penalty }),
      ...reasoningParams,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const text = backendErrorText(await response.text().catch(() => 'Unknown error'));
      throw new Error(`Backend error ${response.status}: ${text}`);
    }

    if (!response.body) {
      throw new Error('Backend returned an empty response body.');
    }

    return response.body.pipeThrough(parseSSE());
  }

  async listModels(): Promise<NormalizedModel[]> {
    let response: Response;
    try {
      response = await fetchWithRetry(`${this.baseUrl}/models`, {
        headers: this.getHeaders(),
      });
    } catch (error) {
      throw new Error(friendlyFetchError(error, this.baseUrl));
    }

    if (!response.ok) {
      const text = backendErrorText(await response.text().catch(() => 'Unknown error'));
      throw new Error(`Backend error ${response.status}: ${text}`);
    }

    const data = await response.json();

    // OpenAI-compatible backends return { data: [{ id, ... }, ...] }.
    const models: NormalizedModel[] = (data.data ?? [])
      .filter((m: { id?: string }) => typeof m?.id === 'string' && m.id.length > 0)
      .map((m: { id: string }) => ({
        id: m.id,
        label: m.id,
        backend: 'openai' as const,
      }));

    return models;
  }

  async generateImage(request: NormalizedImageRequest): Promise<NormalizedImageResult> {
    const body: Record<string, unknown> = {
      prompt: request.prompt,
      n: 1,
      response_format: 'b64_json',
      ...(request.model && { model: request.model }),
      ...(request.size && { size: request.size }),
      ...(request.quality && { quality: request.quality }),
    };

    // The POST itself is never retried on HTTP error statuses (a 202-style
    // backend may already have queued the job). Only transient network
    // failures get one extra attempt.
    let response: Response;
    try {
      response = await fetchWithRetry(
        `${this.baseUrl}/images/generations`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body),
          signal: request.signal,
        },
        { retries: 1, retryOnStatuses: [] },
      );
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || request.signal?.aborted)) throw error;
      throw new Error(friendlyFetchError(error, this.baseUrl));
    }
    let payload = await this.readImageJson(response);

    if (response.status === 202) {
      const jobId = isRecord(payload) && typeof payload.id === 'string' ? payload.id : '';
      if (!jobId) throw new Error('Image backend accepted the request but returned no job ID.');

      const deadline = Date.now() + IMAGE_POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await abortableDelay(IMAGE_POLL_INTERVAL_MS, request.signal);
        try {
          response = await fetchWithRetry(`${this.baseUrl}/images/${encodeURIComponent(jobId)}`, {
            headers: this.getHeaders(),
            signal: request.signal,
          }, { retries: 2, retryOnStatuses: [502, 503, 504] });
        } catch (error) {
          if (error instanceof Error && (error.name === 'AbortError' || request.signal?.aborted)) throw error;
          // A dropped poll connection shouldn't kill the whole job —
          // the next poll tick gets another 1.5 s window.
          continue;
        }
        try {
          payload = await this.readImageJson(response);
        } catch {
          // Malformed/failed poll body: keep waiting rather than surfacing
          // a misleading "no image data" error mid-job.
          continue;
        }

        const status = isRecord(payload) && typeof payload.status === 'string'
          ? payload.status.toLowerCase()
          : '';
        if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
          const message = isRecord(payload) && typeof payload.error === 'string'
            ? payload.error
            : `Image generation job ${status}.`;
          throw new Error(message);
        }
        if (!['queued', 'pending', 'processing', 'running', 'starting'].includes(status)) break;
      }
      if (Date.now() >= deadline) throw new Error('Image generation timed out after 5 minutes.');
    }

    const item = this.findImageItem(payload);
    if (!item) {
      throw new Error('Image backend returned no image data or download URL.');
    }

    const revisedPrompt = typeof item.revised_prompt === 'string'
      ? item.revised_prompt
      : typeof item.revisedPrompt === 'string'
        ? item.revisedPrompt
        : undefined;
    const encoded = typeof item.b64_json === 'string'
      ? item.b64_json
      : typeof item.base64 === 'string'
        ? item.base64
        : typeof item.image === 'string' && item.image.startsWith('data:image/')
          ? item.image
          : undefined;

    if (encoded) {
      return { ...decodeBase64Image(encoded), revisedPrompt };
    }

    const rawUrl = typeof item.url === 'string'
      ? item.url
      : typeof item.image_url === 'string'
        ? item.image_url
        : undefined;
    if (!rawUrl) throw new Error('Image backend returned an unsupported image payload.');

    const downloaded = await this.downloadImage(rawUrl, request.signal);
    return { ...downloaded, revisedPrompt };
  }

  private async readImageJson(response: Response): Promise<unknown> {
    if (!response.ok) {
      const text = backendErrorText(await response.text().catch(() => 'Unknown error'));
      throw new Error(`Backend error ${response.status}: ${text}`);
    }
    const declaredLength = Number(response.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_JSON_CHARS) {
      throw new Error('Image backend response exceeds the 36 MB limit.');
    }
    const text = await response.text();
    if (text.length > MAX_IMAGE_JSON_CHARS) {
      throw new Error('Image backend response exceeds the 36 MB limit.');
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error('Image backend returned invalid JSON.');
    }
  }

  private findImageItem(payload: unknown): JsonRecord | null {
    if (!isRecord(payload)) return null;
    const directKeys = ['b64_json', 'base64', 'image', 'url', 'image_url'];
    if (directKeys.some((key) => typeof payload[key] === 'string')) return payload;

    for (const key of ['data', 'images', 'output', 'outputs', 'artifacts', 'result']) {
      const value = payload[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = this.findImageItem(item);
          if (found) return found;
        }
      } else {
        const found = this.findImageItem(value);
        if (found) return found;
      }
    }
    return null;
  }

  private async downloadImage(rawUrl: string, signal?: AbortSignal): Promise<NormalizedImageResult> {
    let url = new URL(rawUrl, `${this.baseUrl}/`);
    const trustedOrigin = new URL(this.baseUrl).origin;

    for (let redirect = 0; redirect <= 3; redirect++) {
      await assertSafeImageUrl(url, trustedOrigin);
      const sameOrigin = url.origin === trustedOrigin;
      let response: Response;
      try {
        response = await fetchWithRetry(url, {
          headers: sameOrigin && this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
          redirect: 'manual',
          signal,
        }, { retries: 2, retryOnStatuses: [502, 503, 504] });
      } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || signal?.aborted)) throw error;
        throw new Error(friendlyFetchError(error, url.origin));
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirect === 3) throw new Error('Image download redirected too many times.');
        url = new URL(location, url);
        continue;
      }
      if (!response.ok) {
        const text = backendErrorText(await response.text().catch(() => 'Unknown error'));
        throw new Error(`Image download failed (${response.status}): ${text}`);
      }
      return readBoundedImageResponse(response);
    }

    throw new Error('Image download redirected too many times.');
  }
}
