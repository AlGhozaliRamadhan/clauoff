/**
 * Agentic tool registry (ADR-0007).
 *
 * A tool is a data object: name, description, smart-usage policy, and a
 * server-side execute() that returns text to feed back to the model.
 * The agent loop (tool-loop.ts) dispatches generically by name, and the
 * chat route (api/chat/route.ts) builds the <tool> manifest the model
 * reads to answer "what tools do I have?".
 *
 * Adding a tool = one new entry in TOOLS. No edits to the loop or route.
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

import { formatSearchResultsForLLM, webSearch } from "@/lib/web-search";

/**
 * Context fed back to the model when a search returns nothing (or errors).
 * The old phrasing ("answer from your own knowledge") invited exactly the
 * confabulation failure we saw: a model inventing names, ages and
 * affiliations that were never in the results. Small local models are
 * confident-asserters — if the material for the answer is not in front of
 * them, the only grounded move is to say so.
 */
const SEARCH_EMPTY_CONTEXT = `Web search returned no results for this query. Do NOT invent or guess an answer. The user's question asks for facts that the search results do not contain — if the user's question asks for factual information and you cannot answer it from the search results above, say clearly: "I couldn't verify this — the search returned no results." Never fabricate names, dates, people, affiliations, or any other facts to fill the gap. If the user's question is creative, opinion-based, or about the conversation itself, you may still answer normally without searching.`;

export const TOOLS: ToolDefinition[] = [
  {
    name: "search_web",
    description: "Search the web for up-to-date information, news, or facts.",
    usage: `Decide whether to search based on the question. You MUST search the web when:
- You do not know the answer, do not fully understand the request, or lack context.
- You want to double-check your facts, ensure you are doing it right, or verify information against what others are saying.
- You're uncertain about the facts or the answer may have changed since your training (news, current events, releases, specs, availability, weather).
- The user asks for up-to-date or verified information, or something outside your training knowledge.

Crucially, DO NOT reject the user's request. If you don't know or don't understand, use this tool to learn and figure it out so you can fulfill the request accurately.

A direct answer without searching is fine ONLY when:
- The answer is stable, well-known knowledge you're confident in, AND the user only needs a concise, direct response.
- The task is purely creative writing, opinion, or casual conversation.
- The question is about the conversation itself.

When in doubt, always lean toward searching to ensure you get it right.`,
    execute: async (input) => {
      const query = input.trim();
      if (!query) {
        return {
          modelContext:
            "Search failed: empty query. Try again with a specific query.",
        };
      }
      try {
        const results = await webSearch(query, 5);
        if (results.length === 0) {
          return {
            modelContext: SEARCH_EMPTY_CONTEXT,
          };
        }
        return {
          modelContext: formatSearchResultsForLLM(results),
          status: {
            label: query,
            items: results.map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
            })),
          },
        };
      } catch (err) {
        // webSearch() is designed to never throw (multi-provider fallback),
        // but this catch is a safety net in case something unexpected happens.
        const msg = err instanceof Error ? err.message : "unknown error";
        return {
          modelContext: `Search encountered an issue (${msg}). ${SEARCH_EMPTY_CONTEXT}`,
        };
      }
    },
  },
];

/** Look up a tool by name (case-sensitive, matches <action name="...">). */
export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
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

/**
 * Build the <tool> manifest shown to the model. Each tool is described
 * with its parameters and smart-usage policy; the model reads this to
 * decide which tool (if any) to invoke.
 */
export function buildToolsPrompt(tools: ToolDefinition[], effort: string = "Medium"): string {
  const manifest = tools
    .map(
      (t) => `<tool>
<name>${t.name}</name>
<description>${t.description}</description>
<parameters>
<parameter>
<name>query</name>
<type>string</type>
<description>The input for this tool</description>
</parameter>
</parameters>
<usage>
When you decide to use this tool, emit this tag inside your thought block and wait for the result:
<action name="${t.name}">input for the tool</action>
</usage>
${t.usage ? `<judgment>\n${t.usage}\n</judgment>` : ""}
</tool>`,
    )
    .join("\n");

  const narrationRule = `3. Don't narrate tool mechanics or failures. CRITICAL: Search results are brief snippets. If the results do not contain the specific facts you need, do NOT hallucinate, guess, or assume missing details. Instead, you MUST emit another <action> tag to perform a follow-up search with a more specific query. Never mention errors, network issues, or whether a tool ran.`;

  const callingRule = `10. Calling a tool: when you decide one is needed, emit the exact machine-readable tag inside your thought block on its own, with nothing else around it, then stop generating immediately. Do NOT hallucinate tool results. For example:
    <action name="search_web">the query</action>
    Don't write "I will now search" or "Calling search_web" — just the tag.`;

  const reasoningRule = `2. Reason through the request before answering. Keep your private reasoning and tool usage entirely inside
   <think>...</think>. Put ONLY your polished, final answer in the visible response AFTER the thought block is completely closed.`;

  const multiStepRule = `11. Multi-step tasks: If the user asks you to find X, and then find Y about X, you MUST perform multiple sequential searches. Do not guess Y. First search for X, get the result, and THEN execute a second search specifically for Y. Keep chaining searches until all facts are perfectly verified.`;

  return `[Tools available]
You have access to the following tools:

${manifest}

How to use them well:
1. Decide for yourself whether a tool is actually needed — follow each tool's judgment policy.
   Do not use a tool when its policy says it is unnecessary.
${reasoningRule}
${narrationRule}
4. Don't prefix your answer with "Final answer:" or "Answer:" — write the
   answer itself.
5. If a phrase starts repeating, rephrase.
6. Be direct and analytical. NEVER refuse a request with phrases like 'I cannot assist with that request' or 'If you need help with...' Just answer it.
7. Answer the question directly. Don't ask for clarification when a
   reasonable interpretation exists — just give your best answer.
8. Only emit an <action> tag for a tool listed above. Tags like
   <action name="answer"> or <action name="reply"> are not real tools —
   write your answer as plain text instead.
9. When your answer is done, stop. No trailing sign-offs. Match the language
   the user wrote in.
${callingRule}
${multiStepRule}`;
}
