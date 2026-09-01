export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { listPlugins, installCuratedPlugin } from '@/lib/plugins/storage';
import { CURATED_PLUGINS } from '@/lib/plugins/catalog';

export async function GET() {
  try {
    const plugins = await listPlugins();
    return NextResponse.json({
      plugins,
      curated: CURATED_PLUGINS,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list plugins' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Plugin ID is required.' }, { status: 400 });
    }

    const plugin = await installCuratedPlugin(body.id);
    return NextResponse.json({
      success: true,
      plugin,
      message: `Plugin "${plugin.name}" installed successfully.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to install plugin' },
      { status: 500 }
    );
  }
}
