import { describe, it, expect } from "vitest";
import { visibleContentIsEmpty } from "../bare-thought-guard";

describe("visibleContentIsEmpty", () => {
  it("returns true for a bare <think>…</think> block with nothing after", () => {
    expect(visibleContentIsEmpty("<think>The user said hi, I'll reply warmly.</think>")).toBe(true);
  });

  it("returns true for an unclosed <think> at end of stream", () => {
    expect(visibleContentIsEmpty("<think>still thinking…")).toBe(true);
  });

  it("returns true for an empty string", () => {
    expect(visibleContentIsEmpty("")).toBe(true);
  });

  it("returns true for whitespace-only after stripping", () => {
    expect(visibleContentIsEmpty("<think>…</think>   ")).toBe(true);
  });

  it("returns true for thought + <step> blocks only", () => {
    expect(
      visibleContentIsEmpty(
        "<think>reasoning</think><step>some status</step>",
      ),
    ).toBe(true);
  });

  it("returns true for thought + leftover CJK junk tail", () => {
    expect(visibleContentIsEmpty("<think>thinking</think>答案")).toBe(true);
  });

  it("returns false when there is real visible text after the thought", () => {
    expect(
      visibleContentIsEmpty(
        "<think>The user greeted me.</think>Hello! How can I help?",
      ),
    ).toBe(false);
  });

  it("returns false when there is real visible text before any thought", () => {
    expect(visibleContentIsEmpty("Just a plain reply, no thought at all.")).toBe(false);
  });

  it("returns false when <step> blocks have visible content around them", () => {
    expect(
      visibleContentIsEmpty(
        "<think>plan</think>Here is the answer.\n<step>some status</step>",
      ),
    ).toBe(false);
  });

  it('strips a leading "Final answer:" label that some models prefix', () => {
    expect(
      visibleContentIsEmpty("<think>thinking</think>Final Answer: Hi there!"),
    ).toBe(false);
  });

  it("strips <action> tags and still detects emptiness", () => {
    expect(visibleContentIsEmpty("<think>plan</think><action name=\"answer\">the body</action>")).toBe(true);
  });

  it("ignores <tool_results> structured output and returns true if no other text", () => {
    expect(
      visibleContentIsEmpty(
        '<think>searched</think><tool_results tool="q"><item><title>T</title></item></tool_results>',
      ),
    ).toBe(true);
  });

  // ---- <confidence> block detection (cogito.py persona quirk) ----

  it("returns true for <confidence>...</confidence> with no final answer", () => {
    expect(
      visibleContentIsEmpty(
        "<confidence>My confidence in this claim is medium. I have no direct experience.</confidence>",
      ),
    ).toBe(true);
  });

  it("returns false when <confidence> is followed by a clear sentence-final answer", () => {
    expect(
      visibleContentIsEmpty(
        "<confidence>low</confidence>Humans are pattern-matching machines with a bias for coherent narratives.",
      ),
    ).toBe(false);
  });

  // ---- Pure-non-Latin detection ----

  it("returns true for a pure-CJK reply (no Latin chars at all)", () => {
    expect(
      visibleContentIsEmpty("认知: 的置信度中等。我没有直接体验人类思维。"),
    ).toBe(true);
  });

  it("returns false for a Chinese reply that includes Latin punctuation/quotes", () => {
    expect(
      visibleContentIsEmpty(
        '认知是一种模式匹配机制 — "thinking" 是一种后置叙事。',
      ),
    ).toBe(false);
  });

  // ---- Untagged confidence & Action labels ----

  it("returns true for bare untagged confidence monologue with no visible answer", () => {
    expect(
      visibleContentIsEmpty(
        ": Confidence 0.65 The greeting is simple, but I should acknowledge it warmly. Action: answer",
      ),
    ).toBe(true);
  });

  // ---- Echoed human/user tags ----

  it("returns true for echoed <human> tag with only a thought after", () => {
    expect(
      visibleContentIsEmpty(
        "<human> what you thinks about an hitman </human><think>The term hitman refers to...</think>",
      ),
    ).toBe(true);
  });

  it("returns false for echoed <human> tag followed by a real visible answer", () => {
    expect(
      visibleContentIsEmpty(
        "<human> what you thinks about an hitman </human><think>The term hitman refers to...</think>A hitman is a contract killer.",
      ),
    ).toBe(false);
  });

  it("handles leading answer and ask_clarification label prefixes", () => {
    expect(
      visibleContentIsEmpty(
        "<think>thinking</think>answer Hitman is a critically acclaimed action-stealth game.",
      ),
    ).toBe(false);

    expect(
      visibleContentIsEmpty(
        "<think>thinking</think>Answer: Hitman is a game.",
      ),
    ).toBe(false);

    expect(
      visibleContentIsEmpty(
        "<think>thinking</think>ask_clarification Could you clarify what you mean by \"real hitman\"?",
      ),
    ).toBe(false);

    expect(
      visibleContentIsEmpty(
        "<think>thinking</think>Action: ask_clarification",
      ),
    ).toBe(true);

    expect(
      visibleContentIsEmpty(
        "<think>thinking</think>admit_ignorance I do not have enough information about this specific event.",
      ),
    ).toBe(false);

    expect(
      visibleContentIsEmpty(
        "<think>thinking</think>generate_code ```python\nprint('hello')\n```",
      ),
    ).toBe(false);

    expect(
      visibleContentIsEmpty(
        "<think>thinking</think>Action: generate_code",
      ),
    ).toBe(true);
  });

  // ---- Orphan closing </think> (prefilled chat templates) ----

  it("returns true for prefilled thought ending with </think> and no visible text", () => {
    expect(
      visibleContentIsEmpty(
        "User said hello. Short warm greeting needed.\n</think>",
      ),
    ).toBe(true);
  });

  it("returns false for prefilled thought ending with </think> followed by visible text", () => {
    expect(
      visibleContentIsEmpty(
        "User said hello. Short warm greeting needed.\n</think>\n\nHello! How can I help you today?",
      ),
    ).toBe(false);
  });

  it("returns true for Qwen tool_call blocks with no visible reply", () => {
    expect(
      visibleContentIsEmpty(
        "<tool_call>\n<function=search_web>\n<parameter=query>\ntokyo weather\n</parameter>\n</function>\n</tool_call>",
      ),
    ).toBe(true);
  });
});

describe("ensureThoughtStream", () => {
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

  function createStringStream(chunks: string[]): ReadableStream<string> {
    return new ReadableStream<string>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
  }

  it("prepends <think>\\n to the first chunk when thinking is enabled and stream starts without <think>", async () => {
    const { ensureThoughtStream } = await import("../bare-thought-guard");
    const source = createStringStream(["User said hello. ", "Need warm reply.\n</think>\n\nHello!"]);
    const guarded = ensureThoughtStream(source, true);
    const result = await streamToString(guarded);
    expect(result).toBe("<think>\nUser said hello. Need warm reply.\n</think>\n\nHello!");
  });

  it("does not duplicate <think> when stream already starts with <think>", async () => {
    const { ensureThoughtStream } = await import("../bare-thought-guard");
    const source = createStringStream(["<think>\nUser said hello. ", "Need warm reply.\n</think>\n\nHello!"]);
    const guarded = ensureThoughtStream(source, true);
    const result = await streamToString(guarded);
    expect(result).toBe("<think>\nUser said hello. Need warm reply.\n</think>\n\nHello!");
  });

  it("handles partial leading tag chunk correctly", async () => {
    const { ensureThoughtStream } = await import("../bare-thought-guard");
    const source = createStringStream(["<thi", "nk>\nThinking deeply...\n</think>\n\nAnswer"]);
    const guarded = ensureThoughtStream(source, true);
    const result = await streamToString(guarded);
    expect(result).toBe("<think>\nThinking deeply...\n</think>\n\nAnswer");
  });

  it("passes stream through unchanged when thinking is disabled", async () => {
    const { ensureThoughtStream } = await import("../bare-thought-guard");
    const source = createStringStream(["Just a normal answer."]);
    const guarded = ensureThoughtStream(source, false);
    const result = await streamToString(guarded);
    expect(result).toBe("Just a normal answer.");
  });
});

