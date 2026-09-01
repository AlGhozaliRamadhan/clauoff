export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { downloadPluginFromUrl } from '@/lib/plugins/downloader';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.url) {
      return NextResponse.json({ error: 'Repository URL is required.' }, { status: 400 });
    }

    const plugin = await downloadPluginFromUrl(body.url, body.name);
    return NextResponse.json({
      success: true,
      plugin,
      message: `Plugin "${plugin.name}" downloaded and installed successfully!`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to download plugin' },
      { status: 500 }
    );
  }
}
