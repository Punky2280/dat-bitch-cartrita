// packages/frontend/src/components/MarkdownPage.tsx
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Highlight, themes } from 'prism-react-renderer';

interface MarkdownPageProps {
  fileName: string;
}

const MarkdownPage: React.FC<MarkdownPageProps> = ({ fileName }) => {
  const [markdown, setMarkdown] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarkdown = async () => {
      try {
        // FIXED: The dynamic import now includes the .md extension in the static part of the path.
        const file = await import(`../content/${fileName.replace('.md', '')}.md?raw`);
        setMarkdown(file.default);
      } catch (err) {
        console.error(`Failed to load ${fileName}:`, err);
        setError(`Could not load content. Make sure the file exists.`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarkdown();
  }, [fileName]);

  if (isLoading) {
    return <div className="p-8 text-center text-gray-400">Loading content...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  // NOTE: The 'prose' classes come from the @tailwindcss/typography plugin.
  return (
    <div className="prose prose-invert prose-lg max-w-4xl mx-auto p-4 sm:p-6 md:p-8 text-white bg-black bg-opacity-30 border border-gray-700 rounded-lg overflow-y-auto h-full">
      <ReactMarkdown
        components={{
          code({ inline, className, children }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeText = String(children).replace(/\n$/, '');
            return !inline && match ? (
              <Highlight
                theme={themes.vsDark}
                code={codeText}
                language={match[1]}
              >
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                  <pre className={`${className} p-4 overflow-x-auto text-sm`} style={style}>
                    {tokens.map((line, i) => (
                      <div {...getLineProps({ line, key: i })}>
                        {line.map((token, key) => (
                          <span {...getTokenProps({ token, key })} />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            ) : (
              <code className={`${className || ''} bg-gray-800 text-red-400 rounded-sm px-1 font-mono`}>
                {children}
              </code>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownPage;
