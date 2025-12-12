import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Compact markdown renderer for AI Agent chat messages
 * Optimized for financial data display - minimal spacing, clean typography
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings - compact
          h1: ({ children }) => (
            <div className="font-semibold text-sm mb-1 mt-2 first:mt-0">{children}</div>
          ),
          h2: ({ children }) => (
            <div className="font-semibold text-sm mb-1 mt-2 first:mt-0">{children}</div>
          ),
          h3: ({ children }) => (
            <div className="font-medium text-sm mb-0.5 mt-1.5 first:mt-0">{children}</div>
          ),
          h4: ({ children }) => (
            <div className="font-medium text-sm mb-0.5 mt-1 first:mt-0">{children}</div>
          ),

          // Paragraphs - tight spacing
          p: ({ children }) => (
            <p className="mb-1 last:mb-0">{children}</p>
          ),

          // Lists - compact, smaller bullets
          ul: ({ children }) => (
            <ul className="ml-3 mb-1 space-y-0 list-none">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="ml-3 mb-1 space-y-0 list-decimal list-inside">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="relative pl-3 before:content-['•'] before:absolute before:left-0 before:text-muted-foreground before:text-xs">
              {children}
            </li>
          ),

          // Strong/Bold - slightly heavier
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),

          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),

          // Code - inline only, compact
          code: ({ children }) => (
            <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
              {children}
            </code>
          ),

          // Code blocks
          pre: ({ children }) => (
            <pre className="bg-muted/50 border rounded p-1.5 my-1 overflow-x-auto text-xs">
              {children}
            </pre>
          ),

          // Tables - compact for financial data
          table: ({ children }) => (
            <div className="my-1 overflow-x-auto">
              <table className="w-full text-xs border-collapse border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody>{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-border/50 last:border-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1 text-left font-medium text-muted-foreground border-r border-border/50 last:border-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 border-r border-border/50 last:border-0">{children}</td>
          ),

          // Blockquotes - subtle
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-muted-foreground/30 pl-2 my-1 text-muted-foreground text-xs italic">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="my-2 border-border/50" />,

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),

          // Strikethrough
          del: ({ children }) => (
            <del className="text-muted-foreground line-through">{children}</del>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
});
