import type { ChatBackend, NormalizedChatRequest, NormalizedModel } from '@/lib/types';
import { parseSSE } from '@/lib/stream-parser';
import { getReasoningRequestParams } from '@/lib/model-variants';

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
    });

    if (!response.ok) {
      let text = await response.text().catch(() => 'Unknown error');
      if (text.trim().startsWith('<')) {
        text = 'HTML error response received (possibly a proxy or Cloudflare block).';
      }
      throw new Error(`Backend error ${response.status}: ${text}`);
    }

    if (!response.body) {
      throw new Error('Backend returned an empty response body.');
    }

    return response.body.pipeThrough(parseSSE());
  }

  async listModels(): Promise<NormalizedModel[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      let text = await response.text().catch(() => 'Unknown error');
      if (text.trim().startsWith('<')) {
        text = 'HTML error response received (possibly a proxy or Cloudflare block).';
      }
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
}
