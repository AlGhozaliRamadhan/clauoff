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

export type {
  ToolStatusItem,
  ToolStatus,
  ToolExecution,
  ToolDefinition,
} from './tool-parser';

export { parseAnyToolCall, toToolResultsTag, cleanToolInput } from './tool-parser';

import type { ToolDefinition } from './tool-parser';
import { cleanToolInput } from './tool-parser';
import { formatSearchResultsForLLM, webSearch, fetchWebPage } from '@/lib/web-search';
import { searchCveByKeyword, formatCveForLLM } from '@/lib/utils/cve-explorer';

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
    name: 'search_web',
    description: 'Search the web for up-to-date information, news, or facts.',
    usage: `Decide whether to search based on the question. You MUST search the web when:
- You do not know the answer, do not fully understand the request, or lack context.
- You want to double-check facts, algorithms, formulas, APIs, parameters, or documentation to ensure accuracy.
- The question asks for recommendations, comparisons, best approaches, or tradeoffs.
- The question concerns anything that could have changed: recent events, news, prices, versions, release dates, software/library versions, security advisories, personnel, organizational details, statistics, rankings, or "what is the current state of X".
- A confident wrong answer would mislead the user. When in doubt, search — a wrong confident answer is worse than a short verified one.

Do NOT skip verification just because you "feel confident." Small local models are known to confidently assert fabricated names, dates, and affiliations. Treat that instinct as a signal to verify, not as permission to answer from memory.

Human-like Search Strategy:
- Formulate natural, context-rich queries that capture the exact goal, comparison, or problem constraints rather than dry, disjointed single words.
- Think multi-angle: If a problem involves conditional choices or multiple dimensions, search the primary angle first, evaluate what you find, and then follow up with targeted searches on the dependent aspects or alternatives.
- If initial results are broad or leave unanswered gaps, reformulate your query to investigate the specific missing pieces before writing your answer.
- After getting results, check whether the snippets actually contain the specific facts you need. If they don't, run a follow-up search with a more specific query instead of guessing.

Crucially, DO NOT reject the user's request. If you don't know or don't understand, use this tool to learn and figure it out so you can fulfill the request accurately.

A direct answer without searching is fine ONLY when:
- The task is purely creative writing, opinion, or casual conversation.
- The question is about the conversation itself.
- The question is a stable, well-known fact that has not changed for years (e.g., "what is 2+2", "what does HTTP stand for"), and you have no uncertainty about it.

After searching: when your visible reply uses a specific fact, number, name, date, version, or URL that came from the search results, cite the source inline (e.g. "according to [Source Title](url)" or "[Source Title]"). The user should be able to see where each claim came from.`,
    execute: async (input) => {
      const query = cleanToolInput(input);
      if (!query) {
        return {
          modelContext:
            'Search failed: empty query. You must provide real search keywords directly inside the tag (e.g. <action name="search_web">who won nobel prize in physics 2024</action>). Do NOT write placeholder text like "query=" or empty quotes.',
        };
      }
      try {
        const results = await webSearch(query, 16);
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
        const msg = err instanceof Error ? err.message : 'unknown error';
        return {
          modelContext: `Search encountered an issue (${msg}). ${SEARCH_EMPTY_CONTEXT}`,
        };
      }
    },
  },
  {
    name: 'fetch_web_page',
    description: 'Fetch and read the readable content or article text of any URL.',
    usage: `Use this tool when search_web provides a relevant link, documentation URL, or article that you want to inspect in full detail.
Emit the tag:
<action name="fetch_web_page">https://example.com/page-to-read</action>`,
    execute: async (input) => {
      const url = input.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return {
          modelContext: 'fetch_web_page error: input must be a valid http or https URL.',
        };
      }
      try {
        const page = await fetchWebPage(url, 4000);
        return {
          modelContext: `Content of ${page.title} (${page.url}):\n\n${page.content}`,
          status: {
            label: `Read ${page.title}`,
            items: [{ title: page.title, url: page.url, snippet: page.content.substring(0, 300) }],
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'failed to fetch page';
        return {
          modelContext: `fetch_web_page error: could not read ${url} (${msg}).`,
        };
      }
    },
  },
  {
    name: 'cve_explorer',
    description:
      'Search and inspect CVE security vulnerabilities, CVSS scores, affected software versions, CWEs, and official mitigation advisories from MITRE, NIST NVD, and OSV databases.',
    usage: `Use this tool when:
- The question asks about a specific CVE (e.g. CVE-2024-3094, CVE-2021-44228, CVE-2023-38606).
- You need to inspect known security vulnerabilities, CVSS severity ratings, attack vectors, or security advisories for a software library, package, or component.
- You need authoritative CWE classifications, affected package version ranges, or vendor patch links.

Emit the tool inside your thought block with a CVE ID or software keyword:
<action name="cve_explorer">CVE-2024-3094</action>
or
<action name="cve_explorer">spring framework rce</action>`,
    execute: async (input) => {
      const query = cleanToolInput(input);
      if (!query) {
        return {
          modelContext:
            'cve_explorer error: please specify a CVE identifier (e.g. CVE-2024-3094) or software keyword.',
        };
      }
      try {
        const result = await searchCveByKeyword(query);
        const context = formatCveForLLM(result);

        let label = `CVE Explorer: ${query}`;
        let items: Array<{ title: string; url?: string; snippet?: string }> = [];

        if (result.isSpecificCve && result.cve) {
          label = `CVE: ${result.cve.id} (${result.cve.severity || result.cve.cvssScore || 'Details'})`;
          items = [
            {
              title: `${result.cve.id}: ${result.cve.title}`,
              snippet: `${result.cve.cvssScore ? `[CVSS ${result.cve.cvssScore} ${result.cve.severity || ''}] ` : ''}${result.cve.description.substring(0, 300)}`,
              url: result.cve.references?.[0],
            },
          ];
        } else if (result.searchResults && result.searchResults.length > 0) {
          items = result.searchResults.map((r) => ({
            title: r.id,
            snippet: `${r.score ? `[CVSS ${r.score} ${r.severity || ''}] ` : ''}${r.description}`,
            url: `https://nvd.nist.gov/vuln/detail/${r.id}`,
          }));
        }

        return {
          modelContext: context,
          status: {
            label,
            items:
              items.length > 0
                ? items
                : [{ title: `Lookup: ${query}`, snippet: 'Search completed' }],
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown error';
        return {
          modelContext: `cve_explorer encountered an issue (${msg}).`,
        };
      }
    },
  },
  {
    name: 'run_python',
    description:
      'Execute Python code in a sandboxed subprocess and return stdout/stderr.',
    usage: `Use this tool when you need to:
- Run calculations, data transformations, or numerical verification.
- Test or validate code logic.
- Generate text output from scripts.

Do NOT use this tool for:
- Tasks that can be answered directly from knowledge without computation.
- Questions that only need a web search.

Emit the tool like this inside your thought block:
<action name="run_python">
print("Hello from sandbox")
</action>

The code runs in an isolated Python subprocess with a 30-second timeout. Only stdout and stderr are captured and returned.`,
    execute: async (input) => {
      const code = input.trim();
      if (!code) {
        return {
          modelContext:
            'run_python: empty code input. Provide Python code to execute.',
        };
      }
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      try {
        const { stdout, stderr } = await execFileAsync('python', ['-c', code], {
          timeout: 30_000,
          maxBuffer: 1024 * 512,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        const output = [
          stdout?.trim() ? `stdout:\n${stdout.trim()}` : '',
          stderr?.trim() ? `stderr:\n${stderr.trim()}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');
        return {
          modelContext: output || '(no output)',
          status: {
            label: 'Python execution',
            items: [
              {
                title: 'Code executed',
                snippet: output ? output.substring(0, 500) : '(no output)',
              },
            ],
          },
        };
      } catch (err: unknown) {
        const error = err as {
          stderr?: string;
          message?: string;
          killed?: boolean;
        };
        if (error.killed) {
          return {
            modelContext: 'run_python: execution timed out after 30 seconds.',
          };
        }
        const stderr = error.stderr?.trim() || error.message || 'unknown error';
        return {
          modelContext: `run_python error:\n${stderr}`,
          status: {
            label: 'Python execution (error)',
            items: [{ title: 'Error', snippet: stderr.substring(0, 500) }],
          },
        };
      }
    },
  },
  {
    name: 'load_skill',
    description:
      'Load the full instructions, workflow rules, and guidance for a specialized skill by name (e.g. code-reviewer, commit-message-generator, security-auditor).',
    usage: `Use this tool when a task matches an available skill or requires specialized workflows.
Emit the tool inside your thought block with the skill name:
<action name="load_skill">code-reviewer</action>`,
    execute: async (input) => {
      const skillName = cleanToolInput(input).trim();
      if (!skillName) {
        return {
          modelContext: 'load_skill error: please provide a skill name (e.g. <action name="load_skill">code-reviewer</action>).',
        };
      }
      try {
        const { getSkill } = await import('@/lib/skills/storage');
        const skill = await getSkill(skillName);
        if (!skill) {
          return {
            modelContext: `Skill "${skillName}" not found. Ensure the skill name matches an available skill.`,
          };
        }
        return {
          modelContext: `[Skill Loaded: /${skill.name}]\nDescription: ${skill.description}\n\n${skill.instructions}`,
          status: {
            label: `Loaded skill: ${skill.name}`,
            items: [{ title: skill.name, snippet: skill.description }],
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'failed to load skill';
        return {
          modelContext: `load_skill error: could not load "${skillName}" (${msg}).`,
        };
      }
    },
  },
];

let dynamicToolsCache: ToolDefinition[] = [];

/** Look up a tool by name (case-sensitive, matches <action name="...">). */
export function findTool(name: string): ToolDefinition | undefined {
  const found = TOOLS.find((t) => t.name === name);
  if (found) return found;
  return dynamicToolsCache.find((t) => t.name === name);
}

/**
 * Dynamically resolves all active tools: core built-ins + active connectors/MCP tools.
 */
export async function getAllActiveTools(): Promise<ToolDefinition[]> {
  try {
    const { getDynamicConnectorTools } = await import('@/lib/connectors/registry');
    const dynamicTools = await getDynamicConnectorTools();
    dynamicToolsCache = dynamicTools;
    const map = new Map<string, ToolDefinition>();
    for (const t of dynamicTools) {
      map.set(t.name, t);
    }
    for (const t of TOOLS) {
      map.set(t.name, t);
    }
    return Array.from(map.values());
  } catch {
    return TOOLS;
  }
}

/**
 * Build the <tool> manifest shown to the model. Each tool is described
 * with its parameters and smart-usage policy; the model reads this to
 * decide which tool (if any) to invoke.
 */
export function buildToolsPrompt(
  tools: ToolDefinition[],
  effort: string = 'Medium',
): string {
  const manifest = tools
    .map(
      (t) => `<tool>
<name>${t.name}</name>
<description>${t.description}</description>
<usage>
<action name="${t.name}">specific input or keywords</action>
</usage>
${t.usage ? `<judgment>\n${t.usage}\n</judgment>` : ''}
</tool>`,
    )
    .join('\n');

  const narrationRule = `3. Don't narrate tool mechanics or failures. CRITICAL: Search results are brief snippets. If the results do not contain the specific facts you need, do NOT hallucinate, guess, or assume missing details. Instead, you MUST emit another <action> tag to perform a follow-up search with a more specific query. Never mention errors, network issues, or whether a tool ran.`;

  const callingRule = `10. Calling a tool: When you decide a tool is needed, emit the exact machine-readable tag directly inside your thought block (e.g. <action name="search_web">who won nobel prize in physics 2024</action>) and stop generating immediately.
    CRITICAL RULES:
    - ALWAYS place the <action> tag INSIDE your <think> block.
    - NEVER close </think> to search or emit a tool call.
    - NEVER emit raw search queries or tool names as plain text outside <think>.
    - Close </think> ONLY when you are completely finished with all searches and ready to write your final answer to the user.
    - Put the actual search terms directly inside the tag. Never write placeholders like "query=", "“query=”", or empty quotes.`;

  const reasoningRule = `2. Reason through the request before answering. Keep your private reasoning and tool usage entirely inside
   <think>...</think>. Put ONLY your polished, final answer in the visible response AFTER the thought block is completely closed.`;

  const searchStrategyRule = `11. Search Strategy & Human-like Exploration:
    - Search naturally and expressively: Frame search queries to capture the exact relationship, comparison, or problem you are investigating rather than literal or disjointed keyword fragments.
    - Multi-angle & Conditional Search: If evaluating options or conditional scenarios ("what is the best approach for X", "if condition A happens, what about B?"), search the primary question first, evaluate the evidence, and then execute follow-up searches on the dependent angles, trade-offs, or alternatives.
    - Never guess missing links: If an initial search leaves gaps, chain targeted follow-up searches until all details are thoroughly verified before writing your final reply.
    - Default to verifying: if the user's question is about anything that could have changed (recent events, news, prices, versions, release dates, software versions, security advisories, personnel, statistics, rankings, or "current state of X"), use search_web. Treat a confident feeling as a reason to verify, not a reason to skip the search.`;

  const citationRule = `12. Cite sources you actually used. When your visible reply includes a specific fact, number, name, date, version, or URL that came from a search result above, cite that source inline as a markdown link (e.g. "according to [Source Title](url)"). Do not invent citations — only cite URLs and titles you actually saw in the search results. If you answered from knowledge alone (no search was performed), no citation is needed.`;

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
8. Only emit an <action> tag for a real tool listed above (like search_web, fetch_web_page, or run_python). Never emit pseudo-tools or labels like <action name="ask_clarification">, <action name="admit_ignorance">, <action name="generate_code">, <action name="answer">, "ask_clarification", "generate_code", or "Action: answer" — write your questions, code, or answers directly as plain text.
9. When your answer is done, stop. No trailing sign-offs. Match the language
   the user wrote in.
${callingRule}
${searchStrategyRule}
${citationRule}`;
}
