import { getBackend } from '@/lib/backend-config';
import { cleanTitle, generateSmartFallbackTitle } from '@/lib/utils/title-utils';
import type { ChatMessage } from '@/lib/types';

export { cleanTitle, generateSmartFallbackTitle };

/**
 * AI-powered conversation title generator (Server-only).
 * Sends the first turns to the active backend model to produce a concise 3-6 word title.
 */
export async function generateAiTitle(
  messages: Array<{ role: string; content: string }>,
  model?: string
): Promise<string> {
  const userTurns = messages.filter((m) => m.role === 'user' && m.content.trim().length > 0);
  if (userTurns.length === 0) {
    return 'New Chat';
  }

  const firstUserText = userTurns[0].content;
  const assistantTurns = messages.filter((m) => m.role === 'assistant' && m.content.trim().length > 0);
  const firstAssistantText = assistantTurns[0]?.content?.slice(0, 300) || '';

  const promptMessages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a title generator. Respond ONLY with a short, descriptive 3 to 6 word title summarizing the user request. Do not use quotation marks, markdown, trailing punctuation, or prefixes like "Title:".',
    },
    {
      role: 'user',
      content: `User: ${firstUserText.slice(0, 400)}\n${firstAssistantText ? `Assistant: ${firstAssistantText}` : ''}\n\nGenerate title:`,
    },
  ];

  try {
    const backend = getBackend();
    const stream = await backend.streamChat({
      model: model || '',
      messages: promptMessages,
      max_tokens: 32,
    });

    const reader = stream.getReader();
    let titleAccumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      titleAccumulated += value;
      // Stop reading early if title is getting long
      if (titleAccumulated.length > 120) break;
    }

    const cleaned = cleanTitle(titleAccumulated);
    if (cleaned && cleaned !== 'New Chat') {
      return cleaned;
    }
    return generateSmartFallbackTitle(firstUserText);
  } catch {
    // If backend generation fails, gracefully fall back to local heuristic title
    return generateSmartFallbackTitle(firstUserText);
  }
}
