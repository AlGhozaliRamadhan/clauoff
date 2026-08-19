import { describe, it, expect } from "vitest";
import { TOOLS, findTool, buildToolsPrompt, toToolResultsTag } from "../tools";

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
  });
});
