import { describe, it, expect } from "vitest";
import { normalizeDownloadUrl } from "@/lib/skills/downloader";

describe("Skills Downloader URL Normalizer", () => {
  it("normalizes direct raw GitHub URLs", () => {
    const res = normalizeDownloadUrl(
      "https://raw.githubusercontent.com/owner/my-repo/main/skills/security-auditor/SKILL.md"
    );
    expect(res.rawUrls[0]).toBe(
      "https://raw.githubusercontent.com/owner/my-repo/main/skills/security-auditor/SKILL.md"
    );
    expect(res.inferredName).toBe("security-auditor");
  });

  it("normalizes GitHub blob SKILL.md URLs", () => {
    const res = normalizeDownloadUrl(
      "https://github.com/anthropics/anthropic-skills/blob/main/skills/code-reviewer/SKILL.md"
    );
    expect(res.rawUrls[0]).toBe(
      "https://raw.githubusercontent.com/anthropics/anthropic-skills/main/skills/code-reviewer/SKILL.md"
    );
    expect(res.inferredName).toBe("code-reviewer");
  });

  it("normalizes GitHub tree folder URLs", () => {
    const res = normalizeDownloadUrl(
      "https://github.com/anthropics/anthropic-skills/tree/main/skills/sql-optimizer"
    );
    expect(res.rawUrls).toContain(
      "https://raw.githubusercontent.com/anthropics/anthropic-skills/main/skills/sql-optimizer/SKILL.md"
    );
    expect(res.inferredName).toBe("sql-optimizer");
  });

  it("normalizes GitHub repository root URLs", () => {
    const res = normalizeDownloadUrl("https://github.com/user/my-custom-skill");
    expect(res.rawUrls[0]).toContain("https://raw.githubusercontent.com/user/my-custom-skill/main/SKILL.md");
    expect(res.inferredName).toBe("my-custom");
  });
});
