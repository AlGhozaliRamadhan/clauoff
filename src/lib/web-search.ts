/**
 * Web search module — server-side only.
 * ADR-0006: opt-in, server-side, privacy-preserving web search.
 *
 * Uses a multi-provider strategy for reliable, free, no-API-key searching:
 *  1. DuckDuckGo HTML (primary) — real web search results
 *  2. Wikipedia API (fallback) — reliable knowledge lookups
 *
 * All requests go through Next.js server-side route handlers.
 * No API keys required. No telemetry. No outbound calls beyond the
 * search endpoints themselves.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

/* ─── DuckDuckGo HTML scraper ─────────────────────────────────────── */

/**
 * Scrape DuckDuckGo's static HTML endpoint for real web search results.
 * This endpoint is specifically designed for non-JS clients and returns
 * server-rendered HTML that we can parse without a headless browser.
 */
async function duckDuckGoSearch(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo returned status ${response.status}`);
    }

    const html = await response.text();
    return parseDuckDuckGoHTML(html, maxResults);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse DuckDuckGo static HTML search results.
 * The HTML structure uses `.result` containers with:
 *   - `.result__a` for the title link (href + text)
 *   - `.result__snippet` for the description
 *   - `.result__url` for the display URL
 */
function parseDuckDuckGoHTML(
  html: string,
  maxResults: number,
): SearchResult[] {
  const results: SearchResult[] = [];

  // Match individual result blocks. DuckDuckGo wraps each result in a
  // div with class "result results_links results_links_deep web-result"
  // or similar. We look for the result__a (title link) and result__snippet.
  const resultBlockRegex =
    /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*result|$)/gi;

  // Simpler approach: find all title links and their sibling snippets
  // by looking for the known class patterns.
  const titleLinkRegex =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex =
    /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  const urlRegex =
    /<a[^>]*class="[^"]*result__url[^"]*"[^>]*[^>]*>([\s\S]*?)<\/a>/gi;

  // Collect all title links
  const titles: { href: string; text: string }[] = [];
  let match;
  while ((match = titleLinkRegex.exec(html)) !== null) {
    let href = match[1];
    // DuckDuckGo wraps URLs in a redirect: //duckduckgo.com/l/?uddg=ENCODED_URL
    if (href.includes("uddg=")) {
      const uddg = href.match(/uddg=([^&]*)/);
      if (uddg) {
        try {
          href = decodeURIComponent(uddg[1]);
        } catch {
          // Keep original if decoding fails
        }
      }
    }
    titles.push({
      href,
      text: stripHtml(match[2]),
    });
  }

  // Collect all snippets
  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtml(match[1]));
  }

  // Build results
  for (let i = 0; i < Math.min(titles.length, maxResults); i++) {
    const title = titles[i];
    if (!title.text.trim() || !title.href.trim()) continue;
    // Skip DuckDuckGo internal links
    if (
      title.href.startsWith("/") &&
      !title.href.startsWith("//")
    )
      continue;

    results.push({
      title: title.text,
      url: title.href.startsWith("//")
        ? `https:${title.href}`
        : title.href,
      snippet: snippets[i] || "",
      source: "DuckDuckGo",
    });
  }

  return results;
}

/* ─── Wikipedia API (fallback) ────────────────────────────────────── */

/**
 * Search Wikipedia for knowledge-focused results.
 * Reliable, fast, and always available — good fallback when DDG fails.
 */
async function wikipediaSearch(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&utf8=&format=json&srlimit=${maxResults}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "CogitoSearch/1.0 (local-ai-chat-app)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Wikipedia API returned status ${response.status}`);
    }

    const json = await response.json();
    const results: SearchResult[] = [];

    if (json.query && json.query.search) {
      for (const item of json.query.search) {
        results.push({
          title: item.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
          snippet: stripHtml(item.snippet),
          source: "Wikipedia",
        });
      }
    }

    return results;
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── DuckDuckGo Instant Answer API (supplementary) ───────────────── */

/**
 * Get instant answer / abstract from DuckDuckGo's Instant Answer API.
 * Great for quick facts and definitions. No API key required.
 */
async function duckDuckGoInstantAnswer(
  query: string,
): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "CogitoSearch/1.0 (local-ai-chat-app)",
      },
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const json = await response.json();
    const results: SearchResult[] = [];

    // Abstract (main topic)
    if (json.AbstractText && json.AbstractURL) {
      results.push({
        title: json.Heading || query,
        url: json.AbstractURL,
        snippet: json.AbstractText.substring(0, 300),
        source: "DuckDuckGo Instant",
      });
    }

    // Related topics
    if (json.RelatedTopics) {
      for (const topic of json.RelatedTopics.slice(0, 3)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title:
              topic.Text.split(" - ")[0]?.substring(0, 100) || topic.Text.substring(0, 100),
            url: topic.FirstURL,
            snippet: topic.Text.substring(0, 250),
            source: "DuckDuckGo Instant",
          });
        }
      }
    }

    return results;
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── Main search function (multi-provider) ───────────────────────── */

/**
 * Perform a web search using multiple providers for reliability.
 * Strategy:
 *   1. Try DuckDuckGo HTML (real web results)
 *   2. If that fails or returns nothing, try Wikipedia
 *   3. Supplement with DuckDuckGo Instant Answers for quick facts
 *
 * Never throws — always returns results (possibly empty).
 */
export async function webSearch(
  query: string,
  maxResults: number = 5,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  let results: SearchResult[] = [];
  const errors: string[] = [];

  // ── Primary: DuckDuckGo HTML search ──
  try {
    results = await duckDuckGoSearch(query, maxResults);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "DuckDuckGo search failed";
    errors.push(msg);
  }

  // ── Fallback: Wikipedia (if DDG returned nothing) ──
  if (results.length === 0) {
    try {
      results = await wikipediaSearch(query, maxResults);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Wikipedia search failed";
      errors.push(msg);
    }
  }

  // ── Year-specific boost ──
  // DuckDuckGo's HTML endpoint frequently returns only generic list pages
  // for "X 2023" style queries (List of Nobel laureates, controversies,
  // women laureates) — never the year's actual article, which is exactly
  // the page the model needs. That generic junk led the model to conclude
  // "the 2023 prize doesn't exist" — absence of evidence mistaken for
  // evidence of absence. For queries containing a 4-digit year, run a
  // second, narrower Wikipedia search; the year-specific page (e.g.
  // "2023 Nobel Prize in Physics") ranks top when it exists, and we merge
  // those results ahead of the generic DDG junk.
  const yearQuery = yearSpecificQuery(query);
  if (yearQuery && results.length > 0) {
    try {
      const yearSpecific = await wikipediaSearch(yearQuery, 3);
      results = mergeYearBoost(yearSpecific, results, maxResults);
    } catch {
      // Non-critical — keep DDG results as-is
    }
  }

  // ── Supplement: DDG Instant Answers (non-blocking, adds context) ──
  if (results.length < maxResults) {
    try {
      const instantResults = await duckDuckGoInstantAnswer(query);
      // Only add instant results that don't duplicate existing URLs
      const existingUrls = new Set(results.map((r) => r.url));
      for (const ir of instantResults) {
        if (!existingUrls.has(ir.url) && results.length < maxResults) {
          results.push(ir);
          existingUrls.add(ir.url);
        }
      }
    } catch {
      // Non-critical — silently ignore
    }
  }

  // If everything failed, return empty (the tool handler in tools.ts
  // will tell the model the search found nothing — and that it must NOT
  // invent facts to fill the gap)
  return results;
}

/* ─── Utilities ───────────────────────────────────────────────────── */

/** Strip HTML tags and decode common entities */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    // Decode the full common set — &#039; / &#39; / &quot; / &#34; / &apos; /
    // &#x27; / &#x22; all end up as real quotes, not literal entity text
    // that can confuse a local model or a strict proxy body scanner.
    .replace(/&#0*39;/g, "'")
    .replace(/&#0*34;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x22;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract the year-specific query from a query containing a 4-digit year.
 * "nobel prize physics 2023 laureates" → "2023 nobel prize physics laureates"
 * (year moved to front, original year removed). Exported for tests.
 */
export function yearSpecificQuery(query: string): string | null {
  const year = query.match(/\b(19|20)\d{2}\b/);
  if (!year) return null;
  // Replace year with a marker, then collapse double spaces from the gap
  const rest = query
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${year[0]} ${rest}`.trim();
}

/**
 * Merge year-specific Wikipedia results ahead of the generic DDG results,
 * without duplicates. Exported for tests.
 */
export function mergeYearBoost(
  yearResults: SearchResult[],
  existing: SearchResult[],
  maxResults: number,
): SearchResult[] {
  const existingUrls = new Set(existing.map((r) => r.url));
  const boosted = yearResults.filter((r) => !existingUrls.has(r.url));
  return [...boosted, ...existing].slice(0, maxResults + boosted.length);
}

/**
 * Format search results into a context string for injection into the
 * LLM conversation as a system message.
 */
export function formatSearchResultsForLLM(results: SearchResult[]): string {
  if (results.length === 0) {
    return "Web search returned no results. Do NOT invent or guess facts to answer. If the user's question asks for factual information, say clearly that you couldn't verify it. If the question is creative, opinion-based, or about the conversation itself, answer normally.";
  }

  // Cap each snippet so the accumulated continuation payload stays lean —
  // a 5-result search at ~2000 chars each would otherwise push the second
  // request well past what a small local model (and a picky tunnel proxy)
  // likes to swallow.
  const SNIPPET_CAP = 500;
  const formatted = results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}${r.source ? ` (via ${r.source})` : ""}\n    URL: ${r.url}\n    ${
          r.snippet.length > SNIPPET_CAP ? `${r.snippet.slice(0, SNIPPET_CAP)}…` : r.snippet
        }`,
    )
    .join("\n\n");

  return `Web Search Results:\n\n${formatted}\n\nUse these search results to inform your answer. Cite sources by referencing their URLs when relevant. You MUST NOT invent facts that are not present in the search results — no fabricated names, dates, numbers, or affiliations. If the search results don't contain the information the user asked for, say so explicitly and do not answer from memory. If the user's question is creative, opinion-based, or about the conversation itself, you may answer normally without searching.`;
}
