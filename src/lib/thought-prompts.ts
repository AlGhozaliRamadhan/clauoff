// Guidance shared across effort levels.
//
// Supports both:
//   1. Native reasoning models (Qwen, DeepSeek, etc.) where reasoning tokens / <think>
//      are emitted natively or prefilled by the chat template.
//   2. Standard models (Llama, Mistral, etc.) where structured <think> guidance
//      helps guide the model to emit reasoning.

import { detectModelVariant } from '@/lib/model-variants';

const REPLY_LENGTH_RULE = `
Critical rule for the visible reply:
- The reply must be a COMPLETE answer. Never write a placeholder like
  "Here is the answer — ..." or end the reply with "…" or "etc."
- The reply must contain the actual content the user asked for: the full
  code, the full explanation, the full list — not a stub of it.
- Minimum reply length: at least 2 paragraphs of prose, OR the full code
  block / artifact the user asked for, whichever applies.
- If the user asked for code, the code goes in the visible reply (inside
  a code block or <artifact> tag), not summarized in prose.`;

const BASE_FORMAT_GUIDANCE = `Format for every reply:

A reply has two parts:
  1. A thought inside <think>…</think>.
  2. The visible reply, written as plain text AFTER </think>.

Both parts are required. A reply that ends at </think> with nothing after
is incomplete. Always write your final visible answer after closing the thought.${REPLY_LENGTH_RULE}

To respond to a question:
<think>
The user is asking a direct factual question. One clear answer fits, so I
will state it plainly and then briefly justify it. Keeping the thought
short so I leave room for a full reply.
</think>
The capital of France is Paris. It has been the capital since the 10th
century under the Capetian dynasty and remains the political and cultural
center of the country today, home to the French government and many of
the nation's most visited landmarks.`;

const SHORT_EXAMPLE = `
To respond to a question:
<think>One direct answer fits. I'll state it and move on. Keeping the thought brief so the reply has room.</think>
The answer is 42. This comes from the constant defined at the top of the
module, and it is what the test suite asserts against in
\`tests/test_constant.py\`. The value is exported as \`ANSWER\` and is
the only constant the rest of the package depends on.`;

const LONG_EXAMPLE = `
To respond to a question:
<think>
The user is asking how to read a CSV file in Python and sum one column.
Straightforward — I'll show the standard library approach and note the
pandas alternative. The reply needs a complete code sample plus a short
explanation, not just a description of the code.
</think>
The simplest way is with the \`csv\` module from the standard library, no
extra dependencies needed:

\`\`\`python
import csv

total = 0
with open("sales.csv", newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        total += int(row["amount"])

print(total)
\`\`\`

This reads \`sales.csv\` as a dictionary per row (so column names work
regardless of order), parses the \`amount\` column as an integer, and
accumulates the sum. If you already use \`pandas\`, the same thing is
\`pd.read_csv("sales.csv")["amount"].sum()\`, which is shorter but pulls
in a heavier dependency.`;

const MAX_EXAMPLE = `
To respond to a question:
<think>
The user is asking for a complete HTML page with a header, a list, and a
small bit of JavaScript that toggles list items. I'll build it as a
standalone file. Need to include the full markup so it actually runs when
they save and open it, not just a sketch.
</think>
Here is a complete standalone HTML file you can save and open directly:

\`\`\`html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Checklist</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 2rem auto; }
    li.done { text-decoration: line-through; opacity: 0.5; }
    li { cursor: pointer; padding: 0.25rem 0; }
 </style>
</head>
<body>
  <h1>Checklist</h1>
  <ul id="list">
    <li>Walk the dog</li>
    <li>Buy groceries</li>
    <li>Reply to emails</li>
 </ul>
  <script>
    document.getElementById("list").addEventListener("click", (e) => {
      if (e.target.tagName === "LI") e.target.classList.toggle("done");
    });
 </script>
</body>
</html>
\`\`\`

Clicking any item crosses it off (with a strikethrough); clicking again
un-crosses it. The whole file is self-contained, so you can save it as
\`checklist.html\` and open it in any browser without a build step. If you
want the list to persist across reloads, swap the click handler for one
that writes to \`localStorage\`.`;

const END_GUIDANCE = `
Keep the visible reply direct and complete. Concise does not mean short —
a complete answer is always more important than brevity. Don't prefix
it with labels like "Final answer:" or "Answer:". When the reply is
complete, stop — no trailing sign-off, no "Note:" blocks, and no
unnecessary disclaimers. Match the language the user wrote in.

Format the visible reply so it reads cleanly:
- Break long prose into 2-4 sentence paragraphs separated by a single
  blank line. Do not write one mega-paragraph that runs on for the
  whole reply.
- End the reply at the last sentence of the last paragraph. Do not
  add trailing blank lines or trailing whitespace after the reply.`;


export const THOUGHT_PROMPTS: Record<string, string> = {
  Low: `\n\nBefore answering, write a short thought identifying what is actually being asked and the appropriate domain approach, then write the visible reply.\n\n${BASE_FORMAT_GUIDANCE}${SHORT_EXAMPLE}\n\n${END_GUIDANCE}`,

  Medium: `\n\nBefore answering, think it through carefully — identify the core domain and user intent, check your assumptions, choose the most appropriate algorithm or framework for the problem, and verify accuracy — then write the visible reply.\n\n${BASE_FORMAT_GUIDANCE}${SHORT_EXAMPLE}\n\n${END_GUIDANCE}`,

  High: `\n\nBefore answering, reason carefully — weigh the options, check for traps, verify domain algorithms — then write the visible reply.\n\n${BASE_FORMAT_GUIDANCE}${LONG_EXAMPLE}\n\n${END_GUIDANCE}`,

  Extra: `\n\nBefore answering, reason deeply — explore alternatives, debate your first instinct, verify the conclusion — then write the visible reply.\n\n${BASE_FORMAT_GUIDANCE}${LONG_EXAMPLE}\n\n${END_GUIDANCE}`,

  Max: `\n\nBefore answering, take as long as you need inside the thought — analyze exhaustively, brainstorm, self-correct, double-check every fact, and verify edge cases — then write the visible reply.\n\n${BASE_FORMAT_GUIDANCE}${MAX_EXAMPLE}\n\n${END_GUIDANCE}`,
};

const NATIVE_REASONING_PROMPTS: Record<string, string> = {
  Low: `\n\nReasoning effort is set to low. Keep your thinking brief and focused, moving directly to the conclusion without unnecessary elaboration. Keep your final answer clear and direct.`,

  Medium: `\n\nReasoning effort is set to medium. Think carefully through the task, check assumptions, choose the best approach, and ensure accuracy in the final response.`,

  High: `\n\nReasoning effort is set to high. Reason thoroughly through the task, validate key assumptions, explore alternatives, and prioritize correctness, consistency, and clarity in the final answer.`,

  Extra: `\n\nReasoning effort is set to extra high. Reason deeply through the task, validate edge cases, debate alternative approaches, and provide a comprehensive, rigorous answer.`,

  Max: `\n\nReasoning effort is set to maximum. Take full room to explore, analyze exhaustively, self-correct, and verify all details before delivering your final answer.`,
};

export function getThoughtPrompt(effort: string, modelId: string = ''): string {
  const variant = detectModelVariant(modelId);
  if (variant.hasNativeThinking) {
    return NATIVE_REASONING_PROMPTS[effort] || NATIVE_REASONING_PROMPTS['Medium'];
  }
  return THOUGHT_PROMPTS[effort] || THOUGHT_PROMPTS['Medium'];
}
