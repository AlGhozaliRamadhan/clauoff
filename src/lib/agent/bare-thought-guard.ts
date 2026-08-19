// Guard against "bare thought" replies: small local models frequently emit
// <think>…</think> and stop without any visible text after it, leaving the
// user with an empty message. This wrapper buffers the model's first turn
// while streaming it to the client. If the visible content after stripping
// thoughts / steps / tool narration is empty, it automatically triggers
// one continuation turn asking the model to write its visible reply, and
// pipes that into the same output stream so the client sees one continuous
// stream.

import { getBackend } from "@/lib/backend-config";

const CONTINUATION_PROMPT =
  "Your previous reply contained a thought but no visible text after it — the user saw an empty message. " +
  "Now write ONLY the visible reply to the user. No <think> tags, no <step> tags, no labels — just the answer itself, as plain text.";

// Range helpers — kept as named constants so the regexes below stay readable
// and so the CJK range (which can't be expressed as a single inline literal
// in every editor) lives in one place.
const CJK_RANGE = "\\u3400-\\u9fff\\uf900-\\ufaff\\u3040-\\u30ff\\uac00-\\ud7af";

/** Heuristic check for "visible content was empty". Strips internal tags
 *  (<think>, <step>, <action>, <tool_results>, <verification>, confidence)
 *  and any leftover CJK/emoji junk tail, then asks: is there anything left?
 *
 *  Also flags two "bare thought without tags" patterns that small local
 *  models produce:
 *    - a <confidence>...</confidence> block with no real sentence after it
 *    - a response made entirely of CJK/Hangul/Kana with no Latin characters
 *      (almost always the model "thinking out loud" in another language
 *      instead of writing the actual reply) */
export function visibleContentIsEmpty(text: string): boolean {
  const stripped = text
    .replace(/<confidence>[\s\S]*?<\/confidence>/gi, "")
    .replace(/<action[^>]*>[\s\S]*?<\/action>/gi, "")
    .replace(/<action[^>]*>/gi, "")
    .replace(/<\s*(?:\|)?(?:thought|think)\b[^>]*>[\s\S]*?<\/\s*(?:\|)?(?:thought|think)\b[^>]*>/gi, "")
    .replace(/<\s*(?:\|)?(?:thought|think)\b[^>]*>[\s\S]*$/i, "")
    .replace(/<step(?:>|\s[^>]*>)[\s\S]*?<\/step>/gi, "")
    .replace(/<step(?:>|\s[^>]*>)[\s\S]*$/i, "")
    .replace(/<verification(?:>|\s[^>]*>)[\s\S]*?<\/verification>/gi, "")
    .replace(/<tool_results[\s\S]*?<\/tool_results>/gi, "")
    .replace(/^\s*Final\s+Answer:\s*/i, "")
    .replace(new RegExp(`[${CJK_RANGE}\\ud83c-\\ud83e]+$`, "u"), "")
    .trim();
  if (stripped.length === 0) return true;

  // <confidence> block is a strong internal-narration signal. If the model
  // emitted one but didn't follow up with a clear sentence-final answer
  // (period / question mark / exclamation at the end), the rest is
  // probably also internal monologue — treat the whole reply as bare thought.
  if (/<confidence>/i.test(text)) {
    const hasSentenceEnd = /[.!?…]"?\)?\s*$/.test(stripped);
    if (!hasSentenceEnd) return true;
  }

  // Pure-non-Latin reply: the model almost certainly switched languages
  // internally without writing the actual answer. Trigger the continuation
  // so the user gets something readable. (Real non-Latin answers almost
  // always contain some Latin chars — quotes, numbers, code, proper nouns
  // — so this rule doesn't false-positive on legitimate Chinese/Japanese/
  // Korean replies.)
  const hasLatin = /[a-zA-Z]/.test(stripped);
  const hasNonLatin = new RegExp(`[${CJK_RANGE}]`).test(stripped);
  if (hasNonLatin && !hasLatin) return true;

  return false;
}

/**
 * Wraps a first-turn stream so that if the model emits a bare thought,
 * a continuation turn is automatically triggered and appended.
 *
 * The first turn streams to the client as it arrives (no buffering delay).
 * After it ends, the accumulated text is inspected — if visible content
 * is empty, one extra completion call is made and its output is piped in.
 */
export function wrapWithBareThoughtGuard(
  firstTurnStream: ReadableStream<string>,
  historyAfterFirstTurn: Array<{ role: string; content: string }>,
  model: string,
  reasoning_effort: "low" | "medium" | "high" | undefined,
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      let accumulated = "";
      let streamErrored = false;

      try {
        // Tee the first turn so we can stream it to the client AND
        // accumulate a copy for the visibility check.
        const [clientBranch, serverBranch] = firstTurnStream.tee();
        const reader = serverBranch.getReader();

        // Forward the first turn to the client in lockstep.
        const forwardClient = (async () => {
          const r = clientBranch.getReader();
          try {
            while (true) {
              const { done, value } = await r.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch (forwardErr) {
            // If the client branch errors, mark it so we don't try
            // continuation on a broken stream.
            streamErrored = true;
            // Try to surface a message if the controller is still usable
            try {
              const msg = forwardErr instanceof Error ? forwardErr.message : "Stream error";
              controller.enqueue(`\n\n*(${msg})*\n`);
            } catch {
              // Controller may be closed/errored
            }
          }
        })();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += value;
          }
        } catch {
          // Server branch errored during accumulation — that's okay,
          // we still have whatever was accumulated so far.
          streamErrored = true;
        }

        await forwardClient;

        // If the stream errored, don't try continuation — the partial
        // content was already forwarded to the client.
        if (streamErrored) return;

        // If there's nothing visible after the thought, append a
        // continuation turn asking the model to write its reply.
        if (visibleContentIsEmpty(accumulated)) {
          // Clean out UI-injected tags (like <step> and <tool_results>) 
          // that tool-loop inserted, so the model doesn't read our UI code
          // and start talking about it.
          const cleanedForModel = accumulated
            .replace(/<step(?:>|\s[^>]*>)[\s\S]*?<\/step>/gi, "")
            .replace(/<tool_results[\s\S]*?<\/tool_results>/gi, "");

          const continuationMessages = [
            ...historyAfterFirstTurn,
            { role: "assistant" as const, content: cleanedForModel },
            { role: "user" as const, content: CONTINUATION_PROMPT },
          ];
          try {
            const continuationStream = await getBackend().streamChat({
              model,
              messages: continuationMessages.map((m) => ({
                role: m.role as "user" | "assistant" | "system",
                content: m.content,
              })),
              stream: true,
              reasoning_effort,
              max_tokens: 1024,
              frequency_penalty: 0.6,
              repeat_penalty: 1.1,
            });
            const cReader = continuationStream.getReader();
            while (true) {
              const { done, value } = await cReader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch {
            // Continuation failure is non-fatal — the user will see the
            // placeholder from MessageAssistant.
          }
        }
      } catch (err) {
        // Top-level error — try to surface it
        try {
          const msg = err instanceof Error ? err.message : "An error occurred";
          controller.enqueue(`\n\n⚠ ${msg}\n`);
        } catch {
          // Controller may already be errored
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Stream may already be closed/errored — ignore
        }
      }
    },
  });
}
