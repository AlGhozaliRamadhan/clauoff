/**
 * Universal Multi-Source Web Search & Page Retrieval Module — Server-side only.
 * ADR-0006: Opt-in, server-side, privacy-preserving web intelligence.
 *
 * Blends 7 free, zero-API-key, zero-payment search providers concurrently:
 *  1. Bing Search (General Web) — real web index with base64 decoded direct URLs
 *  2. Google News RSS (News & Current Affairs) — fresh breaking news and articles
 *  3. arXiv API (Science & Academic) — research papers, AI breakthroughs, math & CS
 *  4. Hacker News / Algolia API (Tech & Discussions) — developer insights, tutorials
 *  5. GitHub Search API (Code & Repositories) — open source libraries & frameworks
 *  6. Wikipedia API (Encyclopedia) — deep factual & historical definitions
 *  7. DuckDuckGo Instant Answers (Quick Facts) — instant topic summaries
 *
 * Plus:
 *  8. Web Page Content Fetcher (fetchWebPage) — deep markdown text extraction from any URL
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/* ─── 1. Bing Web Search (General Web) ─────────────────────────────── */

function decodeBingUrl(href: string): string {
  const unescaped = href.replace(/&amp;/g, "&");
  const match = unescaped.match(/[?&]u=a1([^&]+)/);
  if (match) {
    try {
      let b64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      return Buffer.from(b64, "base64").toString("utf-8");
    } catch {
      return unescaped;
    }
  }
  return unescaped;
}

async function bingSearch(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en&cc=US&ensearch=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const html = await response.text();
    const results: SearchResult[] = [];
    const algoBlocks = html.match(/<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi) || [];

    for (const block of algoBlocks) {
      const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch =
        block.match(/<p[^>]*>([\s\S]*?)<\/p>/i) ||
        block.match(/<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

      if (titleMatch) {
        const rawHref = titleMatch[1];
        const directUrl = decodeBingUrl(rawHref);
        const title = stripHtml(titleMatch[2]);
        const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";
        if (directUrl && title && !directUrl.startsWith("/")) {
          results.push({ title, url: directUrl, snippet, source: "Bing" });
          if (results.length >= limit) break;
        }
      }
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── 2. Google News RSS (News & Current Affairs) ──────────────────── */

async function googleNewsSearch(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_500);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": BROWSER_USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const results: SearchResult[] = [];
    const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

    for (const item of items) {
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/i);
      const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

      if (titleMatch && linkMatch) {
        const title = stripHtml(titleMatch[1]);
        const link = linkMatch[1].trim();
        const desc = descMatch ? stripHtml(descMatch[1]) : "";
        const pubDate = pubDateMatch ? pubDateMatch[1].trim() : "";
        if (title && link) {
          results.push({
            title,
            url: link,
            snippet: pubDate ? `[Published: ${pubDate}] ${desc}` : desc,
            source: "Google News",
          });
          if (results.length >= limit) break;
        }
      }
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── 3. arXiv Scientific Papers API ──────────────────────────────── */

async function arxivSearch(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_500);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return [];
    const xml = await response.text();
    const results: SearchResult[] = [];
    const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/gi) || [];

    for (const entry of entries) {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/i);
      const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/i);
      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/i);

      if (titleMatch && idMatch) {
        const title = stripHtml(titleMatch[1]).replace(/\s+/g, " ");
        const url = idMatch[1].trim();
        const summary = summaryMatch ? stripHtml(summaryMatch[1]).replace(/\s+/g, " ") : "";
        results.push({
          title: `[Paper] ${title}`,
          url,
          snippet: summary.length > 400 ? `${summary.slice(0, 400)}…` : summary,
          source: "arXiv",
        });
        if (results.length >= limit) break;
      }
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── 4. Hacker News / Algolia API (Tech & Discussions) ───────────── */

async function hackerNewsSearch(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${limit}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return [];
    const json = await response.json();
    const results: SearchResult[] = [];

    for (const hit of json.hits || []) {
      if (hit.title) {
        const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
        const score = hit.points != null ? `${hit.points} points` : "";
        const comments = hit.num_comments != null ? `${hit.num_comments} comments` : "";
        const stats = [score, comments].filter(Boolean).join(", ");
        results.push({
          title: hit.title,
          url,
          snippet: stats ? `HN Discussion (${stats})` : "Hacker News Article",
          source: "HackerNews",
        });
        if (results.length >= limit) break;
      }
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── 5. GitHub Search API (Code & Repositories) ───────────────────── */

async function githubSearch(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Cogito-App/1.0",
        Accept: "application/vnd.github.v3+json",
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const json = await response.json();
    const results: SearchResult[] = [];

    for (const item of json.items || []) {
      results.push({
        title: `${item.full_name} (${item.stargazers_count} ★)`,
        url: item.html_url,
        snippet: item.description || "GitHub Repository",
        source: "GitHub",
      });
      if (results.length >= limit) break;
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── 6. Wikipedia API (Encyclopedia & Concepts) ───────────────────── */

async function wikipediaSearch(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=${limit}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "CogitoSearch/1.0 (local-ai-chat-app)" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const json = await response.json();
    const results: SearchResult[] = [];

    if (json.query?.search) {
      for (const item of json.query.search) {
        results.push({
          title: item.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
          snippet: stripHtml(item.snippet),
          source: "Wikipedia",
        });
        if (results.length >= limit) break;
      }
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── 7. DuckDuckGo Instant Answers ───────────────────────────────── */

async function duckDuckGoInstantAnswer(query: string): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "CogitoSearch/1.0 (local-ai-chat-app)" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const json = await response.json();
    const results: SearchResult[] = [];

    if (json.AbstractText && json.AbstractURL) {
      results.push({
        title: json.Heading || query,
        url: json.AbstractURL,
        snippet: json.AbstractText.substring(0, 300),
        source: "DuckDuckGo Instant",
      });
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/* ─── 8. Web Page Content Fetcher (Read Any Full URL) ─────────────── */

export async function fetchWebPage(
  targetUrl: string,
  maxChars: number = 4000,
): Promise<{ title: string; url: string; content: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page (HTTP ${response.status})`);
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : targetUrl;

    const readableText = htmlToReadableMarkdown(html);
    const content =
      readableText.length > maxChars
        ? readableText.slice(0, maxChars) + "\n\n...(content truncated)"
        : readableText;

    return {
      title,
      url: targetUrl,
      content: content || "(no readable content found on this page)",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#0*39|#0*34|#x27|#x22);/gi, (match) => {
    const lower = match.toLowerCase();
    if (lower === "&amp;") return "&";
    if (lower === "&lt;") return "<";
    if (lower === "&gt;") return ">";
    if (lower === "&quot;" || lower === "&#034;" || lower === "&#34;" || lower === "&#x22;") return '"';
    if (lower === "&apos;" || lower === "&#039;" || lower === "&#39;" || lower === "&#x27;") return "'";
    if (lower === "&nbsp;") return " ";
    return match;
  });
}

export function htmlToReadableMarkdown(html: string): string {
  const mainMatch =
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    html.match(/<div[^>]*id="mw-content-text"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*id="catlinks"/i) ||
    html.match(/<div[^>]*class="[^"]*(?:article-content|post-content|main-content|entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  let targetHtml = mainMatch ? mainMatch[1] : html;

  let prev = "";
  do {
    prev = targetHtml;
    targetHtml = targetHtml
      .replace(/<script\b[^<]*(?:(?!<\/script\s*>)<[^<]*)*<\/script\s*>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style\s*>)<[^<]*)*<\/style\s*>/gi, "")
      .replace(/<svg\b[^<]*(?:(?!<\/svg\s*>)<[^<]*)*<\/svg\s*>/gi, "")
      .replace(/<nav\b[^<]*(?:(?!<\/nav\s*>)<[^<]*)*<\/nav\s*>/gi, "")
      .replace(/<header\b[^<]*(?:(?!<\/header\s*>)<[^<]*)*<\/header\s*>/gi, "")
      .replace(/<footer\b[^<]*(?:(?!<\/footer\s*>)<[^<]*)*<\/footer\s*>/gi, "")
      .replace(/<aside\b[^<]*(?:(?!<\/aside\s*>)<[^<]*)*<\/aside\s*>/gi, "")
      .replace(/<table\b[^>]*class="[^"]*infobox[^"]*"[\s\S]*?<\/table\s*>/gi, "");
  } while (targetHtml !== prev);

  let md = targetHtml
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<br\s*\/?>/gi, "\n");

  do {
    prev = md;
    md = md.replace(/<[^>]*>/g, "");
  } while (md !== prev);

  return decodeHtmlEntities(md)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

/* ─── Universal Blended Search ─────────────────────────────────────── */

/**
 * Perform a blended multi-source search across Bing, Google News, arXiv,
 * Hacker News, GitHub, Wikipedia, and DuckDuckGo.
 */
export async function webSearch(
  query: string,
  maxResults: number = 16,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const perCategory = Math.max(3, Math.ceil(maxResults / 4));

  // Concurrently query all free, zero-key search providers
  const [bingRes, newsRes, arxivRes, hnRes, githubRes, wikiRes, ddgInstantRes] =
    await Promise.allSettled([
      bingSearch(query, Math.max(8, Math.ceil(maxResults / 2))),
      googleNewsSearch(query, perCategory),
      arxivSearch(query, perCategory),
      hackerNewsSearch(query, perCategory),
      githubSearch(query, perCategory),
      wikipediaSearch(query, perCategory),
      duckDuckGoInstantAnswer(query),
    ]);

  const buckets: SearchResult[][] = [
    bingRes.status === "fulfilled" ? bingRes.value : [],
    newsRes.status === "fulfilled" ? newsRes.value : [],
    arxivRes.status === "fulfilled" ? arxivRes.value : [],
    hnRes.status === "fulfilled" ? hnRes.value : [],
    githubRes.status === "fulfilled" ? githubRes.value : [],
    wikiRes.status === "fulfilled" ? wikiRes.value : [],
    ddgInstantRes.status === "fulfilled" ? ddgInstantRes.value : [],
  ];

  // Interleave results across providers for rich diversity
  const results: SearchResult[] = [];
  const seenUrls = new Set<string>();

  let hasMore = true;
  let round = 0;

  while (hasMore && results.length < maxResults) {
    hasMore = false;
    for (const bucket of buckets) {
      if (round < bucket.length) {
        hasMore = true;
        const item = bucket[round];
        if (item.url && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          results.push(item);
          if (results.length >= maxResults) break;
        }
      }
    }
    round++;
  }

  // Year-specific Wikipedia boost
  const yearQuery = yearSpecificQuery(query);
  if (yearQuery && results.length > 0) {
    try {
      const yearSpecific = await wikipediaSearch(yearQuery, 2);
      return mergeYearBoost(yearSpecific, results, maxResults);
    } catch {
      // Non-critical
    }
  }

  return results.slice(0, maxResults);
}

/* ─── Utilities ───────────────────────────────────────────────────── */

function stripHtml(html: string): string {
  let text = html;
  let prev = "";
  do {
    prev = text;
    text = text
      .replace(/<script\b[^<]*(?:(?!<\/script\s*>)<[^<]*)*<\/script\s*>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style\s*>)<[^<]*)*<\/style\s*>/gi, "")
      .replace(/<[^>]*>/g, "");
  } while (text !== prev);

  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

export function yearSpecificQuery(query: string): string | null {
  const year = query.match(/\b(19|20)\d{2}\b/);
  if (!year) return null;
  const rest = query
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${year[0]} ${rest}`.trim();
}

export function mergeYearBoost(
  yearResults: SearchResult[],
  existing: SearchResult[],
  maxResults: number,
): SearchResult[] {
  const existingUrls = new Set(existing.map((r) => r.url));
  const boosted = yearResults.filter((r) => !existingUrls.has(r.url));
  return [...boosted, ...existing].slice(0, maxResults + boosted.length);
}

export function formatSearchResultsForLLM(results: SearchResult[]): string {
  if (results.length === 0) {
    return "Web search returned no results. Do NOT invent or guess facts to answer. If the user's question asks for factual information, say clearly that you couldn't verify it. If the question is creative, opinion-based, or about the conversation itself, answer normally.";
  }

  const SNIPPET_CAP = 500;
  const formatted = results
    .map(
      (r, i) =>
        `[${i + 1}] [${r.source || "Web"}] ${r.title}\n    URL: ${r.url}\n    ${
          r.snippet.length > SNIPPET_CAP ? `${r.snippet.slice(0, SNIPPET_CAP)}…` : r.snippet
        }`,
    )
    .join("\n\n");

  return `Web Search Results (Blended across Web, News, Code & Academic Sources):\n\n${formatted}\n\nUse these search results to inform your answer. Cite sources by referencing their URLs and names when relevant. You MUST NOT invent facts that are not present in the search results — no fabricated names, dates, numbers, or affiliations. If you need to read the full contents of any URL above in depth, use <action name="fetch_web_page">url</action>. If the search results don't contain the information the user asked for, say so explicitly.`;
}
