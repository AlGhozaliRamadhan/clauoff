// Guidance shared across effort levels. Two principles shaped this:
//
//   1. Show, don't tell. Small local models follow examples much better than
//      abstract rules, so we keep one short example per level rather than
//      long paragraphs of "MUST" / "NEVER". The model can imitate the shape.
//
//   2. Don't be loud. Heavily coercive phrasing ("[SYSTEM DIRECTIVE]: you
//      MUST...") reads as artificial and small models either loop on the
//      rules or stop answering entirely. Plain, friendly guidance reads
//      better and produces more natural thoughts.
//
// Note on format: the <think> tag is required so the UI can fold the model's
// reasoning into the collapsible "Thought process" block. Without it the
// monologue bleeds into the visible answer.
//
// IMPORTANT: small local models frequently stop right after </think> and
// ship a bare thought with no visible reply. The format rule below puts
// that failure mode front-and-center.

const BASE_FORMAT_GUIDANCE = `Format for every reply — read this carefully:

A reply has two parts:
  1. A thought inside <think>…</think>. The user does NOT see this.
  2. The visible reply, written as plain text AFTER </think>.

Both parts are required. A reply that ends at </think> with nothing after
is broken — the user would see an empty message. This is the most common
mistake, so do not do it.

To respond to "hi":
<think>The user greeted me; a short warm reply is right.</think>
Hello! What can I help you with today?

To respond to a real question:
<think>
Let me consider what is being asked and what I know. There is more than
one way to look at this, and the better fit seems clear. I'll answer
directly and keep the reasoning brief.
</think>
Here is the answer — ...`;

const SHORT_EXAMPLE = `
To respond to a real question:
<think>Three plausible interpretations, the second fits best, so I'll answer that. The answer is straightforward.</think>
Here is the answer you're after — ...`;

const LONG_EXAMPLE = `
To respond to a real question:
<think>
The user is asking about a specific event. Let me work through it.
What are the core entities involved? There might be multiple interpretations, but the most common one is X.
Wait, let me double check my assumption about X. Actually, Y is more accurate because of recent developments.
Okay, I have verified the facts. Now I will structure the final visible response: start with a direct answer, then provide the supporting details.
</think>
Here is the detailed answer you're looking for — ...`;

const MAX_EXAMPLE = `
To respond to a real question:
<think>
The user is asking for a complex analysis. Let me think this through.

What exactly is being asked? If there is a plausible interpretation, go with it rather than stalling.

What do I actually know, and what am I unsure about? For the parts I am unsure of, the honest move is to be careful — either verify or say so. Do not invent specifics I do not have.

Are there any edge cases that matter here? Only include them if they genuinely change the answer; do not pad the reply for its own sake.

What is the cleanest way to present this? A direct answer up front, then the supporting reasoning, no more than needed.

Okay, I have a reasoned view. Now I will write the final visible response.
</think>
Here is the answer, with the reasoning laid out clearly — ...`;

const END_GUIDANCE = `
Keep the visible reply concise. Don't prefix it with labels like "Final
answer:" or "Answer:". When the reply is complete, stop — no trailing
sign-off, no "Note:" blocks, and absolutely no disclaimers or warnings. Match the language the user wrote in.`;

export const THOUGHT_PROMPTS: Record<string, string> = {
  Low: `\n\nBefore answering, write a short thought (one or two sentences), then write the visible reply.\n\n${BASE_FORMAT_GUIDANCE}${SHORT_EXAMPLE}\n\n${END_GUIDANCE}`,

  Medium: `\n\nBefore answering, think it through, then write the visible reply.\n\n${BASE_FORMAT_GUIDANCE}${SHORT_EXAMPLE}\n\n${END_GUIDANCE}`,

  High: `\n\nBefore answering, reason carefully — weigh the options, check for traps — then write the visible reply.\n\n${BASE_FORMAT_GUIDANCE}${LONG_EXAMPLE}\n\n${END_GUIDANCE}`,

  Extra: `\n\nBefore answering, reason deeply — explore alternatives, debate your first instinct, verify the conclusion — then write the visible reply.\n\n${BASE_FORMAT_GUIDANCE}${LONG_EXAMPLE}\n\n${END_GUIDANCE}`,

  Max: `\n\nBefore answering, take as long as you need inside the thought — analyze exhaustively, brainstorm, self-correct, double-check every fact, and verify edge cases — then write the visible reply.\n\n${BASE_FORMAT_GUIDANCE}${MAX_EXAMPLE}\n\n${END_GUIDANCE}`,
};

export function getThoughtPrompt(effort: string): string {
  return THOUGHT_PROMPTS[effort] || THOUGHT_PROMPTS["Medium"];
}
