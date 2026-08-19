const fs = require('fs');
let content = fs.readFileSync('src/components/MessageAssistant.tsx', 'utf-8');

// Update block parsing
content = content.replace(
`    } else {
      // It's a thought or step
      const innerContent = match[4] || match[5];
      if (innerContent && innerContent.trim()) {
        blocks.push({ type: "thought", content: stripInternal(innerContent) });
      }
    }`,
`    } else if (match[1].startsWith("<step")) {
      const stepContent = match[4];
      if (stepContent && stepContent.trim()) {
        blocks.push({ type: "step", content: stepContent.trim() });
      }
    } else {
      const innerContent = match[5];
      if (innerContent && innerContent.trim()) {
        blocks.push({ type: "thought", content: stripInternal(innerContent) });
      }
    }`
);

// Update unclosed step parsing
content = content.replace(
`        const unclosedClean = stripInternal(unclosed);
        if (unclosedClean.trim()) blocks.push({ type: "thought", content: unclosedClean });`,
`        const unclosedClean = stripInternal(unclosed);
        if (unclosedClean.trim()) {
           if (unclosed.startsWith("<step")) {
               blocks.push({ type: "step", content: unclosedClean });
           } else {
               blocks.push({ type: "thought", content: unclosedClean });
           }
        }`
);

// Add step renderer
content = content.replace(
`            if (block.type === "search") {
              return (
                <div key={idx} className="mb-3 inline-flex items-center gap-2 text-sm-ui text-[var(--text-secondary)]">
                  <SearchIcon size={14} className="opacity-70" />
                  <span className="opacity-70">Searched:</span>
                  <span className="font-medium text-[var(--text-primary)] opacity-90">{block.content}</span>
                </div>
              );
            }`,
`            if (block.type === "search") {
              return (
                <div key={idx} className="mb-3 inline-flex items-center gap-2 text-sm-ui text-[var(--text-secondary)]">
                  <SearchIcon size={14} className="opacity-70" />
                  <span className="opacity-70">Searched:</span>
                  <span className="font-medium text-[var(--text-primary)] opacity-90">{block.content}</span>
                </div>
              );
            }
            if (block.type === "step") {
              let label = block.content;
              const qMatch = block.content.match(/for "([^"]+)"/);
              if (qMatch) {
                label = qMatch[1];
              } else {
                label = block.content.replace(/^Action:\\s*Using.*?\\.\\.\\.$/i, "Running tool").trim();
              }
              return (
                <div key={idx} className="mb-3 inline-flex items-center gap-2 text-sm-ui text-[var(--text-secondary)]">
                  <SearchIcon size={14} className="opacity-70" />
                  <span className="opacity-70">Searched:</span>
                  <span className="font-medium text-[var(--text-primary)] opacity-90">{label}</span>
                </div>
              );
            }`
);

// Add step to block type definition
content = content.replace(
`const blocks: { type: "text" | "thought" | "tool_results" | "search"; content?: string; label?: string; items?: ToolResultsItem[] }[] = [];`,
`const blocks: { type: "text" | "thought" | "tool_results" | "search" | "step"; content?: string; label?: string; items?: ToolResultsItem[] }[] = [];`
);

fs.writeFileSync('src/components/MessageAssistant.tsx', content);
