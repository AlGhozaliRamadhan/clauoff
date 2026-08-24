/**
 * SSE parser for OpenAI-compatible streaming responses.
 *
 * Reads Server-Sent Events where data lines have the shape
 * `data: { choices: [{ delta: { content: "...", reasoning_content?: "..." } }] }`.
 *
 * Handles both standard `delta.content` and reasoning/thinking deltas
 * (`delta.reasoning_content`, `delta.reasoning`, `delta.thought`) produced
 * by reasoning models (Qwen, DeepSeek, vLLM, Ollama, LM Studio, etc.).
 *
 * Wraps native reasoning streams inside `<think>...</think>` tags so downstream
 * components and UI render collapsible thought blocks seamlessly.
 */
export function parseSSE(): TransformStream<Uint8Array, string> {
  const decoder = new TextDecoder();
  let buffer = '';
  let inReasoning = false;

  return new TransformStream<Uint8Array, string>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });

      const lines = buffer.split('\n');
      // Keep the last (potentially incomplete) segment in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();

        // Ignore empty lines, comments, and non-data fields
        if (trimmed === '' || !trimmed.startsWith('data:')) continue;

        const payload = trimmed.slice('data:'.length).trim();

        // End-of-stream signal
        if (payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta;
          if (!delta) continue;

          // Check for reasoning / thought fields from native reasoning models
          const reasoning: unknown =
            delta.reasoning_content ?? delta.reasoning ?? delta.thought;

          if (typeof reasoning === 'string' && reasoning.length > 0) {
            if (!inReasoning) {
              controller.enqueue('<think>\n');
              inReasoning = true;
            }
            controller.enqueue(reasoning);
          }

          // Check for main content
          const content: unknown = delta.content;
          if (typeof content === 'string' && content.length > 0) {
            if (inReasoning) {
              controller.enqueue('\n</think>\n\n');
              inReasoning = false;
            }
            controller.enqueue(content);
          }
        } catch {
          // Skip malformed events
        }
      }
    },

    flush(controller) {
      // Process any remaining data in the buffer
      const trimmed = buffer.trim();
      if (trimmed !== '' && trimmed.startsWith('data:')) {
        const payload = trimmed.slice('data:'.length).trim();
        if (payload !== '[DONE]') {
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed?.choices?.[0]?.delta;
            if (delta) {
              const reasoning: unknown =
                delta.reasoning_content ?? delta.reasoning ?? delta.thought;
              if (typeof reasoning === 'string' && reasoning.length > 0) {
                if (!inReasoning) {
                  controller.enqueue('<think>\n');
                  inReasoning = true;
                }
                controller.enqueue(reasoning);
              }

              const content: unknown = delta.content;
              if (typeof content === 'string' && content.length > 0) {
                if (inReasoning) {
                  controller.enqueue('\n</think>\n\n');
                  inReasoning = false;
                }
                controller.enqueue(content);
              }
            }
          } catch {
            // Ignore trailing garbage
          }
        }
      }

      if (inReasoning) {
        controller.enqueue('\n</think>\n\n');
        inReasoning = false;
      }

      controller.terminate();
    },
  });
}
