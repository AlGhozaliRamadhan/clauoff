import { describe, it, expect } from "vitest";
import {
  buildSkillsManifest,
  detectSkillSlashCommand,
  formatSkillPrompt,
} from "@/lib/skills/context";
import type { Skill } from "@/lib/skills/types";

const MOCK_SKILLS: Skill[] = [
  {
    name: "code-reviewer",
    description: "Expert code reviewer analyzing bugs and performance.",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content: "",
    instructions: "# Review Checklist\n1. Check memory leaks.",
  },
  {
    name: "disabled-skill",
    description: "Disabled skill.",
    enabled: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content: "",
    instructions: "Do nothing.",
  },
  {
    name: "commit-msg",
    description: "Conventional commit message helper.",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content: "",
    instructions: "Generate feat/fix commit messages.",
  },
];

describe("Skills Context & Progressive Disclosure", () => {
  it("builds progressive disclosure manifest for enabled skills only", () => {
    const manifest = buildSkillsManifest(MOCK_SKILLS);
    expect(manifest).toContain("<available_skills>");
    expect(manifest).toContain("<name>code-reviewer</name>");
    expect(manifest).toContain("<name>commit-msg</name>");
    expect(manifest).not.toContain("<name>disabled-skill</name>");
    expect(manifest).toContain("<action name=\"load_skill\">skill-name</action>");
  });

  it("detects slash commands starting a user prompt", () => {
    const res1 = detectSkillSlashCommand("/code-reviewer please review my function", MOCK_SKILLS);
    expect(res1).not.toBeNull();
    expect(res1?.skillName).toBe("code-reviewer");
    expect(res1?.query).toBe("please review my function");

    const res2 = detectSkillSlashCommand("/commit-msg", MOCK_SKILLS);
    expect(res2).not.toBeNull();
    expect(res2?.skillName).toBe("commit-msg");
    expect(res2?.query).toBe("");

    const res3 = detectSkillSlashCommand("Just asking about /code-reviewer", MOCK_SKILLS);
    expect(res3).toBeNull();

    const res4 = detectSkillSlashCommand("/non-existent-skill", MOCK_SKILLS);
    expect(res4).toBeNull();
  });

  it("formats high-priority active skill prompt", () => {
    const prompt = formatSkillPrompt(MOCK_SKILLS[0]);
    expect(prompt).toContain("[Active Skill Activated: /code-reviewer]");
    expect(prompt).toContain("Expert code reviewer analyzing bugs and performance.");
    expect(prompt).toContain("# Review Checklist");
    expect(prompt).toContain("1. Check memory leaks.");
  });
});
