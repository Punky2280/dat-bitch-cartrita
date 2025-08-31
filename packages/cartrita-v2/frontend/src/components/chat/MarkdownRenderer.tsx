'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useThemeStore } from '../../store/additionalStores';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

interface CodeBlockProps {
  children: string;
  className?: string;
  inline?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, inline }) => {
  const [copied, setCopied] = React.useState(false);
  const { currentTheme } = useThemeStore();
  
  const language = className?.replace('language-', '') || 'text';
  const isDark = currentTheme === 'dark';
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code className={`px-1 py-0.5 rounded text-sm font-mono ${
        isDark 
          ? 'bg-gray-800 text-gray-200 border border-gray-700' 
          : 'bg-gray-100 text-gray-800 border border-gray-200'
      }`}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: '0.5rem',
          borderBottomRightRadius: '0.5rem',
        }}
        showLineNumbers
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  isStreaming = false,
  className = '' 
}) => {
  const { currentTheme } = useThemeStore();
  const isDark = currentTheme === 'dark';
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when streaming new content
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      const element = contentRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [content, isStreaming]);

  const renderedContent = useMemo(() => {
    // Handle streaming cursor
    const displayContent = isStreaming && !content.trim() ? '▌' : content;
    
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Code blocks
          code({ node, inline, className, children, ...props }) {
            return (
              <CodeBlock
                className={className}
                inline={inline}
              >
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          },
          
          // Links with external icon
          a({ href, children, ...props }) {
            const isExternal = href?.startsWith('http');
            return (
              <a
                href={href}
                {...props}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline inline-flex items-center gap-1"
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
              >
                {children}
                {isExternal && <ExternalLink className="w-3 h-3" />}
              </a>
            );
          },
          
          // Tables with proper styling
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto my-4">
                <table
                  {...props}
                  className={`min-w-full border-collapse ${
                    isDark 
                      ? 'border border-gray-700' 
                      : 'border border-gray-200'
                  }`}
                >
                  {children}
                </table>
              </div>
            );
          },
          
          thead({ children, ...props }) {
            return (
              <thead
                {...props}
                className={isDark ? 'bg-gray-800' : 'bg-gray-50'}
              >
                {children}
              </thead>
            );
          },
          
          th({ children, ...props }) {
            return (
              <th
                {...props}
                className={`px-4 py-2 text-left font-medium border ${
                  isDark 
                    ? 'border-gray-700 text-gray-200' 
                    : 'border-gray-200 text-gray-900'
                }`}
              >
                {children}
              </th>
            );
          },
          
          td({ children, ...props }) {
            return (
              <td
                {...props}
                className={`px-4 py-2 border ${
                  isDark 
                    ? 'border-gray-700 text-gray-300' 
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                {children}
              </td>
            );
          },
          
          // Blockquotes
          blockquote({ children, ...props }) {
            return (
              <blockquote
                {...props}
                className={`border-l-4 pl-4 py-2 my-4 italic ${
                  isDark 
                    ? 'border-blue-400 bg-blue-900/10 text-gray-300' 
                    : 'border-blue-500 bg-blue-50 text-gray-700'
                }`}
              >
                {children}
              </blockquote>
            );
          },
          
          // Lists with proper spacing
          ul({ children, ...props }) {
            return (
              <ul {...props} className="list-disc list-inside space-y-1 my-2">
                {children}
              </ul>
            );
          },
          
          ol({ children, ...props }) {
            return (
              <ol {...props} className="list-decimal list-inside space-y-1 my-2">
                {children}
              </ol>
            );
          },
          
          // Headings with proper hierarchy
          h1({ children, ...props }) {
            return (
              <h1
                {...props}
                className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700"
              >
                {children}
              </h1>
            );
          },
          
          h2({ children, ...props }) {
            return (
              <h2
                {...props}
                className="text-xl font-semibold mt-5 mb-3"
              >
                {children}
              </h2>
            );
          },
          
          h3({ children, ...props }) {
            return (
              <h3
                {...props}
                className="text-lg font-semibold mt-4 mb-2"
              >
                {children}
              </h3>
            );
          },
          
          // Paragraphs with proper spacing
          p({ children, ...props }) {
            return (
              <p {...props} className="mb-4 leading-relaxed">
                {children}
              </p>
            );
          },
        }}
      >
        {displayContent}
      </ReactMarkdown>
    );
  }, [content, isStreaming, isDark]);

  return (
    <div
      ref={contentRef}
      className={`prose prose-sm max-w-none ${
        isDark ? 'prose-invert' : ''
      } ${className}`}
    >
      {renderedContent}
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse" />
      )}
    </div>
  );
};

export default MarkdownRenderer;