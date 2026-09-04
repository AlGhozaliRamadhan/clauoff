import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64Image, detectImageMimeType } from '@/lib/images/codec';
import { getGeneratedImage, saveGeneratedImage } from '@/lib/images/storage';
import { OpenAiClient } from '@/lib/openai-client';

const ONE_PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZroQAAAAASUVORK5CYII=';

describe('image generation', () => {
  let tempRoot: string;
  const originalDataDir = process.env.DATA_DIR;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cogito-image-test-'));
    process.env.DATA_DIR = tempRoot;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.DATA_DIR = originalDataDir;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('validates a base64 image by its file signature', () => {
    const decoded = decodeBase64Image(`data:image/png;base64,${ONE_PIXEL_PNG}`);
    expect(decoded.mimeType).toBe('image/png');
    expect(detectImageMimeType(decoded.bytes)).toBe('image/png');
  });

  it('rejects base64 that is not a supported image', () => {
    expect(() => decodeBase64Image(Buffer.from('not an image').toString('base64')))
      .toThrow('unsupported or invalid image format');
  });

  it('stores images under an opaque ID and blocks unsafe IDs', () => {
    const decoded = decodeBase64Image(ONE_PIXEL_PNG);
    const stored = saveGeneratedImage(decoded.bytes, decoded.mimeType);

    expect(stored.id).toMatch(/^[0-9a-f-]+\.png$/);
    expect(fs.existsSync(stored.path)).toBe(true);
    expect(getGeneratedImage(stored.id)?.mimeType).toBe('image/png');
    expect(getGeneratedImage('../cogito-config.json')).toBeNull();
  });

  it('uses the OpenAI-compatible image endpoint without exposing the key to the browser', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ b64_json: ONE_PIXEL_PNG, revised_prompt: 'A small red square' }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAiClient('https://example.test/v1/', 'secret-key').generateImage({
      prompt: 'red square',
      model: 'image-model',
      size: '1024x1024',
    });

    expect(result.mimeType).toBe('image/png');
    expect(result.revisedPrompt).toBe('A small red square');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.test/v1/images/generations');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret-key' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      prompt: 'red square',
      model: 'image-model',
      response_format: 'b64_json',
    });
  });
});
