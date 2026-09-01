import { describe, it, expect } from "vitest";
import {
  cleanTitle,
  generateSmartFallbackTitle,
  generateAiTitle,
} from "@/lib/chat-titling";

describe("chat-titling", () => {
  describe("cleanTitle", () => {
    it("cleans prefixes like Title: and surrounding quotes", () => {
      expect(cleanTitle('Title: "Rust Concurrency Guide"')).toBe("Rust Concurrency Guide");
      expect(cleanTitle("Topic: Python AsyncIO Basics.")).toBe("Python AsyncIO Basics");
      expect(cleanTitle("subject: Next.js App Router")).toBe("Next.js App Router");
      expect(cleanTitle("“Machine Learning Intro”")).toBe("Machine Learning Intro");
    });

    it("strips XML/HTML tags and backticks", () => {
      expect(cleanTitle("<think>reasoning</think> React Hooks Guide")).toBe("React Hooks Guide");
      expect(cleanTitle("Fixing `undefined is not a function` error")).toBe("Fixing undefined is not a function error");
    });

    it("handles empty or whitespace strings gracefully", () => {
      expect(cleanTitle("")).toBe("New Chat");
      expect(cleanTitle("   ")).toBe("New Chat");
    });

    it("caps very long titles cleanly", () => {
      const longTitle = "A very long detailed exploration of theoretical quantum electrodynamics and its mathematical formulations";
      const cleaned = cleanTitle(longTitle);
      expect(cleaned.length).toBeLessThanOrEqual(46);
      expect(cleaned.endsWith("…")).toBe(true);
    });
  });

  describe("generateSmartFallbackTitle", () => {
    it("cleans polite / filler conversational intros", () => {
      expect(generateSmartFallbackTitle("hi can you please explain quantum computing?")).toBe("Quantum computing");
      expect(generateSmartFallbackTitle("help me write a python script for scraping")).toBe("Python script for scraping");
      expect(generateSmartFallbackTitle("how do I configure tailwind v4?")).toBe("Configure tailwind v4");
      expect(generateSmartFallbackTitle("Can you help me build a REST API in Go?")).toBe("Build a REST API in Go");
    });

    it("handles code snippets cleanly", () => {
      expect(generateSmartFallbackTitle("```python\ndef foo():\n    pass\n```")).toBe("PYTHON Snippet");
      expect(generateSmartFallbackTitle("```javascript\nconsole.log(1)\n```")).toBe("JAVASCRIPT Snippet");
      expect(generateSmartFallbackTitle("```\nplain code\n```")).toBe("Code Snippet");
    });

    it("returns New Chat for empty input", () => {
      expect(generateSmartFallbackTitle("")).toBe("New Chat");
      expect(generateSmartFallbackTitle("   ")).toBe("New Chat");
    });
  });

  describe("generateAiTitle", () => {
    it("returns New Chat if no user messages exist", async () => {
      const title = await generateAiTitle([]);
      expect(title).toBe("New Chat");
    });

    it("generates a non-empty title for user messages", async () => {
      const title = await generateAiTitle([
        { role: "user", content: "Can you help me build a REST API in Go?" },
      ]);
      expect(typeof title).toBe("string");
      expect(title.length).toBeGreaterThan(0);
      expect(title).not.toBe("New Chat");
    });
  });
});
