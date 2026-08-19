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

  it("returns false for a Japanese reply that includes a Latin term", () => {
    expect(
      visibleContentIsEmpty("日本語の答えは JavaScript と同じく動的です。"),
    ).toBe(false);
  });
});
