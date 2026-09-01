export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getConnector, saveConnector, deleteConnector, toggleConnector } from '@/lib/connectors/storage';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const connector = await getConnector(id);
    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }
    return NextResponse.json({ connector });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch connector' },
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

    if (body.enabled !== undefined && Object.keys(body).length === 1) {
      const updated = await toggleConnector(id, body.enabled);
      if (!updated) {
        return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, connector: updated });
    }

    const updated = await saveConnector({ ...body, id });
    return NextResponse.json({ success: true, connector: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update connector' },
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
    const ok = await deleteConnector(id);
    if (!ok) {
      return NextResponse.json({ error: 'Connector not found or cannot be deleted' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: `Connector ${id} deleted.` });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete connector' },
      { status: 500 }
    );
  }
}
