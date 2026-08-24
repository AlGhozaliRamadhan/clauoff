/**
 * Context Window Trimming & History Compaction Module.
 *
 * Prevents local backend models (Ollama, LM Studio, llama.cpp, vLLM) from
 * running out of context (num_ctx / max_context_length) and cutting off prematurely.
 *
 * Strategies:
 *  1. Strips internal <think>...</think> monologue and tool execution tags
 *     from HISTORICAL assistant turns (keeps only the final answer text).
 *  2. Strips duplicate injected system prompts from older user turns.
 *  3. Applies sliding window budgeting to keep the first turn (goal) + most recent turns.
 *  4. Provides emergency minimal recovery context if a model ever returns 0 tokens.
 */

export interface ChatMessage {
  role: string;
  content: string;
}

export function compactMessagesForBackend(
  messages: ChatMessage[],
  maxChars: number = 36000,
): ChatMessage[] {
  if (!messages || messages.length === 0) return [];

  const cleaned: ChatMessage[] = messages
    .map((m, idx) => {
      const isLast = idx === messages.length - 1;
      let content = m.content || "";

      if (m.role === "assistant" && !isLast) {
        // Strip internal thoughts, steps, and tool result tags from older assistant turns
        content = content
          .replace(
            /<\s*(?:\|)?(?:thought|think)\b[^>]*>[\s\S]*?<\/\s*(?:\|)?(?:thought|think)\b[^>]*>/gi,
            "",
          )
          .replace(/<step(?:>|\s[^>]*>)[\s\S]*?<\/step>/gi, "")
          .replace(/<tool_results[\s\S]*?<\/tool_results>/gi, "")
          .replace(/<action[^>]*>[\s\S]*?<\/action>/gi, "")
          .trim();
      } else if (m.role === "user" && !isLast) {
        // Strip duplicate injected system/tool prompts from historical user turns
        const sysSplit = content.indexOf("\n\n---\n\nSystem Information:");
        if (sysSplit !== -1) {
          content = content.substring(0, sysSplit).trim();
        }
        const toolsSplit = content.indexOf("\n\n---\n\n[Tools available]");
        if (toolsSplit !== -1) {
          content = content.substring(0, toolsSplit).trim();
        }
      }

      return { role: m.role, content };
    })
    .filter((m, idx) => {
      const isLast = idx === messages.length - 1;
      return isLast || m.content.trim().length > 0;
    });

  // Calculate total length
  const totalLen = cleaned.reduce((sum, m) => sum + m.content.length, 0);

  if (totalLen <= maxChars || cleaned.length <= 4) {
    return cleaned;
  }

  // Sliding window: keep first turn (topic/goal) + most recent turns
  const firstMsg = cleaned[0];
  const lastMessages: ChatMessage[] = [];
  let currentLen = firstMsg.content.length;

  for (let i = cleaned.length - 1; i >= 1; i--) {
    const msg = cleaned[i];
    if (currentLen + msg.content.length > maxChars && lastMessages.length >= 2) {
      break;
    }
    lastMessages.unshift(msg);
    currentLen += msg.content.length;
  }

  return [firstMsg, ...lastMessages];
}

/**
 * Builds an emergency minimal recovery context when a backend model
 * stops unexpectedly with 0 tokens.
 */
export function buildEmergencyRecoveryContext(
  messages: ChatMessage[],
  latestToolContext?: string,
): ChatMessage[] {
  const lastUser = [...messages]
    .reverse()
    .find((m) => m.role === "user" && m.content.trim().length > 0);

  const query = lastUser ? lastUser.content : "Please answer the question.";

  const recoveryMessages: ChatMessage[] = [
    {
      role: "user",
      content: latestToolContext
        ? `${query}\n\n[Search Results]:\n${latestToolContext}\n\nWrite a complete, direct, and detailed answer based on the search results above.`
        : `${query}\n\nPlease provide your complete, direct answer.`,
    },
  ];

  return recoveryMessages;
}
