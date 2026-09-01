import { describe, it, expect } from "vitest";
import {
  saveSkill,
  getSkill,
  listSkills,
  toggleSkill,
  deleteSkill,
} from "@/lib/skills/storage";

describe("Skills Storage Layer", () => {
  const testSkillName = "vitest-demo-skill";

  it("saves a new skill to disk and reads it back", async () => {
    const saved = await saveSkill({
      name: testSkillName,
      description: "Demo skill created during Vitest run.",
      license: "MIT",
      instructions: "# Vitest Instructions\n\nRun tests rigorously.",
      enabled: true,
      source: "custom",
    });

    expect(saved.name).toBe(testSkillName);
    expect(saved.description).toBe("Demo skill created during Vitest run.");
    expect(saved.enabled).toBe(true);
    expect(saved.instructions).toContain("# Vitest Instructions");

    const fetched = await getSkill(testSkillName);
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe(testSkillName);
  });

  it("lists all installed skills", async () => {
    const skills = await listSkills();
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.some((s) => s.name === testSkillName)).toBe(true);
  });

  it("toggles skill enabled state", async () => {
    const disabled = await toggleSkill(testSkillName, false);
    expect(disabled?.enabled).toBe(false);

    const reloaded = await getSkill(testSkillName);
    expect(reloaded?.enabled).toBe(false);

    const reenabled = await toggleSkill(testSkillName, true);
    expect(reenabled?.enabled).toBe(true);
  });

  it("deletes a skill from disk", async () => {
    const deleted = await deleteSkill(testSkillName);
    expect(deleted).toBe(true);

    const fetched = await getSkill(testSkillName);
    expect(fetched).toBeNull();
  });
});
