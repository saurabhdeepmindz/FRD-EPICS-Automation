'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Compact Markdown renderer for the HLD Copilot (Sprint v10 UX polish).
 * GFM (tables, lists, strikethrough) with explicit Tailwind styles per element,
 * so it reads as a rich "preview" without needing the typography plugin.
 */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`text-sm text-gray-700 break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-base font-semibold text-gray-900 mt-3 mb-1.5 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold text-gray-900 mt-3 mb-1.5 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-gray-800 mt-2.5 mb-1 first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline hover:text-indigo-800">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-purple-300 bg-purple-50/40 pl-3 py-0.5 my-2 text-gray-600">{children}</blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = (className ?? '').includes('language-');
            return isBlock ? (
              <code className="block bg-gray-900 text-gray-100 rounded-md p-2.5 my-2 text-xs font-mono overflow-x-auto whitespace-pre">
                {children}
              </code>
            ) : (
              <code className="bg-gray-100 text-pink-700 rounded px-1 py-0.5 text-[12px] font-mono">{children}</code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          hr: () => <hr className="my-3 border-gray-200" />,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          th: ({ children }) => <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-700">{children}</th>,
          td: ({ children }) => <td className="border border-gray-200 px-2 py-1 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
