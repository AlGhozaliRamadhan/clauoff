/**
 * Claude & Agent Skills Context & Progressive Disclosure Builder (ADR-0013).
 *
 * Prepares skills manifests for model discovery and injects active skill instructions.
 */

import type { Skill } from "./types";

/**
 * Builds the lightweight progressive disclosure manifest for available skills.
 * Only names and descriptions are loaded into the initial context window.
 */
export function buildSkillsManifest(skills: Skill[]): string {
  const enabledSkills = skills.filter((s) => s.enabled);
  if (enabledSkills.length === 0) return "";

  const skillEntries = enabledSkills
    .map(
      (s) => `  <skill>
    <name>${s.name}</name>
    <description>${s.description}</description>
  </skill>`
    )
    .join("\n");

  return `<available_skills>
${skillEntries}
</available_skills>

Skills Progressive Disclosure Instructions:
You have access to specialized expert skills listed above.
1. Match your task against the skill descriptions. When a user's request aligns with a skill (e.g. code review, commit messages, security audits, dependency updates, documentation, or refactoring), adopt that skill's methodology.
2. If you need the full, detailed instructions and checklists for a skill, you can load it using the tool:
   <action name="load_skill">skill-name</action>
3. If the user explicitly prefixes their request with a slash command (e.g. /code-reviewer or /commit-message-generator), that skill is activated immediately for this turn.`;
}

/**
 * Detects if a user prompt begins with a slash command invoking an installed skill.
 * e.g. "/code-reviewer please check this function" -> { skillName: "code-reviewer", query: "please check this function", skill }
 */
export function detectSkillSlashCommand(
  input: string,
  skills: Skill[]
): { skillName: string; query: string; skill: Skill } | null {
  if (!input || !input.trim().startsWith("/")) return null;

  const trimmed = input.trim();
  const match = trimmed.match(/^\/([a-z0-9-]+)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;

  const invokedName = match[1].toLowerCase();
  const query = match[2] ? match[2].trim() : "";

  const foundSkill = skills.find(
    (s) => s.name.toLowerCase() === invokedName
  );

  if (foundSkill) {
    return {
      skillName: foundSkill.name,
      query,
      skill: foundSkill,
    };
  }

  return null;
}

/**
 * Formats a fully activated skill's instructions for high-priority prompt injection.
 */
export function formatSkillPrompt(skill: Skill): string {
  return `[Active Skill Activated: /${skill.name}]
Description: ${skill.description}
${skill.compatibility ? `Compatibility: ${skill.compatibility}\n` : ""}${skill.allowedTools && skill.allowedTools.length > 0 ? `Allowed Tools: ${skill.allowedTools.join(", ")}\n` : ""}
Follow these specialized skill instructions thoroughly for this turn:

${skill.instructions}`;
}
