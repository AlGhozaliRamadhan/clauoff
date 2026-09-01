import { NextResponse } from 'next/server';
import { generateAiTitle, generateSmartFallbackTitle } from '@/lib/chat-titling';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: {
    messages?: Array<{ role: string; content: string }>;
    text?: string;
    model?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const text = typeof body?.text === 'string' ? body.text : '';
  const model = typeof body?.model === 'string' ? body.model : undefined;

  if (messages.length === 0 && !text.trim()) {
    return NextResponse.json({ title: 'New Chat' });
  }

  if (messages.length > 0) {
    try {
      const title = await generateAiTitle(messages, model);
      return NextResponse.json({ title });
    } catch {
      const firstUser = messages.find((m) => m.role === 'user')?.content || text;
      return NextResponse.json({ title: generateSmartFallbackTitle(firstUser) });
    }
  }

  const title = generateSmartFallbackTitle(text);
  return NextResponse.json({ title });
}
