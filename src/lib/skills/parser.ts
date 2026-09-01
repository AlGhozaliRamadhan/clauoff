/**
 * Claude & Agent Skills Parser & Serializer (ADR-0013).
 *
 * Conforms to the open Agent Skills standard (SKILL.md) with YAML frontmatter.
 */

import type { SkillMetadata } from "./types";

/**
 * Validates a skill name according to Agent Skills standard:
 * - 1 to 64 characters
 * - Lowercase alphanumeric and hyphens only (a-z, 0-9, -)
 * - Cannot start or end with a hyphen
 * - Cannot contain consecutive hyphens (--)
 */
export function validateSkillName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Skill name is required." };
  }
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 64) {
    return { valid: false, error: "Skill name must be between 1 and 64 characters." };
  }
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: "Skill name must contain only lowercase alphanumeric characters and hyphens (a-z, 0-9, -).",
    };
  }
  if (trimmed.startsWith("-") || trimmed.endsWith("-")) {
    return { valid: false, error: "Skill name cannot start or end with a hyphen." };
  }
  if (trimmed.includes("--")) {
    return { valid: false, error: "Skill name cannot contain consecutive hyphens." };
  }
  return { valid: true };
}

/**
 * Sanitizes any raw name to a valid skill identifier.
 */
export function sanitizeSkillName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
    .slice(0, 64) || "unnamed-skill";
}

/**
 * Parses simple YAML frontmatter without external dependencies.
 */
export function parseSkillMarkdown(
  markdown: string,
  fallbackName?: string,
): {
  metadata: Partial<SkillMetadata>;
  instructions: string;
  rawYaml?: string;
} {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const fmRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = normalized.match(fmRegex);

  if (!match) {
    // No frontmatter present
    const firstLine = normalized.trim().split("\n")[0] || "";
    const titleMatch = firstLine.match(/^#\s+(.+)$/);
    const inferredName = titleMatch
      ? sanitizeSkillName(titleMatch[1])
      : fallbackName || "custom-skill";

    return {
      metadata: {
        name: inferredName,
        description: firstLine.replace(/^#+\s*/, "").trim() || "Custom user skill",
        enabled: true,
      },
      instructions: normalized.trim(),
    };
  }

  const rawYaml = match[1];
  const instructions = match[2].trim();
  const metadata: Partial<SkillMetadata> = {
    enabled: true,
  };

  const lines = rawYaml.split("\n");
  let currentKey: string | null = null;
  let multilineBuffer: string[] = [];
  let isFolded = false;
  let metadataMap: Record<string, string> = {};
  let inMetadataBlock = false;

  const flushMultiline = () => {
    if (currentKey) {
      const joined = isFolded
        ? multilineBuffer.join(" ").trim()
        : multilineBuffer.join("\n").trim();

      if (currentKey === "name") {
        metadata.name = joined;
      } else if (currentKey === "description") {
        metadata.description = joined;
      } else if (currentKey === "license") {
        metadata.license = joined;
      } else if (currentKey === "compatibility") {
        metadata.compatibility = joined;
      }
    }
    currentKey = null;
    multilineBuffer = [];
    isFolded = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for nested metadata block indent
    if (inMetadataBlock) {
      const metaMatch = line.match(/^\s{2,}([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (metaMatch) {
        const k = metaMatch[1];
        const v = metaMatch[2].trim().replace(/^["']|["']$/g, "");
        metadataMap[k] = v;
        continue;
      } else if (line.trim().length > 0 && !line.startsWith(" ")) {
        inMetadataBlock = false;
        metadata.metadata = metadataMap;
      }
    }

    // Top-level key match: key: value or key: >- or key: |
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyMatch) {
      flushMultiline();
      const key = keyMatch[1].toLowerCase();
      const value = keyMatch[2].trim();

      if (key === "metadata" && (value === "" || value === "{}")) {
        inMetadataBlock = true;
        metadataMap = {};
        continue;
      }

      if (value === ">-" || value === ">" || value === "|") {
        currentKey = key;
        isFolded = value.startsWith(">");
        multilineBuffer = [];
        continue;
      }

      const cleanVal = value.replace(/^["']|["']$/g, "");

      if (key === "name") {
        metadata.name = cleanVal;
      } else if (key === "description") {
        metadata.description = cleanVal;
      } else if (key === "license") {
        metadata.license = cleanVal;
      } else if (key === "compatibility") {
        metadata.compatibility = cleanVal;
      } else if (key === "allowed-tools" || key === "allowed_tools") {
        metadata.allowedTools = cleanVal
          ? cleanVal.split(/[\s,]+/).filter(Boolean)
          : [];
      } else if (key === "enabled") {
        metadata.enabled = cleanVal.toLowerCase() !== "false";
      } else if (key === "source") {
        metadata.source = cleanVal as SkillMetadata["source"];
      } else if (key === "sourceurl" || key === "source_url") {
        metadata.sourceUrl = cleanVal;
      }
    } else if (currentKey && (line.startsWith("  ") || line.startsWith("\t") || line.trim() === "")) {
      // Continuation of multiline string
      multilineBuffer.push(line.trim());
    }
  }
  flushMultiline();

  if (inMetadataBlock && Object.keys(metadataMap).length > 0) {
    metadata.metadata = metadataMap;
  }

  // Ensure name fallback
  if (!metadata.name && fallbackName) {
    metadata.name = sanitizeSkillName(fallbackName);
  } else if (metadata.name) {
    metadata.name = sanitizeSkillName(metadata.name);
  } else {
    metadata.name = "unnamed-skill";
  }

  if (!metadata.description) {
    metadata.description = "No description provided.";
  }

  return {
    metadata,
    instructions,
    rawYaml,
  };
}

/**
 * Serializes a skill object to standard SKILL.md format with YAML frontmatter.
 */
export function serializeSkillMarkdown(skill: {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string[];
  metadata?: Record<string, string>;
  instructions: string;
}): string {
  const safeName = sanitizeSkillName(skill.name);
  const lines: string[] = ["---", `name: ${safeName}`];

  // Description formatting
  const desc = (skill.description || "").trim();
  if (desc.includes("\n") || desc.length > 80) {
    lines.push("description: >-");
    const chunks = desc.split("\n");
    for (const chunk of chunks) {
      lines.push(`  ${chunk.trim()}`);
    }
  } else {
    lines.push(`description: ${desc.replace(/"/g, '\\"')}`);
  }

  if (skill.license) {
    lines.push(`license: ${skill.license}`);
  }
  if (skill.compatibility) {
    lines.push(`compatibility: ${skill.compatibility}`);
  }
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    lines.push(`allowed-tools: ${skill.allowedTools.join(" ")}`);
  }
  if (skill.metadata && Object.keys(skill.metadata).length > 0) {
    lines.push("metadata:");
    for (const [k, v] of Object.entries(skill.metadata)) {
      lines.push(`  ${k}: "${String(v).replace(/"/g, '\\"')}"`);
    }
  }

  lines.push("---");
  lines.push("");
  lines.push((skill.instructions || "").trim());
  lines.push("");

  return lines.join("\n");
}
