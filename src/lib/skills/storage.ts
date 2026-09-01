/**
 * Claude & Agent Skills Storage Layer (ADR-0013).
 *
 * Persists and manages skills on disk under `data/skills/<name>/SKILL.md`
 * following the open Agent Skills directory specification.
 */

import fs from "fs";
import path from "path";
import { getDataRoot } from "@/lib/rag/paths";
import type { Skill, SkillMetadata, SkillSource } from "./types";
import { parseSkillMarkdown, serializeSkillMarkdown, sanitizeSkillName } from "./parser";
import { CURATED_SKILLS } from "./catalog";

const SKILLS_DIR_NAME = "skills";

/**
 * Returns the primary skills directory under DATA_DIR (e.g. data/skills)
 */
export function getSkillsDir(): string {
  const dir = path.join(getDataRoot(), SKILLS_DIR_NAME);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Resolves a safe file or directory path strictly within a base directory.
 * Throws if path traversal is detected.
 */
export function resolveSafeSkillPath(baseDir: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(baseDir);
  const target = path.resolve(resolvedBase, ...segments);
  const relative = path.relative(resolvedBase, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid skill path: path traversal detected");
  }
  return target;
}

/**
 * Returns metadata config path for global skill toggles and settings.
 */
function getSkillsConfigPath(): string {
  return resolveSafeSkillPath(getSkillsDir(), "skills-config.json");
}

interface SkillsConfig {
  disabledSkills: string[];
  customMetadata: Record<string, Partial<SkillMetadata>>;
}

function loadSkillsConfig(): SkillsConfig {
  const configPath = getSkillsConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      // fallback on error
    }
  }
  return { disabledSkills: [], customMetadata: {} };
}

function saveSkillsConfig(config: SkillsConfig): void {
  const configPath = getSkillsConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save skills config:", err);
  }
}

/**
 * Ensures baseline starter skills are installed if the skills directory is empty.
 */
export async function ensureBuiltinSkills(): Promise<void> {
  const skillsDir = getSkillsDir();
  const existing = fs.readdirSync(skillsDir).filter((f) => {
    const full = path.join(skillsDir, f);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "SKILL.md"));
  });

  if (existing.length === 0) {
    // Seed starter skills from curated catalog
    const starterSkills = ["code-reviewer", "commit-message-generator", "consolidate-deps", "security-auditor"];
    for (const id of starterSkills) {
      const found = CURATED_SKILLS.find((s) => s.id === id);
      if (found) {
        await saveSkill({
          name: found.name,
          content: found.skillMd,
          source: "builtin",
          enabled: true,
        });
      }
    }
  }
}

/**
 * List all installed skills from data/skills/
 */
export async function listSkills(): Promise<Skill[]> {
  await ensureBuiltinSkills();
  const skillsDir = getSkillsDir();
  const config = loadSkillsConfig();
  const results: Skill[] = [];

  const entries = fs.readdirSync(skillsDir);
  for (const entry of entries) {
    const skillPath = path.join(skillsDir, entry);
    if (!fs.statSync(skillPath).isDirectory()) continue;

    const skillMdPath = path.join(skillPath, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      const stat = fs.statSync(skillMdPath);
      const parsed = parseSkillMarkdown(content, entry);

      const isExplicitlyDisabled = config.disabledSkills.includes(parsed.metadata.name || entry);
      const customMeta = config.customMetadata[parsed.metadata.name || entry] || {};

      const skill: Skill = {
        name: parsed.metadata.name || entry,
        description: parsed.metadata.description || "No description provided.",
        license: parsed.metadata.license,
        compatibility: parsed.metadata.compatibility,
        allowedTools: parsed.metadata.allowedTools,
        metadata: parsed.metadata.metadata,
        source: (customMeta.source || parsed.metadata.source || "custom") as SkillSource,
        sourceUrl: customMeta.sourceUrl || parsed.metadata.sourceUrl,
        enabled: isExplicitlyDisabled ? false : (parsed.metadata.enabled ?? true),
        createdAt: stat.birthtimeMs || stat.ctimeMs || Date.now(),
        updatedAt: stat.mtimeMs || Date.now(),
        path: skillMdPath,
        content,
        instructions: parsed.instructions,
        rawYaml: parsed.rawYaml,
      };

      results.push(skill);
    } catch (err) {
      console.warn(`Failed to read skill at ${skillMdPath}:`, err);
    }
  }

  // Sort alphabetically by name
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Retrieve a specific skill by name.
 */
export async function getSkill(name: string): Promise<Skill | null> {
  const safeName = sanitizeSkillName(name);
  const skillsDir = getSkillsDir();
  const skillPath = resolveSafeSkillPath(skillsDir, safeName);
  const skillMdPath = resolveSafeSkillPath(skillPath, "SKILL.md");

  if (!fs.existsSync(skillMdPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(skillMdPath, "utf-8");
    const stat = fs.statSync(skillMdPath);
    const parsed = parseSkillMarkdown(content, safeName);
    const config = loadSkillsConfig();

    const isExplicitlyDisabled = config.disabledSkills.includes(safeName);
    const customMeta = config.customMetadata[safeName] || {};

    return {
      name: parsed.metadata.name || safeName,
      description: parsed.metadata.description || "No description provided.",
      license: parsed.metadata.license,
      compatibility: parsed.metadata.compatibility,
      allowedTools: parsed.metadata.allowedTools,
      metadata: parsed.metadata.metadata,
      source: (customMeta.source || parsed.metadata.source || "custom") as SkillSource,
      sourceUrl: customMeta.sourceUrl || parsed.metadata.sourceUrl,
      enabled: isExplicitlyDisabled ? false : (parsed.metadata.enabled ?? true),
      createdAt: stat.birthtimeMs || stat.ctimeMs || Date.now(),
      updatedAt: stat.mtimeMs || Date.now(),
      path: skillMdPath,
      content,
      instructions: parsed.instructions,
      rawYaml: parsed.rawYaml,
    };
  } catch {
    return null;
  }
}

/**
 * Save or update a skill on disk.
 */
export async function saveSkill(params: {
  name: string;
  description?: string;
  content?: string;
  instructions?: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  enabled?: boolean;
  source?: SkillSource;
  sourceUrl?: string;
}): Promise<Skill> {
  const safeName = sanitizeSkillName(params.name);
  const skillsDir = getSkillsDir();
  const skillDir = resolveSafeSkillPath(skillsDir, safeName);

  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true });
  }

  let finalContent = "";

  if (params.content) {
    // If full content is provided, parse and ensure name consistency
    const parsed = parseSkillMarkdown(params.content, safeName);
    finalContent = serializeSkillMarkdown({
      name: safeName,
      description: params.description || parsed.metadata.description || "No description provided.",
      license: params.license || parsed.metadata.license,
      compatibility: params.compatibility || parsed.metadata.compatibility,
      allowedTools: params.allowedTools || parsed.metadata.allowedTools,
      metadata: params.metadata || parsed.metadata.metadata,
      instructions: parsed.instructions,
    });
  } else {
    // Construct from parts
    finalContent = serializeSkillMarkdown({
      name: safeName,
      description: params.description || "No description provided.",
      license: params.license,
      compatibility: params.compatibility,
      allowedTools: params.allowedTools,
      metadata: params.metadata,
      instructions: params.instructions || "# Instructions\n\nProvide step-by-step guidance for this skill.",
    });
  }

  const skillMdPath = resolveSafeSkillPath(skillDir, "SKILL.md");
  fs.writeFileSync(skillMdPath, finalContent, "utf-8");

  // Update config for enabled state & extra metadata
  const config = loadSkillsConfig();
  if (params.enabled !== undefined) {
    if (params.enabled) {
      config.disabledSkills = config.disabledSkills.filter((s) => s !== safeName);
    } else {
      if (!config.disabledSkills.includes(safeName)) {
        config.disabledSkills.push(safeName);
      }
    }
  }

  if (params.source || params.sourceUrl) {
    config.customMetadata[safeName] = {
      ...(config.customMetadata[safeName] || {}),
      source: params.source,
      sourceUrl: params.sourceUrl,
    };
  }

  saveSkillsConfig(config);

  const updated = await getSkill(safeName);
  if (!updated) {
    throw new Error(`Failed to read back saved skill: ${safeName}`);
  }
  return updated;
}

/**
 * Toggle enable/disable status for a skill.
 */
export async function toggleSkill(name: string, enabled: boolean): Promise<Skill | null> {
  const safeName = sanitizeSkillName(name);
  const skill = await getSkill(safeName);
  if (!skill) return null;

  const config = loadSkillsConfig();
  if (enabled) {
    config.disabledSkills = config.disabledSkills.filter((s) => s !== safeName);
  } else {
    if (!config.disabledSkills.includes(safeName)) {
      config.disabledSkills.push(safeName);
    }
  }
  saveSkillsConfig(config);

  return getSkill(safeName);
}

/**
 * Delete a skill and its directory from disk.
 */
export async function deleteSkill(name: string): Promise<boolean> {
  const safeName = sanitizeSkillName(name);
  const skillsDir = getSkillsDir();
  const skillDir = resolveSafeSkillPath(skillsDir, safeName);

  if (!fs.existsSync(skillDir)) {
    return false;
  }

  try {
    fs.rmSync(skillDir, { recursive: true, force: true });

    // Clean up from config
    const config = loadSkillsConfig();
    config.disabledSkills = config.disabledSkills.filter((s) => s !== safeName);
    delete config.customMetadata[safeName];
    saveSkillsConfig(config);

    return true;
  } catch (err) {
    console.error(`Failed to delete skill ${safeName}:`, err);
    return false;
  }
}
