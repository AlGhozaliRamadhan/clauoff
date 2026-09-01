export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { listConnectors, saveConnector } from '@/lib/connectors/storage';
import { MCP_PRESETS } from '@/lib/connectors/catalog';

export async function GET() {
  try {
    const connectors = await listConnectors();
    return NextResponse.json({
      connectors,
      presets: MCP_PRESETS,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list connectors' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: 'Connector name and type are required.' },
        { status: 400 }
      );
    }

    const saved = await saveConnector(body);
    return NextResponse.json({
      success: true,
      connector: saved,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save connector' },
      { status: 500 }
    );
  }
}
