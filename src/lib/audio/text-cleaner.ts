/**
 * src/lib/audio/text-cleaner.ts
 * Prepares LLM responses and markdown for natural speech synthesis.
 */

export function cleanTextForSpeech(rawText: string): string {
  if (!rawText || !rawText.trim()) {
    return "";
  }

  let text = rawText;

  // 1. Strip thought and internal monologue blocks
  text = text.replace(/<\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>[\s\S]*?<\/\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>/gi, "");
  text = text.replace(/<confidence>[\s\S]*?<\/confidence>/gi, "");
  text = text.replace(/<tool_call[\s\S]*?<\/tool_call>/gi, "");
  text = text.replace(/<tool_response[\s\S]*?<\/tool_response>/gi, "");
  text = text.replace(/<tool_results[\s\S]*?<\/tool_results>/gi, "");
  text = text.replace(/<action[^>]*>[\s\S]*?<\/action>/gi, "");
  text = text.replace(/<step(?:>|\s[^>]*>)[\s\S]*?<\/step>/gi, "");
  text = text.replace(/<verification(?:>|\s[^>]*>)[\s\S]*?<\/verification>/gi, "");

  // 2. Handle Artifacts: replace with natural speech marker
  text = text.replace(/<(?:antA|a)rtifact\b[^>]*>[\s\S]*?<\/(?:antA|a)rtifact>/gi, " Artifact code omitted. ");

  // 3. Strip code fences (keep intro/outro text clean)
  text = text.replace(/```[\w\-]*\n[\s\S]*?```/g, " Code block omitted. ");
  text = text.replace(/`([^`\n]+)`/g, "$1");

  // 4. Strip markdown image tags ![alt](url) -> ""
  text = text.replace(/!\[.*?\]\(.*?\)/g, "");

  // 5. Convert markdown links [text](url) -> "text"
  text = text.replace(/\[(.*?)\]\(.*?\)/g, "$1");

  // 6. Strip headers (# Header -> Header)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // 7. Strip bold, italic, strikethrough markdown
  text = text.replace(/\*{1,3}(.*?)\*{1,3}/g, "$1");
  text = text.replace(/_{1,3}(.*?)_{1,3}/g, "$1");
  text = text.replace(/~~(.*?)~~/g, "$1");

  // 8. Strip HTML tags and remove any leftover angle brackets
  text = text.replace(/<[^>]+>/g, " ").replace(/[<>]/g, "");

  // 9. Strip raw URLs
  text = text.replace(/https?:\/\/\S+/g, " link ");

  // 10. Strip bullet / list markers
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");

  // 11. Clean internal state prefixes
  text = text.replace(/^\s*(?:Internal\s+[Ss]tate|Confidence(?:\s*Score)?|Action|Answer|Final\s+Answer)\s*[:\-–—]\s*/gim, "");

  // 12. Normalize multiple spaces and line breaks
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Splits text into natural sentence and phrase chunks for streaming speech synthesis.
 * Sentences are preserved with natural punctuation for smooth, human-like neural cadence and prosody.
 */
export function splitTextIntoSpeechChunks(rawText: string, maxChunkLength: number = 140): string[] {
  const cleaned = cleanTextForSpeech(rawText);
  if (!cleaned) return [];

  // Match sentences on punctuation (. ! ? ; \n) or end of string
  const rawSentences: string[] = [];
  const regex = /([^.!?;\n]+[.!?;\n]+(?:\s+|$)|[^.!?;\n]+$)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    const s = match[1].trim();
    if (s.length > 0) {
      rawSentences.push(s);
    }
  }

  if (rawSentences.length === 0) {
    rawSentences.push(cleaned);
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (let i = 0; i < rawSentences.length; i++) {
    const s = rawSentences[i];

    // If an individual sentence is unusually long, split on major clause punctuation (, : - —)
    if (s.length > maxChunkLength) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }

      const clauseRegex = /([^,:\-—–]+[,:\-—–]+(?:\s+|$)|[^,:\-—–]+$)/g;
      let clauseMatch: RegExpExecArray | null;
      let subChunk = "";

      while ((clauseMatch = clauseRegex.exec(s)) !== null) {
        const clause = clauseMatch[1].trim();
        if (!clause) continue;

        if ((subChunk + " " + clause).length > maxChunkLength && subChunk.trim()) {
          chunks.push(subChunk.trim());
          subChunk = clause;
        } else {
          subChunk = subChunk ? `${subChunk} ${clause}` : clause;
        }
      }

      if (subChunk.trim()) {
        chunks.push(subChunk.trim());
      }
      continue;
    }

    if (currentChunk.length > 0 && (currentChunk + " " + s).length > maxChunkLength) {
      chunks.push(currentChunk.trim());
      currentChunk = s;
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${s}` : s;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

