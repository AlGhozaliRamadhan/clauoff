export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getPlugin, togglePlugin, deletePlugin } from '@/lib/plugins/storage';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const plugin = await getPlugin(id);
    if (!plugin) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }
    return NextResponse.json({ plugin });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch plugin' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    if (body.enabled === undefined) {
      return NextResponse.json({ error: 'Field `enabled` is required.' }, { status: 400 });
    }

    const updated = await togglePlugin(id, body.enabled);
    if (!updated) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, plugin: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update plugin' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const ok = await deletePlugin(id);
    if (!ok) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: `Plugin ${id} uninstalled.` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete plugin' },
      { status: 500 }
    );
  }
}
