/**
 * Client-safe string utilities for cleaning and generating fallback chat titles.
 * Pure TypeScript functions with no Node.js / server dependencies.
 */

/**
 * Strips formatting, markdown, quotes, and punctuation artifacts from a generated title.
 */
export function cleanTitle(raw: string): string {
  if (!raw) return 'New Chat';

  let title = raw.trim();

  // Remove thinking blocks and XML content
  title = title.replace(/<\s*(?:\|)?(?:thought|think|thinking|confidence)\b[^>]*>[\s\S]*?<\/\s*(?:\|)?(?:thought|think|thinking|confidence)\b[^>]*>/gi, '');
  title = title.replace(/```[\s\S]*?```/g, '');
  title = title.replace(/`([^`]+)`/g, '$1');

  // Strip remaining XML/HTML tags iteratively until convergence to prevent nested tag bypasses
  let prevTitle = "";
  do {
    prevTitle = title;
    title = title.replace(/<[^>]*>/g, "");
  } while (title !== prevTitle);
  title = title.replace(/[<>]/g, "");

  // Strip leading prefixes like "Title:", "Topic:", "Subject:", etc.
  title = title.replace(/^(?:title|topic|subject|conversation title)\s*:\s*/i, '');

  // Strip surrounding quotes
  title = title.replace(/^["'“”«»]+|["'“”«»]+$/g, '');

  // Strip trailing punctuation like . , : ; ! ?
  title = title.replace(/[.,:;!?]+$/, '');

  // Collapse multiple whitespace/newlines into a single space
  title = title.replace(/\s+/g, ' ').trim();

  if (!title) return 'New Chat';

  // Cap at 45 characters on word boundary if possible
  if (title.length > 45) {
    const cut = title.slice(0, 45);
    const lastSpace = cut.lastIndexOf(' ');
    title = (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + '…';
  }

  return title;
}

/**
 * Fast local heuristic title generator for instant preview when user sends first message.
 * Cleans user prompt by removing conversational fluff, commands, and formatting.
 */
export function generateSmartFallbackTitle(firstUserMessage: string): string {
  if (!firstUserMessage || !firstUserMessage.trim()) {
    return 'New Chat';
  }

  let text = firstUserMessage.trim();

  // Strip code blocks or take code snippet summary
  if (text.startsWith('```')) {
    const langMatch = text.match(/^```([a-zA-Z0-9_-]*)/);
    const lang = langMatch && langMatch[1] ? langMatch[1].toUpperCase() : 'Code';
    return `${lang} Snippet`;
  }

  // Remove multi-line code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  // Take first non-empty line
  const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) || text;

  // Iteratively remove polite / conversational intros (e.g. "hi can you please explain...")
  let cleaned = firstLine;
  const introRegex = /^(?:hey|hi|hello|please|can you|could you|would you|i want to|i need you to|help me with|help me|help with|write a|create a|give me|explain|how do i|how to|what is|tell me about)\s+/i;
  
  while (introRegex.test(cleaned)) {
    cleaned = cleaned.replace(introRegex, '');
  }

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleanTitle(cleaned || firstLine);
}
