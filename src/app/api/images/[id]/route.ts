import fs from 'node:fs';
import { NextResponse } from 'next/server';
import { getGeneratedImage } from '@/lib/images/storage';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const image = getGeneratedImage(id);
  if (!image) {
    return NextResponse.json({ error: 'Generated image not found.' }, { status: 404 });
  }

  const bytes = fs.readFileSync(image.path);
  const download = new URL(request.url).searchParams.get('download') === '1';
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': image.mimeType,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${image.id}"`,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
