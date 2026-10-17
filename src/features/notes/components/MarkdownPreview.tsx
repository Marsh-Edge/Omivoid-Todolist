"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { taskIdFromHref } from "@/lib/wikiLinks";

/**
 * Rendered Markdown. This module pulls in `react-markdown` / `remark-gfm` and is
 * loaded lazily (via `next/dynamic`) so the Markdown libraries stay out of the
 * initial bundle.
 */
export default function MarkdownPreview({
  markdown,
  onOpenTask,
}: {
  markdown: string;
  onOpenTask: (id: string) => void;
}) {
  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const id = taskIdFromHref(href);
            if (id) {
              return (
                <a
                  href={href}
                  className="task-link"
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenTask(id);
                  }}
                >
                  {children}
                </a>
              );
            }
            // Local-only app: never navigate to external URLs. Show them as
            // inert, styled text so a link can't trigger a network request.
            return <span className="external-link">{children}</span>;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
