export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { testConnector } from '@/lib/connectors/storage';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const result = await testConnector(id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      },
      { status: 500 }
    );
  }
}
