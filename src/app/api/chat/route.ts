import { NextResponse } from "next/server";
import { getBackend, getDefaultModel } from "@/lib/backend-config";
import {
  buildCitations,
  buildRagSystemMessage,
  injectRagIntoMessages,
} from "@/lib/rag/context";
import { getProject } from "@/lib/rag/projects";
import { retrieve } from "@/lib/rag/retrieve";
import { getThoughtPrompt } from "@/lib/thought-prompts";
import { runAgenticToolLoop } from "@/lib/agent/tool-loop";
import { wrapWithBareThoughtGuard } from "@/lib/agent/bare-thought-guard";
import { TOOLS, buildToolsPrompt, getAllActiveTools } from "@/lib/agent/tools";
import { compactMessagesForBackend } from "@/lib/agent/context-trimmer";
import {
  listSkills,
  detectSkillSlashCommand,
  formatSkillPrompt,
  buildSkillsManifest,
} from "@/lib/skills";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes request timeout



export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.messages !== "object" || !Array.isArray(body.messages)) {
    return NextResponse.json(
      { error: "Request body must include a `messages` array." },
      { status: 400 },
    );
  }

  let model: string =
    typeof body.model === "string" && body.model.length > 0
      ? body.model
      : getDefaultModel();

  if (!model) {
    try {
      const models = await getBackend().listModels();
      if (models.length > 0) {
        model = models[0].id;
      } else {
        throw new Error("No models available on the configured backend.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch model list.";
      return NextResponse.json(
        { error: `No model specified and dynamic fallback failed: ${msg}` },
        { status: 502 },
      );
    }
  }

  const projectId =
    typeof body.projectId === "string" && body.projectId.length > 0
      ? body.projectId
      : undefined;

  // Copy so we never mutate the parsed body reference accidentally
  let messages: Array<{ role: string; content: string }> = body.messages;

  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  const effort = body.effort || "Medium";
  const thinking = !!body.thinking;
  const enableWebSearch = !!body.webSearch;
  
  let reasoning_effort: "low" | "medium" | "high" | undefined = undefined;

    // We will inject this AFTER RAG so it is not forgotten

  if (projectId) {
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: `Project not found: ${projectId}` },
        { status: 404 },
      );
    }

    const lastUser = [...messages]
      .reverse()
      .find((m) => m.role === "user" && typeof m.content === "string");
    const query = typeof lastUser?.content === "string" ? lastUser.content : "";

    if (query.trim()) {
      try {
        const chunks = await retrieve({ projectId, query, topK: 8 });
        if (chunks.length > 0) {
          const citations = buildCitations(chunks);
          const ragSystem = buildRagSystemMessage(chunks);
          messages = injectRagIntoMessages(messages, ragSystem);
          responseHeaders["Cogito-Sources"] = encodeURIComponent(
            JSON.stringify(citations),
          );
          responseHeaders["Access-Control-Expose-Headers"] = "Cogito-Sources";
        }
      } catch (err) {
        // Retrieval failure should not hard-block chat — surface a soft note
        // by injecting a short system warning, then continue generation.
        const msg =
          err instanceof Error ? err.message : "Project retrieval failed.";
        messages = injectRagIntoMessages(
          messages,
          `Project knowledge retrieval failed (${msg}). Answer without project sources.`,
        );
      }
    }
  }

  // cogito.py (the default llama.cpp wrapper this app uses) overrides the
  // first system message and ignores any second one — see "Backend quirks"
  // in CLAUDE.md. To survive that, we inject our guidance as a *prefix on
  // the first user message* rather than as a system message. The client
  // never sees this prefix; the backend's persona override never touches
  // it. If there's no user message yet, fall back to a system message
  // (which the backend will clobber, but at least we tried).
  const injectGuidance = (guidance: string) => {
    // Inject into the *last* user message so the prompt doesn't get lost 
    // in the context window during long multi-turn conversations.
    const lastUserIndex = messages.findLastIndex((m) => m.role === "user");
    if (lastUserIndex !== -1) {
      messages[lastUserIndex] = {
        ...messages[lastUserIndex],
        content: `${messages[lastUserIndex].content}\n\n---\n\n${guidance}`,
      };
    } else {
      messages.unshift({ role: "system", content: guidance });
    }
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const SYSTEM_INSTRUCTIONS = `System Information:
- Current date: ${currentDate}

Core directives:
1. EPISTEMIC RIGOR: Evaluate your own confidence internally and continuously. Provide direct, comprehensive answers grounded in rigorous analysis. When uncertain, say so plainly and explain why.
2. PROACTIVE AGENCY: Engage actively with problems. Do not ask for permission, deflect, or hedge when you can reason through something directly. Address the core substance of every inquiry thoroughly.
3. CONTEXTUAL DIRECTNESS: Match your response to what the person actually needs. For technical, mathematical, architectural, or factual queries, answer immediately with full depth. Do not pad responses with philosophical tangents, meta-commentary, or conversational filler unless the topic genuinely calls for it.
4. PROSE-FIRST WRITING: Write in clear, continuous paragraphs and natural flowing sentences. Avoid defaulting to bullet points or numbered lists unless explicitly asked for them or when laying out strict sequential steps. Use contractions where natural. Never use em dashes. Keep your voice conversational, sharp, and direct.
5. CLEAN OUTPUT: All revision, reflection, and self-correction happens internally. Output only your finalized response.
6. CODE & ARTIFACTS: You choose between two ways to deliver code and structured content:
   - MODE 1 (Standard Markdown in Chat): Use regular markdown code blocks (\`\`\`language ... \`\`\`) in the chat ONLY for short code snippets, one-liners, utility functions, terminal commands, or simple explanations (< 15 lines).
   - MODE 2 (Interactive Artifact Sandbox): Whenever creating a complete file, web page, game, React component, HTML/CSS/JS application, SVG graphic, or full standalone script, you MUST wrap it in an <artifact> tag:
     <artifact identifier="unique-id" language="html" title="Descriptive Title">
     ... complete standalone code ...
     </artifact>
     This immediately opens the code in the side-panel sandbox without dumping raw code into the chat.
     
     Structure for Artifact Responses:
     1. (Optional) A brief 1-2 sentence introduction before the artifact.
     2. The <artifact> tag with the full, complete code.
     3. Below the artifact tag, provide a thorough, helpful explanation: explain how the code works, what key parameters or components do, and how to run or configure it.
7. DOMAIN & ALGORITHMIC ACCURACY:
   - Match the algorithm to the actual problem domain. For simulations, thesis research, information propagation, epidemiology, graph dynamics, numerical simulations, or agent modeling, use standard scientific/graph/agent-based paradigms (e.g., NetworkX, NumPy, SciPy, standard Python algorithms) rather than reflexively generating heavy deep learning or neural network architectures (PyTorch/TensorFlow).
   - Only use PyTorch/TensorFlow when deep learning, neural networks, or ML training are explicitly requested.`;

  injectGuidance(SYSTEM_INSTRUCTIONS);

  // Load and apply Claude / Agent Skills
  try {
    const installedSkills = await listSkills();
    const lastUserIdx = messages.findLastIndex((m) => m.role === "user");

    if (lastUserIdx !== -1 && typeof messages[lastUserIdx].content === "string") {
      const detected = detectSkillSlashCommand(messages[lastUserIdx].content, installedSkills);
      if (detected) {
        // High-priority injection of active skill
        injectGuidance(formatSkillPrompt(detected.skill));
        if (detected.query) {
          messages[lastUserIdx] = {
            ...messages[lastUserIdx],
            content: detected.query,
          };
        }
      }
    }

    const manifest = buildSkillsManifest(installedSkills);
    if (manifest) {
      injectGuidance(manifest);
    }
  } catch (err) {
    console.warn("Failed to load skills for chat session:", err);
  }

  if (enableWebSearch) {
    const activeTools = await getAllActiveTools();
    injectGuidance(buildToolsPrompt(activeTools, effort));
  }

  if (thinking) {
    if (effort === "Low") reasoning_effort = "low";
    if (effort === "Medium") reasoning_effort = "medium";
    if (["High", "Extra", "Max"].includes(effort)) reasoning_effort = "high";

    injectGuidance(getThoughtPrompt(effort, model));
  }
    
  try {
    let finalStream: ReadableStream;
    
    const compactedMessages = compactMessagesForBackend(messages);

    if (enableWebSearch) {
      // Use the iterative agent loop that can intercept tool calls
      finalStream = await runAgenticToolLoop(
        model, 
        compactedMessages, 
        effort, 
        10 // Maximum agent loop turns to finish searching and reasoning completely
      );
      // The agent loop is already self-contained and guarantees visible output.
      return new NextResponse(finalStream, { headers: responseHeaders });
    } else {
      // Standard direct stream
      finalStream = await getBackend().streamChat({
        model,
        messages: compactedMessages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
        stream: true,
        reasoning_effort,
        max_tokens: 8192, // Use max context window for local reasoning models
        frequency_penalty: 0.6,
        repeat_penalty: 1.1,
      });

      // Wrap direct stream with bare-thought guard for models that emit only <think>
      return new NextResponse(
        wrapWithBareThoughtGuard(finalStream, messages, model, reasoning_effort),
        { headers: responseHeaders },
      );
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to connect to backend.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
