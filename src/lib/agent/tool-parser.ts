/**
 * Client-safe tool parsing utilities and types.
 *
 * This file has NO Node.js dependencies (no child_process, fs, etc.)
 * and can be safely imported by both Server and Client Components.
 */

export interface ToolStatusItem {
  title: string;
  url?: string;
  snippet?: string;
}

/** Structured status surfaced to the UI (e.g. collapsible search results). */
export interface ToolStatus {
  /** Short label for the status line (e.g. the search query) */
  label: string;
  items: ToolStatusItem[];
}

/** Result of a tool execution. */
export interface ToolExecution {
  /** Text fed back to the model as <action_result> context */
  modelContext: string;
  /** Optional structured status for the UI (streamed as <tool_results>) */
  status?: ToolStatus;
}

export interface ToolDefinition {
  /** Must match `<action name="...">` exactly */
  name: string;
  /** What the tool does — shown to the model */
  description: string;
  /** Smart-usage policy for this tool — when to / not to use it */
  usage?: string;
  /** Server-side execution; input is the tag body */
  execute(input: string): Promise<ToolExecution>;
}

/**
 * Clean and unwrap raw tool input string.
 * Strips wrappers like `query="who won"`, `“query=”`, `search_web("...")`, etc.
 */
export function cleanToolInput(rawInput: string): string {
  let input = (rawInput ?? "").trim();

  // Strip JSON object wrapper if present
  if (input.startsWith("{") && input.endsWith("}")) {
    try {
      const parsed = JSON.parse(input);
      input =
        parsed.query ??
        parsed.input ??
        parsed.code ??
        parsed.url ??
        Object.values(parsed)[0] ??
        input;
    } catch {}
  }

  // Strip function call wrapper like search_web("...") or ("...")
  const fnMatch = input.match(
    /^(?:search_web|fetch_web_page|run_python)?\s*\(\s*["'“‘]([\s\S]*?)["'”’]\s*\)$/i,
  );
  if (fnMatch) {
    input = fnMatch[1];
  }

  // Strip common parameter labels: query=, query:, q=, url=, code=, parameter=
  input = input
    .replace(
      /^["'“‘]?\s*(?:query|q|search_query|input|search|parameter|url|code)\s*[:=]\s*["'“‘]?/i,
      "",
    )
    .replace(/["'”’]\s*$/, "")
    .trim();

  // Strip outer quotes
  input = input.replace(/^["'“‘`]+|["'”’`]+$/g, "").trim();

  // If the query is literally just "query=" or "query" or empty placeholder
  if (/^(?:query|q|search|input|parameter|url|code)?\s*[:=]?\s*$/i.test(input)) {
    return "";
  }

  return input;
}

/**
 * Universal tool call parser.
 * Supports:
 *   1. Standard Cogito Action: <action name="search_web">query</action>
 *   2. Qwen XML Function: <tool_call><function=search_web><parameter=query>query</parameter></function></tool_call>
 *   3. JSON Tool Call: <tool_call>{"name":"search_web","arguments":{"query":"query"}}</tool_call>
 *   4. Inline Attribute: <tool_call name="search_web">query</tool_call>
 *   5. Text Formats: Action: search_web\nQuery: query or search_web("query")
 */
export function parseAnyToolCall(block: string): { name: string; input: string } | null {
  if (!block || typeof block !== "string") return null;

  // 1. Qwen XML Function Format
  const qwenFnMatch = block.match(/<function=['"]?([a-zA-Z0-9_-]+)['"]?>([\s\S]*?)<\/function>/i);
  if (qwenFnMatch) {
    const name = qwenFnMatch[1].trim();
    const paramsBody = qwenFnMatch[2];
    const paramMatch = paramsBody.match(/<parameter=[^>]*>([\s\S]*?)<\/parameter>/i);
    const rawInput = paramMatch ? paramMatch[1] : paramsBody;
    return { name, input: cleanToolInput(rawInput) };
  }

  // 2. Qwen / OpenAI JSON Format inside <tool_call>
  const jsonToolMatch = block.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i);
  if (jsonToolMatch) {
    const raw = jsonToolMatch[1].trim();
    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw);
        const name = parsed.name || parsed.function?.name;
        const args = parsed.arguments ?? parsed.parameters ?? parsed.function?.arguments ?? {};
        const rawInput =
          typeof args === "string"
            ? args
            : args.query ?? args.input ?? args.code ?? args.url ?? Object.values(args)[0] ?? JSON.stringify(args);
        if (name) return { name: String(name).trim(), input: cleanToolInput(String(rawInput)) };
      } catch {
        // Fall through
      }
    }
  }

  // 3. Inline attribute <tool_call name="...">
  const attrToolMatch = block.match(/<tool_call\s+name=['"]([^'"]+)['"]>([\s\S]*?)<\/tool_call>/i);
  if (attrToolMatch) {
    return { name: attrToolMatch[1].trim(), input: cleanToolInput(attrToolMatch[2]) };
  }

  // 4. Standard Cogito <action name="...">
  const actionMatch = block.match(/<action\s+name=['"]([^'"]+)['"]>([\s\S]*?)<\/action>/i);
  if (actionMatch) {
    return { name: actionMatch[1].trim(), input: cleanToolInput(actionMatch[2]) };
  }

  // 5. Function style: search_web("...") or fetch_web_page("...")
  const fnCallMatch = block.match(/^(?:Action:\s*)?([a-zA-Z0-9_-]+)\s*\(\s*["'“‘]([\s\S]*?)["'”’]\s*\)/i);
  if (fnCallMatch && ["search_web", "fetch_web_page", "run_python"].includes(fnCallMatch[1])) {
    return { name: fnCallMatch[1].trim(), input: cleanToolInput(fnCallMatch[2]) };
  }

  // 6. Action / Query label format:
  // Action: search_web
  // Query: who is the president
  const labeledMatch = block.match(/Action:\s*([a-zA-Z0-9_-]+)\s*(?:\n|:)\s*(?:Query|Input|URL|Code)?\s*[:=]?\s*([\s\S]+)/i);
  if (labeledMatch && ["search_web", "fetch_web_page", "run_python"].includes(labeledMatch[1])) {
    return { name: labeledMatch[1].trim(), input: cleanToolInput(labeledMatch[2]) };
  }

  return null;
}

/**
 * Render a tool's structured status as a <tool_results> tag streamed to the
 * client so the UI can show a collapsible list of what the tool opened.
 */
export function toToolResultsTag(status: ToolStatus): string {
  const items = status.items
    .map(
      (it) =>
        `<item><title>${escapeTag(it.title)}</title>${it.url ? `<url>${escapeTag(it.url)}</url>` : ""}${it.snippet ? `<snippet>${escapeTag(it.snippet)}</snippet>` : ""}</item>`,
    )
    .join("");
  return `<tool_results tool="${escapeTag(status.label)}">${items}</tool_results>`;
}

function escapeTag(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
