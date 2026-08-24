"use client";

import React from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MarkdownRendererProps {
  content: string;
}

const remarkPlugins = [remarkGfm];

const components: Components = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const isCodeBlock = !inline && match;

    if (isCodeBlock) {
      return (
        <CodeBlock
          language={match[1]}
          value={String(children).replace(/\n$/, "")}
        />
      );
    }

    // Inline code
    if (!inline && String(children).includes("\n")) {
        return (
           <CodeBlock language="text" value={String(children).replace(/\n$/, "")} />
        )
    }

    return (
      <code
        className={className}
        style={{
          backgroundColor: "var(--surface-inline-code)",
          padding: "0.125rem 0.25rem",
          borderRadius: "0.25rem",
          fontSize: "0.875em",
          fontFamily: "var(--font-mono)",
          color: "var(--text-primary)",
        }}
        {...props}
      >
        {children}
      </code>
    );
  },
  // Typography overrides to match the design system
  p({ children }) {
    return <p className="mb-4 first:mt-0 last:mb-0 leading-[var(--lh-base)] break-words [overflow-wrap:anywhere]">{children}</p>;
  },
  h1({ children }) {
    return <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 leading-tight break-words [overflow-wrap:anywhere]">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0 leading-tight break-words [overflow-wrap:anywhere]">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-lg font-bold mb-3 mt-4 first:mt-0 leading-tight break-words [overflow-wrap:anywhere]">{children}</h3>;
  },
  ul({ children }) {
    return <ul className="list-disc pl-5 mb-4 first:mt-0 space-y-1 break-words [overflow-wrap:anywhere]">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal pl-5 mb-4 first:mt-0 space-y-1 break-words [overflow-wrap:anywhere]">{children}</ol>;
  },
  li({ children }) {
    return <li className="break-words [overflow-wrap:anywhere]">{children}</li>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] underline underline-offset-2 break-all"
      >
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-[var(--border-subtle)] pl-4 italic text-[var(--text-secondary)] mb-4 first:mt-0 break-words [overflow-wrap:anywhere]">
        {children}
      </blockquote>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto mb-4 border border-[var(--border-subtle)] rounded-md">
        <table className="min-w-full divide-y divide-[var(--border-subtle)]">
          {children}
        </table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-[var(--surface-raised)]">{children}</thead>;
  },
  th({ children }) {
    return (
      <th className="px-4 py-2 text-left text-sm font-bold text-[var(--text-secondary)] tracking-wider">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="px-4 py-2 text-sm border-t border-[var(--border-subtle)]">{children}</td>;
  },
  hr() {
    return <hr className="my-6 border-[var(--border-subtle)]" />;
  },
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-base)",
        color: "var(--text-primary)",
      }}
      className="markdown-body"
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
