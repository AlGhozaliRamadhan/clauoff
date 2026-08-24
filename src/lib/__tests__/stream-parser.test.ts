import { describe, it, expect } from "vitest";
import { parseSSE } from "../stream-parser";

async function streamToString(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += value;
  }
  return result;
}

function createSSEByteStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });
}

describe("parseSSE", () => {
  it("parses standard delta.content SSE stream", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world!"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const parsedStream = createSSEByteStream(sse).pipeThrough(parseSSE());
    const output = await streamToString(parsedStream);
    expect(output).toBe("Hello world!");
  });

  it("wraps delta.reasoning_content in <think> tags", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content":"User said hello."}}]}\n\n',
      'data: {"choices":[{"delta":{"reasoning_content":" Need warm reply."}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Hello! How can I help?"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const parsedStream = createSSEByteStream(sse).pipeThrough(parseSSE());
    const output = await streamToString(parsedStream);
    expect(output).toContain("<think>\nUser said hello. Need warm reply.\n</think>\n\nHello! How can I help?");
  });

  it("closes unclosed reasoning if stream ends during reasoning", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content":"Thinking deeply..."}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const parsedStream = createSSEByteStream(sse).pipeThrough(parseSSE());
    const output = await streamToString(parsedStream);
    expect(output).toBe("<think>\nThinking deeply...\n</think>\n\n");
  });
});
