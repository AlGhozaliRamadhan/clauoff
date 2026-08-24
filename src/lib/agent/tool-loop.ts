import { getBackend } from "@/lib/backend-config";
import { findTool, parseAnyToolCall, toToolResultsTag, type ToolDefinition } from "@/lib/agent/tools";
import { verifyGrounding, renderGroundingWarning } from "@/lib/agent/grounding";
import { visibleContentIsEmpty, ensureThoughtStream } from "@/lib/agent/bare-thought-guard";
import { compactMessagesForBackend, buildEmergencyRecoveryContext } from "./context-trimmer";

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
          
          const outboundMessages = compactMessagesForBackend(messages);

          while (true) {
            try {
              backendStream = await getBackend().streamChat({
                model,
                messages: outboundMessages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
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
                controller.enqueue(`\n\n*(Couldn't reach the backend after ${MAX_STREAM_RETRIES} attempts: ${msg}. ${hint})*\n`);
                break;
              }
              streamRetries++;
              const msg = err instanceof Error ? err.message : "502";
              controller.enqueue(`<step>\nBackend connection lost (${msg}). Retrying in 3s (Attempt ${streamRetries}/${MAX_STREAM_RETRIES})...\n</step>`);
              await new Promise(r => setTimeout(r, 3000));
            }
          }
          
          if (!backendStream) break;

          const normalizedStream = ensureThoughtStream(backendStream, reasoning_effort !== undefined);
          const reader = normalizedStream.getReader();
          let fullResponse = "";
          let buffer = "";
          let isCollectingAction = false;
          let actionCompleted = false;

          const flushUnknownActionAsAnswer = (block: string) => {
            const inner = block.match(/<action(?:\s+name=['"]([^'"]*)['"])?>([\s\S]*?)<\/action>/i);
            const name = inner?.[1] ?? "";
            const body = (inner?.[2] ?? "").trim();
            const isPseudoAction = /^(?:answer|reply|respond|response|ask_clarification|ask_question|clarify|admit_ignorance|cannot_answer|apologize|refuse|generate_code|write_code|code_generation|create_code|generate_response|write_response|code|none|null|direct_answer|final_answer)$/i.test(name);
            if (body) {
              controller.enqueue(body);
            } else if (name && !isPseudoAction) {
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
                // Detect either <action name="...">, <tool_call>, or raw function/label formats (search_web("..."), search_web\n"...", Action: search_web)
                const actionIdx = buffer.indexOf("<action");
                const toolCallIdx = buffer.indexOf("<tool_call");
                const rawSearchMatch = buffer.match(/\b(?:search_web|fetch_web_page|run_python)\s*(?:\(\s*["'“‘]|:\s*["'“‘]|\n\s*["'“‘])/i);
                const rawSearchIdx = rawSearchMatch?.index ?? -1;
                const actionLabelMatch = buffer.match(/\bAction:\s*(?:search_web|fetch_web_page|run_python)/i);
                const actionLabelIdx = actionLabelMatch?.index ?? -1;

                const candidates = [actionIdx, toolCallIdx, rawSearchIdx, actionLabelIdx].filter((i) => i !== -1);
                const tagIdx = candidates.length > 0 ? Math.min(...candidates) : -1;

                if (tagIdx !== -1) {
                  isCollectingAction = true;
                  const preAction = buffer.substring(0, tagIdx);
                  if (preAction) {
                    controller.enqueue(preAction);
                  }
                  buffer = buffer.substring(tagIdx);
                } else {
                  if (buffer.length > 30) {
                    const safeToFlush = buffer.substring(0, buffer.length - 15);
                    controller.enqueue(safeToFlush);
                    buffer = buffer.substring(buffer.length - 15);
                  }
                }
              }

              if (isCollectingAction) {
                // Try to match either </action> or </tool_call> closing tags, or raw text format termination
                const endActionIdx = buffer.indexOf("</action>");
                const endToolCallIdx = buffer.indexOf("</tool_call>");

                let resolvedTool: ToolDefinition | undefined;
                let resolvedInput = "";
                let endTagLength = 0;
                let endIdx = -1;

                if (endActionIdx !== -1 && (endToolCallIdx === -1 || endActionIdx < endToolCallIdx)) {
                  endIdx = endActionIdx;
                  endTagLength = 9; // "</action>".length
                } else if (endToolCallIdx !== -1) {
                  endIdx = endToolCallIdx;
                  endTagLength = 12; // "</tool_call>".length
                } else if (!buffer.startsWith("<action") && !buffer.startsWith("<tool_call")) {
                  // Raw function / text style: match closing quote or newline
                  const rawParsed = parseAnyToolCall(buffer);
                  if (rawParsed) {
                    const quoteCount = (buffer.match(/["'”’]/g) || []).length;
                    const newlineIdx = buffer.indexOf("\n", 1);
                    if (quoteCount >= 2 || (newlineIdx !== -1 && buffer.length > newlineIdx + 1)) {
                      endIdx = newlineIdx !== -1 ? newlineIdx : buffer.length;
                      endTagLength = 0;
                      resolvedTool = findTool(rawParsed.name);
                      resolvedInput = rawParsed.input;
                    }
                  }
                }

                if (endIdx !== -1 && !resolvedTool) {
                  const block = buffer.substring(0, endIdx + endTagLength);
                  const parsed = parseAnyToolCall(block);
                  if (parsed) {
                    resolvedTool = findTool(parsed.name);
                    resolvedInput = parsed.input;
                  }

                  if (!resolvedTool) {
                    // Check if this was a pseudo-action to flush as answer text
                    flushUnknownActionAsAnswer(block);
                    isCollectingAction = false;
                    buffer = buffer.substring(endIdx + endTagLength);
                  }
                }

                if (resolvedTool && endIdx !== -1) {
                    controller.enqueue(`<step>\nAction: Using ${resolvedTool.name}${resolvedInput ? ` for "${resolvedInput}"` : ""}...\n</step>`);

                    let execution;
                    try {
                      execution = await resolvedTool.execute(resolvedInput);
                    } catch (err) {
                      // ── CRITICAL FIX: Tool execution failure must not
                      // crash the stream. Catch and report gracefully, but
                      // do NOT invite the model to answer from memory — a
                      // search that failed must never become a license to
                      // invent facts. ──
                      const msg = err instanceof Error ? err.message : "unknown error";
                      execution = {
                        modelContext: `Tool ${resolvedTool.name} encountered an error: ${msg}. This is NOT a fatal error — the search simply didn't return results. Do NOT invent facts to answer the user's question. If the user's question asks for factual information you cannot verify, say clearly that the search failed and you couldn't verify it. Do NOT mention "network error" or "search failed" to the user — instead say you couldn't verify the information. If the user's question is creative, opinion-based, or about the conversation itself, you may still answer normally.`,
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
                    // If the model emitted <action>/<tool_call> inside <think>, the stream was broken before </think>.
                    // If we push unbalanced tags, local models get confused and loop.
                    let assistantContent = fullResponse;
                    if (assistantContent.includes("<think>") && !assistantContent.includes("</think>")) {
                      assistantContent += "\n</think>";
                    }
                    messages.push({ role: "assistant", content: assistantContent });
                    
                    const continuationPrompt = effort === "Max"
                      ? `<tool_response>\n<action_result>\n${execution.modelContext}\n</action_result>\n</tool_response>\n\nUse the results above to continue your task. Start a new <think> block to evaluate these results. If you need more information, emit another tool call inside your thought. If you have all the information needed, write your full, comprehensive final answer as visible text OUTSIDE of the <think> block.`
                      : `<tool_response>\n<action_result>\n${execution.modelContext}\n</action_result>\n</tool_response>\n\nWrite your final visible answer to the user using the results above. The answer must be grounded in these results: every fact you state (names, dates, numbers, affiliations) must come from the search results. Do NOT invent facts that are not in the results. If the results do not contain the information the user asked for, say so — do not answer from memory. If you need more information to answer correctly, emit another tool call with a more specific query instead of guessing. Only if the results already contain everything needed, write your reply as plain text.`;
                      
                    messages.push({
                      role: "user",
                      content: continuationPrompt
                    });

                    actionCompleted = true;
                    break; 
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
             // Attempt an emergency recovery with stripped minimal context so generation finishes
             let recovered = false;
             try {
               const recoveryMessages = buildEmergencyRecoveryContext(
                 messages,
                 collectedSnippets.length > 0 ? collectedSnippets.slice(-4).join("\n\n") : undefined,
               );
               const recoveryStream = await getBackend().streamChat({
                 model,
                 messages: recoveryMessages.map((m) => ({
                   role: m.role as "user" | "assistant" | "system",
                   content: m.content,
                 })),
                 stream: true,
                 reasoning_effort,
                 max_tokens: 8192,
                 frequency_penalty: 0.6,
                 repeat_penalty: 1.1,
               });
               const normRecStream = ensureThoughtStream(recoveryStream, reasoning_effort !== undefined);
               const recReader = normRecStream.getReader();
               let recFullResponse = "";
               while (true) {
                 const { done, value } = await recReader.read();
                 if (done) break;
                 recFullResponse += value;
                 controller.enqueue(value);
               }
               if (recFullResponse.trim()) {
                 recovered = true;
                 break;
               }
             } catch {
               // Recovery failed — fallback to message below
             }

             if (!recovered) {
               controller.enqueue("\n\n*(The backend model stopped without outputting text. Context was trimmed — please try sending your prompt again or start a fresh session.)*\n");
               break;
             }
          }

          // If this turn produced ONLY a bare thought / internal monologue and no visible text, push back!
          if (visibleContentIsEmpty(fullResponse)) {
             if (currentTurn >= maxTurns) {
                 controller.enqueue("\n\n*(The AI finished thinking but did not generate a visible response. Please try again or rephrase.)*\n");
             } else {
                 const cleanedForModel = fullResponse
                   .replace(/<step(?:>|\s[^>]*>)[\s\S]*?<\/step>/gi, "")
                   .replace(/<tool_results[\s\S]*?<\/tool_results>/gi, "");

                 messages.push({
                   role: "user",
                   content: "Your previous reply contained a thought or action tag but no visible text after it. Now write ONLY the visible reply to the user. No <think> tags, no <step> tags, no <action> tags, no labels — just the answer itself, as plain text."
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
            const visibleReply = fullResponse
              .replace(/<\s*(?:human|user)\s*>[\s\S]*?<\/\s*(?:human|user)\s*>\s*/gi, "")
              .replace(/<\/?\s*(?:human|user|assistant)\b[^>]*>/gi, "")
              .replace(/<\s*(?:\|)?(?:thought|think)\b[^>]*>[\s\S]*?(?:<\/\s*(?:\|)?(?:thought|think)\b[^>]*>|$)/gi, "")
              .replace(/<step(?:>|\s[^>]*>)[\s\S]*?<\/step>/gi, "")
              .replace(/<tool_results[\s\S]*?<\/tool_results>/gi, "")
              .replace(/<action[^>]*>[\s\S]*?<\/action>/gi, "")
              .replace(/<action[^>]*>/gi, "")
              .trim();
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
          controller.enqueue(`\n\n*(Error: ${msg})*\n`);
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
