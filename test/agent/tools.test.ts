import { describe, it, expect } from "vitest";
import { TOOLS, findTool, buildToolsPrompt, toToolResultsTag } from "@/lib/agent/tools";

describe("tool registry", () => {
  it("registers search_web as the first tool", () => {
    expect(TOOLS.length).toBeGreaterThan(0);
    expect(TOOLS.some((t) => t.name === "search_web")).toBe(true);
  });

  it("finds a tool by name and returns undefined for unknown names", () => {
    expect(findTool("search_web")?.name).toBe("search_web");
    expect(findTool("browse_url")).toBeUndefined();
  });

  it("renders the manifest with the tool schema and usage policy", () => {
    const prompt = buildToolsPrompt(TOOLS);
    expect(prompt).toContain('<name>search_web</name>');
    expect(prompt).toContain('<action name="search_web">');
    expect(prompt).toContain("<judgment>");
  });

  it("serializes structured tool results into an escaped <tool_results> tag", () => {
    const tag = toToolResultsTag({
      label: "bunny & facts",
      items: [
        { title: "A <B> fact", url: "https://example.com/?a=1&b=2", snippet: "x < y" },
      ],
    });
    expect(tag).toContain('tool="bunny &amp; facts"');
    expect(tag).toContain("<item>");
    expect(tag).toContain("<title>A &lt;B&gt; fact</title>");
    expect(tag).toContain("<url>https://example.com/?a=1&amp;b=2</url>");
    expect(tag).toContain("<snippet>x &lt; y</snippet>");
  });

  it("forbids answering from memory when a search returns no results", async () => {
    // Regression for the Nobel-2023 confabulation: the model invented a
    // name, age and affiliation after its search returned nothing. The
    // fallback context must forbid fabricating facts instead of inviting
    // the model to "answer from your own knowledge".
    const tool = findTool("search_web");
    expect(tool).toBeDefined();
    const result = await tool!.execute("nobel prize in physics 2023 youngest winner");
    expect(result.modelContext).toMatch(/MUST NOT invent|Do NOT invent/i);
    expect(result.modelContext).not.toMatch(/answer[^.]*own knowledge/i);
  }, 15000);

  it("finds and executes cve_explorer for security vulnerability lookups", async () => {
    const cveTool = findTool("cve_explorer");
    expect(cveTool).toBeDefined();
    expect(cveTool?.name).toBe("cve_explorer");

    const result = await cveTool!.execute("CVE-2024-3094");
    expect(result.modelContext).toContain("CVE-2024-3094");
    expect(result.modelContext).toMatch(/CVSS|Severity|xz/i);
    expect(result.status?.label).toContain("CVE");
  }, 15000);

  it("finds and executes load_skill for loading skill instructions", async () => {
    const skillTool = findTool("load_skill");
    expect(skillTool).toBeDefined();
    expect(skillTool?.name).toBe("load_skill");

    const result = await skillTool!.execute("code-reviewer");
    expect(result.modelContext).toMatch(/Skill Loaded: \/code-reviewer|code-reviewer/i);
  });

  describe("parseAnyToolCall", () => {
    it("parses standard Cogito <action> format", async () => {
      const { parseAnyToolCall } = await import("@/lib/agent/tools");
      const result = parseAnyToolCall('<action name="search_web">indonesia weather</action>');
      expect(result).toEqual({ name: "search_web", input: "indonesia weather" });
    });

    it("parses Qwen XML function format", async () => {
      const { parseAnyToolCall } = await import("@/lib/agent/tools");
      const result = parseAnyToolCall(
        `<tool_call>\n<function=search_web>\n<parameter=query>\nindonesia weather\n</parameter>\n</function>\n</tool_call>`,
      );
      expect(result).toEqual({ name: "search_web", input: "indonesia weather" });
    });

    it("parses Qwen / OpenAI JSON format", async () => {
      const { parseAnyToolCall } = await import("@/lib/agent/tools");
      const result = parseAnyToolCall(
        `<tool_call>\n{"name":"search_web","arguments":{"query":"indonesia weather"}}\n</tool_call>`,
      );
      expect(result).toEqual({ name: "search_web", input: "indonesia weather" });
    });

    it("parses inline attribute format", async () => {
      const { parseAnyToolCall } = await import("@/lib/agent/tools");
      const result = parseAnyToolCall(
        `<tool_call name="search_web">indonesia weather</tool_call>`,
      );
      expect(result).toEqual({ name: "search_web", input: "indonesia weather" });
    });

    it("unwraps query= parameter prefix and quotes from inputs", async () => {
      const { parseAnyToolCall, cleanToolInput } = await import("@/lib/agent/tools");
      expect(cleanToolInput('query="latest AI news"')).toBe("latest AI news");
      expect(cleanToolInput('“query=who won nobel prize”')).toBe("who won nobel prize");
      expect(cleanToolInput('“query=”')).toBe("");
      expect(cleanToolInput('query=')).toBe("");

      const result = parseAnyToolCall('<action name="search_web">query="who won nobel prize"</action>');
      expect(result).toEqual({ name: "search_web", input: "who won nobel prize" });
    });

    it("parses function call and labeled query formats", async () => {
      const { parseAnyToolCall } = await import("@/lib/agent/tools");
      const fnResult = parseAnyToolCall('search_web("python 3.13 new features")');
      expect(fnResult).toEqual({ name: "search_web", input: "python 3.13 new features" });

      const labelResult = parseAnyToolCall('Action: search_web\nQuery: tokyo weather');
      expect(labelResult).toEqual({ name: "search_web", input: "tokyo weather" });
    });
  });
});
