/**
 * Claude & Agent Skills Types and Specification (ADR-0013).
 *
 * Implements the open Agent Skills standard (SKILL.md) for modular,
 * portable packages of saved instructions, workflows, and expertise.
 */

export type SkillSource = "builtin" | "custom" | "downloaded" | "github";

export interface SkillMetadata {
  /** 1-64 chars, lowercase alphanumeric + hyphens. Must match directory name. */
  name: string;
  /** Max 1024 chars. Explains what the skill does and when the agent should use it. */
  description: string;
  /** Optional license (e.g. MIT, Apache-2.0). */
  license?: string;
  /** Optional compatibility requirements (max 500 chars). */
  compatibility?: string;
  /** Experimental space-separated or array of allowed tools. */
  allowedTools?: string[];
  /** Arbitrary key-value metadata. */
  metadata?: Record<string, string>;
  /** Where this skill originated. */
  source?: SkillSource;
  /** Original URL if downloaded from GitHub or web. */
  sourceUrl?: string;
  /** Whether the skill is enabled and visible to the model. */
  enabled: boolean;
  /** Timestamp created in ms. */
  createdAt: number;
  /** Timestamp last modified in ms. */
  updatedAt: number;
  /** Relative or absolute directory path on disk. */
  path?: string;
}

export interface Skill extends SkillMetadata {
  /** Complete markdown content including frontmatter. */
  content: string;
  /** Markdown instructions body (without frontmatter). */
  instructions: string;
  /** Raw YAML frontmatter string if parsed from file. */
  rawYaml?: string;
}

export interface CuratedSkill {
  id: string;
  name: string;
  description: string;
  category: "Development" | "Security" | "Review" | "Productivity" | "Architecture" | "Testing" | "Prompting";
  author: string;
  tags: string[];
  skillMd: string;
  icon?: string;
  sourceUrl?: string;
}

export interface SkillCatalogResponse {
  skills: Skill[];
  curated: CuratedSkill[];
  totalInstalled: number;
  totalEnabled: number;
}
