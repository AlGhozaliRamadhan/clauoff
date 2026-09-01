import { describe, it, expect } from "vitest";
import {
  parseSkillMarkdown,
  serializeSkillMarkdown,
  validateSkillName,
  sanitizeSkillName,
} from "@/lib/skills/parser";

describe("Skills Parser & Validator", () => {
  it("validates skill names according to standard constraints", () => {
    expect(validateSkillName("code-reviewer").valid).toBe(true);
    expect(validateSkillName("git-commit-helper").valid).toBe(true);
    expect(validateSkillName("py310-test").valid).toBe(true);

    // Invalid names
    expect(validateSkillName("").valid).toBe(false);
    expect(validateSkillName("CodeReviewer").valid).toBe(false); // uppercase
    expect(validateSkillName("code_reviewer").valid).toBe(false); // underscore
    expect(validateSkillName("-code-reviewer").valid).toBe(false); // leading hyphen
    expect(validateSkillName("code-reviewer-").valid).toBe(false); // trailing hyphen
    expect(validateSkillName("code--reviewer").valid).toBe(false); // consecutive hyphens
  });

  it("sanitizes raw names to valid skill identifiers", () => {
    expect(sanitizeSkillName("Code Reviewer")).toBe("code-reviewer");
    expect(sanitizeSkillName("my_cool_skill!")).toBe("my-cool-skill");
    expect(sanitizeSkillName("--extra--hyphens--")).toBe("extra-hyphens");
  });

  it("parses valid SKILL.md with full YAML frontmatter", () => {
    const raw = `---
name: code-reviewer
description: Rigorous senior code reviewer analyzing bugs and security flaws.
license: MIT
compatibility: Node.js 18+
allowed-tools: search_web run_python
metadata:
  version: "1.2.0"
  author: "Cogito"
---

# Code Reviewer Instructions

When reviewing code, follow these steps:
1. Identify syntax and logic errors.
2. Check for security vulnerabilities.
`;

    const parsed = parseSkillMarkdown(raw);
    expect(parsed.metadata.name).toBe("code-reviewer");
    expect(parsed.metadata.description).toBe("Rigorous senior code reviewer analyzing bugs and security flaws.");
    expect(parsed.metadata.license).toBe("MIT");
    expect(parsed.metadata.compatibility).toBe("Node.js 18+");
    expect(parsed.metadata.allowedTools).toEqual(["search_web", "run_python"]);
    expect(parsed.metadata.metadata).toEqual({
      version: "1.2.0",
      author: "Cogito",
    });
    expect(parsed.instructions).toContain("# Code Reviewer Instructions");
    expect(parsed.instructions).toContain("1. Identify syntax and logic errors.");
  });

  it("handles folded YAML descriptions with >-", () => {
    const raw = `---
name: doc-writer
description: >-
  Generates clean architectural documentation
  and exhaustive API specifications.
license: Apache-2.0
---

# Instructions
Write good docs.
`;

    const parsed = parseSkillMarkdown(raw);
    expect(parsed.metadata.name).toBe("doc-writer");
    expect(parsed.metadata.description).toBe(
      "Generates clean architectural documentation and exhaustive API specifications."
    );
  });

  it("serializes skill back to standard YAML frontmatter + markdown", () => {
    const serialized = serializeSkillMarkdown({
      name: "test-skill",
      description: "A test skill for unit testing.",
      license: "MIT",
      compatibility: "Any",
      allowedTools: ["search_web"],
      metadata: { env: "prod" },
      instructions: "# Steps\n\n1. Do something useful.",
    });

    expect(serialized).toContain("---");
    expect(serialized).toContain("name: test-skill");
    expect(serialized).toContain("description: A test skill for unit testing.");
    expect(serialized).toContain("license: MIT");
    expect(serialized).toContain("allowed-tools: search_web");
    expect(serialized).toContain('# Steps\n\n1. Do something useful.');

    // Roundtrip verification
    const roundtrip = parseSkillMarkdown(serialized);
    expect(roundtrip.metadata.name).toBe("test-skill");
    expect(roundtrip.metadata.description).toBe("A test skill for unit testing.");
    expect(roundtrip.metadata.license).toBe("MIT");
    expect(roundtrip.instructions).toBe("# Steps\n\n1. Do something useful.");
  });
});
