import { describe, it, expect } from "vitest";
import {
  verifyGrounding,
  renderGroundingWarning,
  type VerifiedFact,
} from "@/lib/agent/grounding";

const REAL_SNIPPETS = [
  "The 2023 Nobel Prize in Physics was awarded to Pierre Agostini, Ferenc Krausz and Anne L'Huillier for experimental methods that generate attosecond pulses of light.",
  "Anne L'Huillier is a professor at Lund University in Sweden.",
  "Ferenc Krausz is a director at the Max Planck Institute of Quantum Optics in Garching.",
];

describe("verifyGrounding", () => {
  it("passes a fully supported factual answer", () => {
    const reply =
      "The 2023 Nobel Prize in Physics went to Pierre Agostini, Ferenc Krausz and Anne L'Huillier for attosecond pulses. L'Huillier is at Lund University.";
    const flagged = verifyGrounding(reply, REAL_SNIPPETS);
    expect(flagged).toEqual([]);
  });

  it("flags a sentence whose specific facts are entirely unsupported", () => {
    const reply =
      "Laureate A was born in December 1962, making them around 57 at win time.";
    const flagged = verifyGrounding(reply, REAL_SNIPPETS);
    expect(flagged.length).toBe(1);
    expect(flagged[0].missing.length).toBeGreaterThan(0);
  });

  it("does not flag sentences with no verifiable specifics (opinion/conversational)", () => {
    const reply = "That's a great question. Let me think about it.";
    const flagged = verifyGrounding(reply, REAL_SNIPPETS);
    expect(flagged).toEqual([]);
  });

  it("does not flag when a sentence mixes one supported fact with an invented one", () => {
    // "Lund University" is in the snippets — the sentence keeps a real anchor
    const reply = "Anne L'Huillier is at Lund University in Norway.";
    const flagged = verifyGrounding(reply, REAL_SNIPPETS);
    expect(flagged).toEqual([]);
  });

  it("returns empty when there are no snippets at all", () => {
    const flagged = verifyGrounding("Lund University in 2023.", []);
    expect(flagged).toEqual([]);
  });

  it("flags a fully-fabricated answer with fake names, ages and an unsupported university", () => {
    // The exact failure from production: the model invented "Fagin,
    // Kostelecky, O'Neil" as 2023 winners and "University of California,
    // Berkeley" as O'Neil's affiliation — none of which is in the snippets.
    const fabricated = `Here is the complete analysis:

2023 Nobel Prize in Physics laureates: Fagin, Kostelecky, and O'Neil.

Ages verified from biographical sources:

Fagin (b. 1984): 45 years old
Kostelecky (b. 1967): 59 years old
O'Neil (b. 1980): 46 years old
O'Neil is the youngest at 46.

Current university affiliation: O'Neil currently works at the University of California, Berkeley.`;
    const realSnippets = [
      "The 2023 Nobel Prize in Physics was awarded to Pierre Agostini, Ferenc Krausz and Anne L'Huillier for experimental methods that generate attosecond pulses of light.",
      "Anne L'Huillier is a professor at Lund University in Sweden.",
    ];
    const flagged = verifyGrounding(fabricated, realSnippets);
    // The flagship fabricated affiliation must be flagged
    const uniSentence = flagged.find((f) => f.sentence.includes("University of California"));
    expect(uniSentence).toBeDefined();
    expect(uniSentence!.missing).toContain("University of California");
    // The fake ages must be flagged too
    expect(flagged.some((f) => f.missing.includes("1984"))).toBe(true);
    expect(flagged.some((f) => f.missing.includes("1967"))).toBe(true);
    expect(flagged.some((f) => f.missing.includes("1980"))).toBe(true);
  });
});

describe("renderGroundingWarning", () => {
  it("renders nothing when nothing was flagged", () => {
    expect(renderGroundingWarning([])).toBe("");
  });

  it("renders the flagged sentences up to 3", () => {
    const flagged: VerifiedFact[] = [
      { sentence: "First invented claim.", missing: ["1962"] },
      { sentence: "Second invented claim.", missing: ["X"] },
      { sentence: "Third invented claim.", missing: ["Y"] },
      { sentence: "Fourth invented claim.", missing: ["Z"] },
    ];
    const out = renderGroundingWarning(flagged);
    expect(out).toContain("Couldn't verify this against the search results");
    expect(out).toContain("First invented claim.");
    expect(out).toContain("Third invented claim.");
    expect(out).not.toContain("Fourth invented claim.");
  });

  it("truncates very long flagged sentences so the warning does not echo huge blocks back to the user", () => {
    const hugeSentence = "x".repeat(5000);
    const out = renderGroundingWarning([{ sentence: hugeSentence, missing: ["x"] }]);
    expect(out.length).toBeLessThan(5000);
    expect(out).toContain("…");
  });
});

describe("verifyGrounding strips code", () => {
  it("does not flag code-block tokens that look like proper nouns", () => {
    // PATH and function names inside a fenced code block should NOT
    // trigger grounding flags — those are code, not factual claims.
    const reply =
      "CVE-2024-3094 affects xz 5.6.0 and 5.6.1.\n\n" +
      "```python\nimport os\nfor d in os.environ.get('PATH', ''):\n    print(d)\n```";
    const snippets = ["CVE-2024-3094 was discovered in xz 5.6.0 and 5.6.1."];
    const flagged = verifyGrounding(reply, snippets);
    expect(flagged).toEqual([]);
  });

  it("still flags prose that contains unsupported claims even when a code block is present", () => {
    const reply =
      "CVE-2024-3094 affects xz 5.6.0 and 5.6.1.\n\n" +
      "Invented claim: the bug was introduced by Jane Doe at RandomCorp in 2022.\n\n" +
      "```python\nprint('PATH')\n```";
    const snippets = ["CVE-2024-3094 was discovered in xz 5.6.0 and 5.6.1."];
    const flagged = verifyGrounding(reply, snippets);
    expect(flagged.length).toBe(1);
    expect(flagged[0].sentence).toContain("RandomCorp");
  });
});
