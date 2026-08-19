import { getBackend } from "@/lib/backend-config";
import { findTool, toToolResultsTag } from "@/lib/agent/tools";
import { verifyGrounding, renderGroundingWarning } from "@/lib/agent/grounding";

export async function runAgenticToolLoop(
  model: string,
  initialMessages: { role: string; content: string }[],
  effort: string,
  maxTurns: number = 3
): Promise<ReadableStream<string>> {
  let reasoning_effort: "low" | "medium" | "high" | undefined = undefined;
  if (effort === "Low") reasoning_effort = "low";
  if (effort === "Medium") reasoning_effort = "medium";
  if (["High", "Extra", "Max"].includes(effort)) reasoning_effort = "high";

  let currentTurn = 0;
  const messages = [...initialMessages];
  // Snippets from every search performed this turn — the grounding verifier
  // checks the final reply against these so unverified claims are surfaced.
  const collectedSnippets: string[] = [];

  return new ReadableStream({
    async start(controller) {
      try {
        while (currentTurn < maxTurns) {
          currentTurn++;

          let backendStream: ReadableStream<string> | null = null;
          let streamRetries = 0;
          const MAX_STREAM_RETRIES = 10;

          while (true) {
            try {
              backendStream = await getBackend().streamChat({
                model,
                messages: messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
                stream: true,
                reasoning_effort,
                max_tokens: 8192,
                frequency_penalty: 0.6,
                repeat_penalty: 1.1,
              });
              if (streamRetries > 0) {
                controller.enqueue(`<step>\nSuccessfully reconnected to backend.\n</step>`);
              }
              break; // Success
            } catch (err) {
              if (streamRetries >= MAX_STREAM_RETRIES) {
                // Backend connection failed completely — surface a clear,
                // actionable message instead of raw "502 HTML error" text.
                const msg = err instanceof Error ? err.message : "Failed to connect to backend";
                const isBackend = /50[0-9]/.test(msg);
                const hint = isBackend
                  ? "The backend (cogito.py) isn't accepting requests right now — check the tunnel/proxy and that the model finished loading."
                  : "Check that the backend is reachable and that the model finished loading.";
                controller.enqueue(`\n\n⚠ Couldn't reach the backend after ${MAX_STREAM_RETRIES} attempts: ${msg}. ${hint}\n`);
                break;
              }
              streamRetries++;
              const msg = err instanceof Error ? err.message : "502";
              controller.enqueue(`<step>\nBackend connection lost (${msg}). Retrying in 3s (Attempt ${streamRetries}/${MAX_STREAM_RETRIES})...\n</step>`);
              await new Promise(r => setTimeout(r, 3000));
            }
          }
          
          if (!backendStream) break;

          const reader = backendStream.getReader();
          let fullResponse = "";
          let buffer = "";
          let isCollectingAction = false;
          let actionCompleted = false;

          const flushUnknownActionAsAnswer = (block: string) => {
            const inner = block.match(/<action\s+name="([^"]+)">([\s\S]*?)<\/action>/i);
            const name = inner?.[1] ?? "";
            const body = (inner?.[2] ?? "").trim();
            if (body) {
              controller.enqueue(body);
            } else {
              controller.enqueue(`<step>\nModel attempted unknown action "${name}" — proceeding with answer.\n</step>`);
            }
          };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              fullResponse += value;
              buffer += value;

              if (!isCollectingAction) {
                const actionIdx = buffer.indexOf("<action");
                if (actionIdx !== -1) {
                  isCollectingAction = true;
                  const preAction = buffer.substring(0, actionIdx);
                  if (preAction) {
                    controller.enqueue(preAction);
                  }
                  buffer = buffer.substring(actionIdx);
                } else {
                  if (buffer.length > 30) {
                    const safeToFlush = buffer.substring(0, buffer.length - 15);
                    controller.enqueue(safeToFlush);
                    buffer = buffer.substring(buffer.length - 15);
                  }
                }
              }

              if (isCollectingAction) {
                const endActionIdx = buffer.indexOf("</action>");
                if (endActionIdx !== -1) {
                  const actionBlock = buffer.substring(0, endActionIdx + 9);

                  const match = actionBlock.match(/<action\s+name=['"]([^'"]+)['"]>([\s\S]*?)<\/action>/i);
                  const tool = match ? findTool(match[1]) : undefined;
                  if (match && tool) {
                    const input = match[2].trim();

                    controller.enqueue(`<step>\nAction: Using ${tool.name}${input ? ` for "${input}"` : ""}...\n</step>`);

                    let execution;
                    try {
                      execution = await tool.execute(input);
                    } catch (err) {
                      // ── CRITICAL FIX: Tool execution failure must not
                      // crash the stream. Catch and report gracefully, but
                      // do NOT invite the model to answer from memory — a
                      // search that failed must never become a license to
                      // invent facts. ──
                      const msg = err instanceof Error ? err.message : "unknown error";
                      execution = {
                        modelContext: `Tool ${tool.name} encountered an error: ${msg}. This is NOT a fatal error — the search simply didn't return results. Do NOT invent facts to answer the user's question. If the user's question asks for factual information you cannot verify, say clearly that the search failed and you couldn't verify it. Do NOT mention "network error" or "search failed" to the user — instead say you couldn't verify the information. If the user's question is creative, opinion-based, or about the conversation itself, you may still answer normally.`,
                      };
                      // Also enqueue a step so the UI shows something
                      controller.enqueue(`<step>\nSearch encountered an issue — answering from knowledge instead.\n</step>`);
                    }

                    if (execution.status) {
                      controller.enqueue(toToolResultsTag(execution.status));
                      // Capture snippets for the grounding verifier
                      for (const item of execution.status.items) {
                        if (item.snippet?.trim()) {
                          collectedSnippets.push(item.snippet);
                        }
                      }
                    }

                    // ── CRITICAL FIX: Ensure the <think> tag is closed in the history ──
                    // If the model emitted <action> inside <think>, the stream was broken before </think>.
                    // If we push unbalanced tags, local models get confused and loop.
                    let assistantContent = fullResponse;
                    if (assistantContent.includes("<think>") && !assistantContent.includes("</think>")) {
                      assistantContent += "\n</think>";
                    }
                    messages.push({ role: "assistant", content: assistantContent });
                    
                    const continuationPrompt = effort === "Max"
                      ? `<action_result>\n${execution.modelContext}\n</action_result>\n\nUse the results above to continue your task. Start a new <think> block to evaluate these results. If you need more information, emit another <action> tag inside your thought. If you have all the information needed, write your full, comprehensive final answer as visible text OUTSIDE of the <think> block.`
                      : `<action_result>\n${execution.modelContext}\n</action_result>\n\nWrite your final visible answer to the user using the results above. The answer must be grounded in these results: every fact you state (names, dates, numbers, affiliations) must come from the search results. Do NOT invent facts that are not in the results. If the results do not contain the information the user asked for, say so — do not answer from memory. If you need more information to answer correctly, emit another <action name="search_web"> tag with a more specific query instead of guessing. Only if the results already contain everything needed, write your reply as plain text.`;
                      
                    messages.push({
                      role: "user",
                      content: continuationPrompt
                    });

                    actionCompleted = true;
                    break; 
                  } else {
                    flushUnknownActionAsAnswer(actionBlock);
                    isCollectingAction = false;
                    buffer = buffer.substring(endActionIdx + 9);
                  }
                }
              }
            }
          } catch (streamErr) {
            // ── CRITICAL FIX: If the backend stream itself breaks
            // mid-thought (connection drop, timeout, etc.), don't let the
            // whole response die. Flush what we have and break cleanly. ──
            const msg = streamErr instanceof Error ? streamErr.message : "Stream interrupted";
            if (buffer.trim()) {
              controller.enqueue(buffer);
            }
            controller.enqueue(`\n\n*(Stream interrupted: ${msg}. Showing partial response.)*\n`);
            break;
          }

          // If we broke out because an action completed, loop around and call backend again
          if (actionCompleted) {
            continue;
          }

          // If the stream finished naturally without an action, flush remaining buffer and end!
          if (buffer && !isCollectingAction) {
            controller.enqueue(buffer);
          } else if (buffer && isCollectingAction) {
            // It streamed <action... but never closed it (model error or cut off).
            // Drop the unclosed tag's content into the thought process — never
            // leak raw tags into visible text.
            controller.enqueue(`<step>Model emitted an unclosed action tag — using partial content as answer.</step>`);
          }

          messages.push({ role: "assistant", content: fullResponse });

          if (!fullResponse.trim()) {
             controller.enqueue("\n\n*(The backend model stopped unexpectedly without generating any text. It may have reached its maximum context length. Please clear some history or start a new chat.)*\n");
             break;
          }

          // If this turn produced ONLY a bare thought and no visible text, push back!
          const strippedLastTurn = fullResponse.replace(/<\s*(?:\|)?(?:thought|think)\b[^>]*>[\s\S]*?(?:<\/\s*(?:\|)?(?:thought|think)\b[^>]*>|$)/gi, "").trim();
          if (!strippedLastTurn && effort === "Max") {
             if (currentTurn >= maxTurns) {
                 controller.enqueue("\n\n*(The AI failed to write a visible response and reached the maximum turn limit. It might be stuck in a reasoning loop.)*\n");
             } else {
                 messages.push({
                   role: "user",
                   content: "Your previous reply contained a thought but no visible text after it. Now write ONLY the visible reply to the user. No <think> tags, no <step> tags, no labels — just the answer itself, as plain text."
                 });
                 continue; // Loop around and force it to reply!
             }
          }

          // ── Grounding check ──
          // The model finished without another action. If we ran at least
          // one search this turn, mechanically compare the reply's specific
          // claims (years, ages, proper nouns) against the snippets we
          // captured. Unsupported claims get a visible warning appended —
          // this catches confident lies even when the model won't self-police.
          if (collectedSnippets.length > 0) {
            const visibleReply = strippedLastTurn;
            const flagged = verifyGrounding(visibleReply, collectedSnippets);
            if (flagged.length > 0) {
              controller.enqueue(renderGroundingWarning(flagged));
            }
          }

          break; // Done with all turns
        }
      } catch (err) {
        // ── Final catch: if something completely unexpected happens,
        // try to at least tell the user instead of silently failing. ──
        try {
          const msg = err instanceof Error ? err.message : "An unexpected error occurred";
          controller.enqueue(`\n\n⚠ ${msg}\n`);
        } catch {
          // controller itself may be errored — nothing we can do
        }
        controller.error(err);
        return; // Don't call close() after error()
      } finally {
        try {
          controller.close();
        } catch {
          // Stream may already be closed/errored — ignore
        }
      }
    }
  });
}
