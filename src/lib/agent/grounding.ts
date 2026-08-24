/**
 * Grounding verifier (server-side).
 *
 * After the agentic tool loop finishes, we compare the model's final
 * visible reply against the actual search-result snippets that were
 * streamed during the turn (captured via <tool_results> tags). Claims
 * that the snippets do not support — specific years, ages, dates, and
 * proper-noun facts — are surfaced to the user as an honest "could not
 * be verified" warning instead of passing as confident lies.
 *
 * This is a mechanical, language-agnostic check. It does NOT judge
 * meaning; it looks for overlap between the named/dated tokens in the
 * reply and the same tokens in the snippets. No overlap for a
 * fact-heavy sentence = flag it. It is intentionally conservative
 * (prefer to under-flag) so that legit answers about creative topics
 * or conversational replies are not spuriously warned.
 */

export interface VerifiedFact {
  /** The sentence from the reply that carried the unsupported claim */
  sentence: string;
  /** The specific tokens we looked for and did not find */
  missing: string[];
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/** Pull the tokens we actually want to ground: years, ages, and proper nouns. */
function extractFactTokens(text: string): string[] {
  const tokens = new Set<string>();

  // Years (4 digits, typically 18xx-20xx)
  for (const m of text.matchAll(/\b(18|19|20)\d{2}\b/g)) tokens.add(m[0]);

  // Ages ("57", "at age 60", "25-year-old")
  for (const m of text.matchAll(/\b\d{1,3}\s*(?:years?\s*)?old\b|\bat\s+age\s+\d{1,3}\b|\bage\s+\d{1,3}\b/g)) {
    const num = m[0].match(/\d{1,3}/);
    if (num) tokens.add(num[0]);
  }

  // Proper nouns (capitalized runs of 2+ words — "Lund University",
  // "Anne L'Huillier", "Pierre Agostini"). Connector words ("of", "at",
  // "the", "de", "von") are allowed inside the phrase, because real
  // institution names — "University of California", "Max Planck Institute
  // of Quantum Optics" — always contain them. A single capitalized word
  // with an apostrophe ("O'Neil") is also a proper noun on its own.
  for (const m of text.matchAll(
    /\b[A-Z][a-zA-Zà-ÿ'’-]*(?:(?:\s+[A-Z][a-zA-Zà-ÿ'’-]*)+|\s+(?:of|at|the|de|von)\s+[A-Z][a-zA-Zà-ÿ'’-]*(?:\s+[A-Z][a-zA-Zà-ÿ'’-]*)*)\b/g,
  )) {
    tokens.add(m[0]);
  }

  return [...tokens];
}

/**
 * Strip code from a reply before grounding checks. Code is full of
 * tokens that look like proper nouns to a naive regex ("PATH", "SHELL",
 * function names) but are not factual claims a user could verify
 * against snippets. Scanning it produces false flags, and the rendered
 * warning can also echo the code block back to the user, causing the
 * reply to appear duplicated. We remove fenced code blocks, inline
 * code, and <artifact> bodies before token extraction.
 */
function stripCodeFromReply(text: string): string {
  return text
    // Fenced code blocks (```...```) — including the newlines around them
    .replace(/```[\s\S]*?```/g, " ")
    // Inline code (`...`)
    .replace(/`[^`\n]*`/g, " ")
    // <artifact> bodies
    .replace(/<\s*(?:antA|a)rtifact\b[^>]*>[\s\S]*?<\/\s*(?:antA|a)rtifact\s*>/gi, " ");
}

/** Case-insensitive containment for a token's core (word + optional punctuation). */
function tokenInSnippets(token: string, snippetText: string): boolean {
  const core = token.replace(/[.,;:!?'’"()[\]]+$/g, "");
  if (core.length < 3) return false;
  return snippetText.toLowerCase().includes(core.toLowerCase());
}

/**
 * Verify a reply against the snippets captured during the turn.
 * Returns the sentences whose fact tokens were entirely unsupported.
 */
export function verifyGrounding(reply: string, snippets: string[]): VerifiedFact[] {
  if (!reply.trim() || snippets.length === 0) return [];

  const allSnippets = snippets.join("\n");
  const flagged: VerifiedFact[] = [];

  // Strip fenced code / inline code / artifact bodies before scanning,
  // so a code block in the reply doesn't get flagged for code-internal
  // tokens ("PATH", "SHELL", function names) and so the rendered warning
  // doesn't echo the code back to the user.
  const scanText = stripCodeFromReply(reply);

  const sentences = scanText.split(SENTENCE_SPLIT);
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    const tokens = extractFactTokens(sentence);
    // Skip sentences with no verifiable specifics (no year/age/proper noun)
    if (tokens.length === 0) continue;

    const missing = tokens.filter((t) => !tokenInSnippets(t, allSnippets));
    // Only flag if EVERY specific token was unsupported — a sentence that
    // mixes one real fact with one invented one keeps the real anchor.
    if (missing.length === tokens.length) {
      flagged.push({ sentence, missing });
    }
  }

  return flagged;
}

/**
 * Render the verification warning. Placed after the model's reply so the
 * user sees the honest caveat immediately below the claims it applies to.
 *
 * Each flagged sentence is truncated to MAX_FLAGGED_SENTENCE_LEN chars so a
 * sentence that bled into a code block (or any unusually long sentence)
 * can't be echoed back at full length — that was duplicating the reply
 * visually for the user.
 */
const MAX_FLAGGED_SENTENCE_LEN = 200;

export function renderGroundingWarning(flagged: VerifiedFact[]): string {
  if (flagged.length === 0) return "";
  const items = flagged
    .slice(0, 3)
    .map((f) => {
      const s =
        f.sentence.length > MAX_FLAGGED_SENTENCE_LEN
          ? `${f.sentence.slice(0, MAX_FLAGGED_SENTENCE_LEN).trimEnd()}…`
          : f.sentence;
      return `- “${s}”`;
    })
    .join("\n");
  return `\n\n---\n\n**Note: Couldn't verify this against the search results:**\n${items}\n\n*Some of the above may be unverified — treat it with caution.*`;
}
