import type { SupportedImageMimeType } from '@/lib/types';

export const MAX_GENERATED_IMAGE_BYTES = 25 * 1024 * 1024;

const MIME_FROM_DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,/i;

export function detectImageMimeType(bytes: Uint8Array): SupportedImageMimeType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif';
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return null;
}

export function decodeBase64Image(value: string): {
  bytes: Uint8Array;
  mimeType: SupportedImageMimeType;
} {
  const trimmed = value.trim();
  const dataUrlMatch = trimmed.match(MIME_FROM_DATA_URL);
  const encoded = dataUrlMatch ? trimmed.slice(dataUrlMatch[0].length) : trimmed;

  if (!encoded || !/^[A-Za-z0-9+/\s]*={0,2}$/.test(encoded)) {
    throw new Error('Image backend returned invalid base64 data.');
  }
  if (encoded.length > Math.ceil(MAX_GENERATED_IMAGE_BYTES / 3) * 4 + 16) {
    throw new Error('Generated image exceeds the 25 MB limit.');
  }

  const buffer = Buffer.from(encoded.replace(/\s/g, ''), 'base64');
  if (buffer.length === 0 || buffer.length > MAX_GENERATED_IMAGE_BYTES) {
    throw new Error('Generated image is empty or exceeds the 25 MB limit.');
  }

  const bytes = new Uint8Array(buffer);
  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) {
    throw new Error('Image backend returned an unsupported or invalid image format.');
  }
  if (dataUrlMatch && dataUrlMatch[1].toLowerCase() !== mimeType) {
    throw new Error('Generated image MIME type does not match its file signature.');
  }
  return { bytes, mimeType };
}

export async function readBoundedImageResponse(response: Response): Promise<{
  bytes: Uint8Array;
  mimeType: SupportedImageMimeType;
}> {
  const declaredLength = Number(response.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_GENERATED_IMAGE_BYTES) {
    throw new Error('Generated image exceeds the 25 MB limit.');
  }
  if (!response.body) throw new Error('Image download returned an empty body.');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_GENERATED_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error('Generated image exceeds the 25 MB limit.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) {
    throw new Error('Image download returned an unsupported or invalid image format.');
  }
  return { bytes, mimeType };
}
