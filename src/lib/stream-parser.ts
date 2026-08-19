/**
 * SSE parser for OpenAI-compatible streaming responses.
 *
 * Reads Server-Sent Events where data lines have the shape
 * `data: { choices: [{ delta: { content: "..." } }] }`.
 * Outputs the `choices[0].delta.content` string from each event.
 */
export function parseSSE(): TransformStream<Uint8Array, string> {
  const decoder = new TextDecoder();
  let buffer = '';

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
          const content: unknown = parsed?.choices?.[0]?.delta?.content;
          if (typeof content === 'string' && content.length > 0) {
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
            const content: unknown = parsed?.choices?.[0]?.delta?.content;
            if (typeof content === 'string' && content.length > 0) {
              controller.enqueue(content);
            }
          } catch {
            // Ignore trailing garbage
          }
        }
      }
      controller.terminate();
    },
  });
}
