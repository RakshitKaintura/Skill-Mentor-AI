'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm md:prose-base dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Override default components to ensure they match our neo-surface design
          a: ({ node, ...props }) => (
            <a {...props} className="text-[var(--color-app-primary)] no-underline hover:underline" target="_blank" rel="noopener noreferrer" />
          ),
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline ? (
              <div className="relative my-4 overflow-hidden rounded-md border border-[var(--color-app-border)] bg-[#0d1117] text-sm">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
                  <span>{match?.[1] || 'code'}</span>
                </div>
                <div className="overflow-x-auto p-4">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </div>
              </div>
            ) : (
              <code className="rounded-sm bg-[var(--color-app-surface-cool)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--color-app-primary)]" {...props}>
                {children}
              </code>
            )
          },
          pre: ({ node, ...props }) => <>{props.children}</>, // Avoid double wrapping since we handle it in `code`
          p: ({ node, ...props }) => <p {...props} className="mb-4 text-[var(--color-app-text-primary)] leading-relaxed last:mb-0" />,
          ul: ({ node, ...props }) => <ul {...props} className="mb-4 list-disc pl-5 text-[var(--color-app-text-primary)]" />,
          ol: ({ node, ...props }) => <ol {...props} className="mb-4 list-decimal pl-5 text-[var(--color-app-text-primary)]" />,
          li: ({ node, ...props }) => <li {...props} className="mb-1" />,
          h1: ({ node, ...props }) => <h1 {...props} className="mb-4 mt-6 text-2xl font-bold text-[var(--color-app-text-primary)]" />,
          h2: ({ node, ...props }) => <h2 {...props} className="mb-3 mt-5 text-xl font-bold text-[var(--color-app-text-primary)]" />,
          h3: ({ node, ...props }) => <h3 {...props} className="mb-2 mt-4 text-lg font-bold text-[var(--color-app-text-primary)]" />,
          strong: ({ node, ...props }) => <strong {...props} className="font-bold text-[var(--color-app-text-primary)]" />,
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-4 border-[var(--color-app-primary)] pl-4 italic text-[var(--color-app-text-secondary)] my-4" />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
