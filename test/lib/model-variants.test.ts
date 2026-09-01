import { describe, it, expect } from "vitest";
import { detectModelVariant, getReasoningRequestParams } from "@/lib/model-variants";
import { getThoughtPrompt } from "@/lib/thought-prompts";

describe("model-variants", () => {
  it("detects Qwen family models and enables native thinking", () => {
    const variant1 = detectModelVariant("qwen2.5-coder-32b-instruct");
    expect(variant1.family).toBe("qwen");
    expect(variant1.hasNativeThinking).toBe(true);

    const variant2 = detectModelVariant("qwq-32b-preview");
    expect(variant2.family).toBe("qwen");
    expect(variant2.hasNativeThinking).toBe(true);
  });

  it("detects DeepSeek family models", () => {
    const variant = detectModelVariant("deepseek-r1-distill-qwen-14b");
    expect(variant.family).toBe("deepseek");
    expect(variant.hasNativeThinking).toBe(true);
  });

  it("detects Llama family models", () => {
    const variant = detectModelVariant("llama-3.3-70b-instruct");
    expect(variant.family).toBe("llama");
    expect(variant.hasNativeThinking).toBe(false);
  });

  it("falls back to generic for unknown models", () => {
    const variant = detectModelVariant("my-custom-fine-tuned-model");
    expect(variant.family).toBe("generic");
  });

  it("maps reasoning request params for Qwen with enable_thinking", () => {
    const params = getReasoningRequestParams("qwen2.5-7b", "High", true);
    expect(params.enable_thinking).toBe(true);
    expect(params.reasoning_effort).toBe("high");
    expect(params.chat_template_kwargs).toEqual({
      enable_thinking: true,
      reasoning_effort: "xhigh",
    });
  });

  it("maps reasoning request params when thinking is disabled", () => {
    const params = getReasoningRequestParams("qwen2.5-7b", "Medium", false);
    expect(params.enable_thinking).toBe(false);
  });

  it("provides concise thought prompts for native reasoning models without rigid pseudo-dialogue", () => {
    const qwenPrompt = getThoughtPrompt("High", "qwen2.5-coder");
    expect(qwenPrompt).toContain("Reasoning effort is set to high");
    expect(qwenPrompt).not.toContain('To respond to "hi"');

    const llamaPrompt = getThoughtPrompt("High", "llama-3.1-8b");
    expect(llamaPrompt).toContain("<think>");
  });
});
