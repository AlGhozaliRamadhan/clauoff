/**
 * Claude & Agent Skills Downloader (ADR-0013).
 *
 * Downloads and imports skills from GitHub repositories, direct URLs,
 * and Agent Skills registries.
 */

import { parseSkillMarkdown, sanitizeSkillName, validateSkillName } from "./parser";
import { saveSkill } from "./storage";
import type { Skill } from "./types";

/**
 * Converts various GitHub URL formats into direct raw content URLs.
 */
export function normalizeDownloadUrl(inputUrl: string): { rawUrls: string[]; inferredName?: string } {
  const trimmed = inputUrl.trim();

  // 1. Raw GitHub URL already
  if (trimmed.startsWith("https://raw.githubusercontent.com/")) {
    const parts = trimmed.split("/").filter(Boolean);
    // e.g. ["https:", "raw.githubusercontent.com", "owner", "repo", "branch", "skills", "foo", "SKILL.md"]
    let inferredName: string | undefined;
    if (parts.length >= 6) {
      const last = parts[parts.length - 1];
      if (last.toLowerCase() === "skill.md") {
        inferredName = parts[parts.length - 2];
      }
    }
    return { rawUrls: [trimmed], inferredName };
  }

  // 2. GitHub Blob or Tree URL
  // e.g. https://github.com/owner/repo/blob/main/skills/my-skill/SKILL.md
  // or   https://github.com/owner/repo/tree/main/skills/my-skill
  const githubMatch = trimmed.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(blob|tree)\/([^/]+)\/(.+)$/
  );
  if (githubMatch) {
    const [, owner, repo, , branch, restPath] = githubMatch;
    const cleanPath = restPath.replace(/^\/+|\/+$/g, "");

    let inferredName: string | undefined;
    const pathParts = cleanPath.split("/");
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart.toLowerCase() === "skill.md") {
      inferredName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : repo;
      const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}`;
      return { rawUrls: [raw], inferredName };
    } else {
      inferredName = lastPart;
      // Candidate URLs: folder/SKILL.md or folder/skill.md
      const raw1 = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}/SKILL.md`;
      const raw2 = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${cleanPath}/skill.md`;
      return { rawUrls: [raw1, raw2], inferredName };
    }
  }

  // 3. GitHub Root Repo URL
  // e.g. https://github.com/owner/repo
  const githubRepoMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/)?$/);
  if (githubRepoMatch) {
    const [, owner, repo] = githubRepoMatch;
    const inferredName = repo.replace(/-skill$/i, "").replace(/^skill-/i, "");
    return {
      rawUrls: [
        `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/master/SKILL.md`,
        `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${inferredName}/SKILL.md`,
      ],
      inferredName,
    };
  }

  // 4. GitHub Gist URL
  // e.g. https://gist.github.com/user/id
  const gistMatch = trimmed.match(/^https:\/\/gist\.github\.com\/([^/]+)\/([a-f0-9]+)/i);
  if (gistMatch) {
    const [, user, id] = gistMatch;
    return {
      rawUrls: [`https://gist.githubusercontent.com/${user}/${id}/raw/SKILL.md`, `${trimmed}/raw`],
      inferredName: `gist-${id.slice(0, 8)}`,
    };
  }

  // 5. Generic direct URL
  const urlObj = new URL(trimmed);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  let inferredName: string | undefined;
  if (pathParts.length > 0) {
    const last = pathParts[pathParts.length - 1];
    if (last.toLowerCase() === "skill.md" && pathParts.length > 1) {
      inferredName = pathParts[pathParts.length - 2];
    } else {
      inferredName = last.replace(/\.md$/i, "");
    }
  }

  return { rawUrls: [trimmed], inferredName };
}

/**
 * Downloads a skill from a URL and saves it to data/skills/
 */
export async function downloadSkillFromUrl(
  inputUrl: string,
  targetName?: string,
): Promise<Skill> {
  const { rawUrls, inferredName } = normalizeDownloadUrl(inputUrl);

  let markdownContent: string | null = null;
  let lastError: string | null = null;

  for (const url of rawUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Cogito-Skills-Downloader/1.0",
          Accept: "text/plain, text/markdown, */*",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const text = await response.text();
        if (text && text.trim().length > 0 && !text.includes("<!DOCTYPE html>")) {
          markdownContent = text;
          break;
        }
      } else {
        lastError = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Network error";
    }
  }

  if (!markdownContent) {
    throw new Error(
      `Could not download SKILL.md from provided URL (${inputUrl}). ${lastError ? `Details: ${lastError}` : "No valid markdown found."}`
    );
  }

  // Parse and extract frontmatter
  const parsed = parseSkillMarkdown(markdownContent, targetName || inferredName);
  const rawName = targetName || parsed.metadata.name || inferredName || "downloaded-skill";
  const safeName = sanitizeSkillName(rawName);

  const nameValidation = validateSkillName(safeName);
  if (!nameValidation.valid) {
    throw new Error(`Invalid skill name "${safeName}": ${nameValidation.error}`);
  }

  const isGithub = inputUrl.includes("github.com") || inputUrl.includes("githubusercontent.com");

  return saveSkill({
    name: safeName,
    description: parsed.metadata.description || "Downloaded skill",
    content: markdownContent,
    license: parsed.metadata.license,
    compatibility: parsed.metadata.compatibility,
    allowedTools: parsed.metadata.allowedTools,
    metadata: parsed.metadata.metadata,
    source: isGithub ? "github" : "downloaded",
    sourceUrl: inputUrl,
    enabled: true,
  });
}
