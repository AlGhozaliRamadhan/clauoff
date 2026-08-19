const fs = require('fs');

let content = fs.readFileSync('src/components/MessageAssistant.tsx', 'utf-8');

// We will replace the entire rendering logic with a block-based parser.
// First, we'll keep the stripInternal and stripVisibleTags functions.

const newLogic = `
  const blocks: { type: "text" | "thought" | "tool_results" | "search"; content?: string; label?: string; items?: ToolResultsItem[] }[] = [];
  
  let remaining = content;

  // Clean out things we never want to show
  const stripInternal = (raw: string): string =>
    raw
      .replace(/<confidence>[\\s\\S]*?<\\/confidence>\\s*/gi, "")
      .replace(/<action[^>]*>[\\s\\S]*?<\\/action>\\s*/gi, "")
      .replace(/<\\/?\\s*(?:\\|)?(?:thought|think)\\b[^>]*>/gi, "")
      .replace(/<step(?:>|\\s[^>]*>)/gi, "")
      .replace(/<\\/step>/gi, "")
      .replace(/<verification(?:>|\\s[^>]*>)/gi, "\\n  Verification: ")
      .replace(/<\\/verification>/gi, "\\n")
      .trim();

  // Tokenize the string by matching the start of any block we care about
  const blockRegex = /(<tool_results tool="([^"]*)">([\\s\\S]*?)<\\/tool_results>|<step(?:>|\\s[^>]*>)([\\s\\S]*?)<\\/step>|<\\s*(?:\\|)?(?:thought|think)\\b[^>]*>([\\s\\S]*?)<\\/\\s*(?:\\|)?(?:thought|think)\\b[^>]*>|<search query="([^"]*)" \\/>)/gi;
  
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      const text = remaining.substring(lastIndex, match.index);
      if (text.trim()) {
        blocks.push({ type: "text", content: text });
      }
    }
    
    if (match[1].startsWith("<tool_results")) {
      const labelAttr = match[2];
      const body = match[3];
      const items: ToolResultsItem[] = [];
      const itemRegex = /<item>([\\s\\S]*?)<\\/item>/gi;
      let it;
      while ((it = itemRegex.exec(body))) {
        const title = it[1].match(/<title>([\\s\\S]*?)<\\/title>/i)?.[1] ?? "";
        const url = it[1].match(/<url>([\\s\\S]*?)<\\/url>/i)?.[1] ?? "";
        const snippet = it[1].match(/<snippet>([\\s\\S]*?)<\\/snippet>/i)?.[1] ?? "";
        if (title.trim()) {
          items.push({
            title: decodeHtml(title.trim()),
            url: decodeHtml(url.trim()),
            snippet: decodeHtml(snippet.trim()),
          });
        }
      }
      if (items.length > 0) {
        blocks.push({ type: "tool_results", label: decodeHtml(labelAttr || ""), items });
      }
    } else if (match[1].startsWith("<search")) {
      blocks.push({ type: "search", content: decodeURIComponent(match[6]) });
    } else {
      // It's a thought or step
      const innerContent = match[4] || match[5];
      if (innerContent && innerContent.trim()) {
        blocks.push({ type: "thought", content: stripInternal(innerContent) });
      }
    }
    
    lastIndex = blockRegex.lastIndex;
  }
  
  if (lastIndex < remaining.length) {
    let tail = remaining.substring(lastIndex);
    
    // Handle unclosed blocks if streaming
    if (isStreaming) {
      const unclosedThink = tail.match(/<\\s*(?:\\|)?(?:thought|think)\\b[^>]*>/i);
      const unclosedStep = tail.match(/<step(?:>|\\s[^>]*>)/i);
      
      let splitIdx = -1;
      if (unclosedThink && unclosedStep) {
        splitIdx = Math.min(tail.indexOf(unclosedThink[0]), tail.indexOf(unclosedStep[0]));
      } else if (unclosedThink) {
        splitIdx = tail.indexOf(unclosedThink[0]);
      } else if (unclosedStep) {
        splitIdx = tail.indexOf(unclosedStep[0]);
      }
      
      if (splitIdx !== -1) {
        const visible = tail.substring(0, splitIdx);
        const unclosed = tail.substring(splitIdx);
        if (visible.trim()) blocks.push({ type: "text", content: visible });
        const unclosedClean = stripInternal(unclosed);
        if (unclosedClean.trim()) blocks.push({ type: "thought", content: unclosedClean });
        tail = "";
      }
    }
    
    if (tail.trim()) {
      blocks.push({ type: "text", content: tail });
    }
  }
  
  // Final cleanup on visible text blocks
  for (const block of blocks) {
    if (block.type === "text" && block.content) {
       block.content = block.content.replace(/^\\s*Final\\s+Answer:\\s*/i, "");
       block.content = block.content.replace(/[㐀-鿿豈-﫿぀-ヿ가-힯\\uD800-􏰀-\\uDFFF\\uD83C-\\uD83E]+$/u, "");
    }
  }

  // Determine raw copy text
  const rawCopyText = blocks.filter(b => b.type === "text").map(b => b.content).join("\\n").trim();
  const hasThoughts = blocks.some(b => b.type === "thought");
  const hasVisibleText = rawCopyText.length > 0;
`;

let targetFile = content.substring(0, content.indexOf('const thinkingParts'));
targetFile += newLogic;

// Now for the render part.
targetFile += `
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(rawCopyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [rawCopyText]);

  const [openStates, setOpenStates] = useState<Record<number, boolean>>({});
  const toggleBlock = useCallback((idx: number, open: boolean) => {
    setOpenStates(prev => ({ ...prev, [idx]: open }));
  }, []);

  return (
    <div className="group animate-fade-in" style={{ marginBottom: "var(--message-gap)" }}>
      <div className="flex gap-3">
        {/* Avatar mark */}
        <div className="flex-shrink-0 mt-1">
          <CogitoMark size={22} className={isStreaming && !content ? "animate-logo-thinking" : ""} />
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0" data-role="assistant">
          {blocks.map((block, idx) => {
            if (block.type === "thought") {
              const isOpen = openStates[idx] ?? true;
              return (
                <details
                  key={idx}
                  className="mb-4 text-sm-ui group"
                  open={isOpen}
                  onToggle={(e) => toggleBlock(idx, e.currentTarget.open)}
                >
                  <summary className="inline-flex items-center gap-2.5 cursor-pointer select-none outline-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 list-none [&::-webkit-details-marker]:hidden">
                    {isStreaming && idx === blocks.length - 1 ? (
                      <span className="font-medium animate-pulse text-[var(--accent-primary)]">Thinking...</span>
                    ) : (
                      <span className="font-medium">Thought process</span>
                    )}
                    <ChevronDownIcon
                      size={12}
                      className="opacity-50 transition-transform duration-200 group-open:rotate-180"
                    />
                  </summary>
                  <div
                    className="mt-3 ml-2 pl-4 border-l-[2px] border-[var(--border-subtle)] text-[var(--text-secondary)] opacity-90 whitespace-pre-wrap leading-relaxed"
                    style={{ fontSize: "0.95em", fontFamily: "var(--font-body)" }}
                  >
                    {block.content}
                  </div>
                </details>
              );
            }
            if (block.type === "search") {
              return (
                <div key={idx} className="mb-3 inline-flex items-center gap-2 text-sm-ui text-[var(--text-secondary)]">
                  <SearchIcon size={14} className="opacity-70" />
                  <span className="opacity-70">Searched:</span>
                  <span className="font-medium text-[var(--text-primary)] opacity-90">{block.content}</span>
                </div>
              );
            }
            if (block.type === "tool_results") {
              const isOpen = openStates[idx] ?? false;
              return (
                <details
                  key={idx}
                  className="mb-3 text-sm-ui group/results"
                  open={isOpen}
                  onToggle={(e) => toggleBlock(idx, e.currentTarget.open)}
                >
                  <summary className="inline-flex items-center gap-2 cursor-pointer select-none outline-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 list-none [&::-webkit-details-marker]:hidden">
                    <ChevronDownIcon
                      size={14}
                      className="transition-transform duration-200 group-open/results:rotate-180"
                    />
                    <span className="font-medium">Search results ({block.items?.length})</span>
                  </summary>
                  <ul className="mt-2 ml-6 space-y-2 border-l-[2px] border-[var(--border-subtle)] pl-3">
                    {block.items?.map((item, i) => (
                      <li key={i}>
                        <a
                          href={item.url || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <span className="block font-medium text-[var(--text-primary)]">{item.title}</span>
                          {item.snippet && (
                            <span className="block opacity-80">{item.snippet}</span>
                          )}
                          {item.url && (
                            <span className="block text-xs opacity-60 break-all">{item.url}</span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            }
            if (block.type === "text") {
              return (
                <div key={idx} className="min-w-0 break-words" data-role="assistant-visible-text">
                  <MarkdownRenderer content={block.content || ""} />
                </div>
              );
            }
            return null;
          })}

          {!isStreaming && !hasVisibleText && hasThoughts && (
            <p
              className="text-[var(--text-secondary)] opacity-70 italic"
              style={{ fontSize: "0.95em" }}
            >
              (no visible reply was generated — the model stopped after its thought.)
            </p>
          )}

          {!isStreaming && sources && sources.length > 0 && (
            <SourceChips sources={sources} />
          )}

          {!isStreaming && content && (
            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors duration-150 cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-ui)", fontSize: "var(--text-xs)" }}
                aria-label={copied ? "Copied" : "Copy message"}
              >
                {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/MessageAssistant.tsx', targetFile);
