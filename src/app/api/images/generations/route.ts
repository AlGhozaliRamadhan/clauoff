import { NextResponse } from 'next/server';
import { getBackend, getDefaultImageModel } from '@/lib/backend-config';
import { saveGeneratedImage } from '@/lib/images/storage';
import type { GeneratedImageInfo } from '@/lib/images/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_PROMPT_LENGTH = 4_000;
const MAX_OPTION_LENGTH = 120;

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_OPTION_LENGTH) {
    throw new Error(`${field} must be between 1 and ${MAX_OPTION_LENGTH} characters.`);
  }
  return trimmed;
}

function parseSize(value: unknown): { value: string; width: number; height: number } {
  const size = value === undefined ? '1024x1024' : optionalString(value, 'size') ?? '1024x1024';
  const match = size?.match(/^(\d{3,4})x(\d{3,4})$/);
  if (!match) throw new Error('size must look like 1024x1024.');
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 256 || width > 2048 || height < 256 || height > 2048) {
    throw new Error('Image width and height must be between 256 and 2048 pixels.');
  }
  return { value: size, width, height };
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Request body must be a JSON object.');
    }
    body = parsed as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON body.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let prompt: string;
  let model: string | undefined;
  let quality: string | undefined;
  let size: ReturnType<typeof parseSize>;
  try {
    if (typeof body.prompt !== 'string') throw new Error('prompt must be a string.');
    prompt = body.prompt.trim();
    if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
      throw new Error(`prompt must be between 1 and ${MAX_PROMPT_LENGTH} characters.`);
    }
    model = optionalString(body.model, 'model') || getDefaultImageModel() || undefined;
    quality = optionalString(body.quality, 'quality');
    size = parseSize(body.size);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid image request.' },
      { status: 400 },
    );
  }

  try {
    const result = await getBackend().generateImage({
      prompt,
      model,
      size: size.value,
      quality,
      signal: request.signal,
    });
    const stored = saveGeneratedImage(result.bytes, result.mimeType);
    const image: GeneratedImageInfo = {
      id: stored.id,
      url: `/api/images/${encodeURIComponent(stored.id)}`,
      mimeType: stored.mimeType,
      prompt,
      revisedPrompt: result.revisedPrompt,
      width: size.width,
      height: size.height,
    };
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Image generation was cancelled.' }, { status: 499 });
    }
    const message = error instanceof Error ? error.message : 'Image generation failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
