import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDataRoot } from '@/lib/rag/paths';
import type { SupportedImageMimeType } from '@/lib/types';

const SAFE_IMAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpg|webp|gif|avif)$/i;

const EXTENSIONS: Record<SupportedImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const MIME_TYPES: Record<string, SupportedImageMimeType> = Object.fromEntries(
  Object.entries(EXTENSIONS).map(([mime, extension]) => [extension, mime]),
) as Record<string, SupportedImageMimeType>;

export interface StoredGeneratedImage {
  id: string;
  path: string;
  mimeType: SupportedImageMimeType;
}

export function getGeneratedImagesRoot(): string {
  return path.join(getDataRoot(), 'generated-images');
}

export function saveGeneratedImage(
  bytes: Uint8Array,
  mimeType: SupportedImageMimeType,
): StoredGeneratedImage {
  const root = getGeneratedImagesRoot();
  fs.mkdirSync(root, { recursive: true });
  const id = `${crypto.randomUUID()}.${EXTENSIONS[mimeType]}`;
  const outputPath = path.join(root, id);
  fs.writeFileSync(outputPath, bytes, { flag: 'wx' });
  return { id, path: outputPath, mimeType };
}

export function getGeneratedImage(id: string): StoredGeneratedImage | null {
  if (!SAFE_IMAGE_ID.test(id)) return null;
  const extension = path.extname(id).slice(1).toLowerCase();
  const mimeType = MIME_TYPES[extension];
  if (!mimeType) return null;

  const root = path.resolve(getGeneratedImagesRoot());
  const imagePath = path.resolve(root, id);
  const relative = path.relative(root, imagePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) return null;
  return { id, path: imagePath, mimeType };
}
