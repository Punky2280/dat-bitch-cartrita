import React, { useState, useEffect } from 'react';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface UserManualPageProps {
  onBack?: () => void;
}

const UserManualPage: React.FC<UserManualPageProps> = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [manualContent, setManualContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load manual content from file
  useEffect(() => {
    const loadManual = async () => {
      try {
        setLoading(true);
        const response = await fetch('/USER_MANUAL.md');
        if (!response.ok) {
          throw new Error('Failed to load user manual');
        }
        const content = await response.text();
        setManualContent(content);
        setError(null);
      } catch (err) {
        console.error('Error loading manual:', err);
        setError('Failed to load user manual. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadManual();
  }, []);

  // Parse sections from manual content
  const sections = React.useMemo(() => {
    if (!manualContent) return [];

    const lines = manualContent.split('\n');
    const parsedSections: Array<{ id: string; title: string; icon: string }> =
      [];

    // Find table of contents to extract sections
    let tocStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('## Table of Contents')) {
        tocStartIndex = i;
        break;
      }
    }

    if (tocStartIndex !== -1) {
      for (let i = tocStartIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (
          line.startsWith('1.') ||
          line.startsWith('2.') ||
          line.startsWith('3.') ||
          line.startsWith('4.') ||
          line.startsWith('5.') ||
          line.startsWith('6.') ||
          line.startsWith('7.')
        ) {
          const match = line.match(/\[([^\]]+)\]/);
          if (match) {
            const title = match[1];
            const id = title
              .toLowerCase()
              .replace(/[^a-z0-9\s&]/g, '')
              .replace(/\s+/g, '-')
              .replace(/&/g, '');

            // Assign icons based on content
            let icon = '📄';
            if (title.includes('Getting Started')) icon = '🚀';
            else if (title.includes('Dashboard')) icon = '📊';
            else if (
              title.includes('Knowledge Hub') ||
              title.includes('Memory Palace')
            )
              icon = '🧠';
            else if (title.includes('API Key') || title.includes('Vault'))
              icon = '🔐';
            else if (title.includes('Chat')) icon = '💬';
            else if (
              title.includes('Settings') ||
              title.includes('Personalization')
            )
              icon = '⚙️';
            else if (title.includes('Troubleshooting')) icon = '🔧';

            parsedSections.push({ id, title, icon });
          }
        }
        if (line.startsWith('---') || line.startsWith('##')) break;
      }
    }

    return parsedSections;
  }, [manualContent]);

  // Parse content sections from markdown
  const parsedContent = React.useMemo(() => {
    if (!manualContent) return {};

    const sections: Record<string, { title: string; content: string }> = {};
    const lines = manualContent.split('\n');
    let currentSection = '';
    let currentTitle = '';
    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for section headers (## Section Name)
      if (line.startsWith('## ') && !line.includes('Table of Contents')) {
        // Save previous section if exists
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = {
            title: currentTitle,
            content: currentContent.join('\n').trim(),
          };
        }

        // Start new section
        currentTitle = line.replace('## ', '').trim();
        currentSection = currentTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s&]/g, '')
          .replace(/\s+/g, '-')
          .replace(/&/g, '');
        currentContent = [];
      } else if (currentSection && !line.startsWith('---')) {
        // Add content to current section
        currentContent.push(line);
      }
    }

    // Save final section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = {
        title: currentTitle,
        content: currentContent.join('\n').trim(),
      };
    }

    return sections;
  }, [manualContent]);

  const filteredSections = sections.filter(
    section =>
      section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (parsedContent[section.id]?.content || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const currentContent = selectedSection
    ? parsedContent[selectedSection]
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-blue-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack || (() => window.history.back())}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="flex items-center space-x-2">
            <BookOpenIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              User Manual
            </h1>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search the manual..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Table of Contents */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg sticky top-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Table of Contents
                </h2>

                <nav className="space-y-2">
                  {filteredSections.map(section => (
                    <button
                      key={section.id}
                      onClick={() => setSelectedSection(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedSection === section.id
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{section.icon}</span>
                        <span className="text-sm font-medium">
                          {section.title}
                        </span>
                      </div>
                    </button>
                  ))}
                </nav>

                {searchTerm && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {filteredSections.length} section(s) match "{searchTerm}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-2">
              {loading ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-300">
                    Loading user manual...
                  </p>
                </div>
              ) : error ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg text-center">
                  <div className="text-red-500 mb-4">⚠️</div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Error Loading Manual
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {error}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Reload Page
                  </button>
                </div>
              ) : currentContent ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                    {currentContent.title}
                  </h2>

                  <div className="prose dark:prose-invert max-w-none">
                    {currentContent.content
                      .split('\n\n')
                      .map((paragraph, index) => {
                        const trimmedParagraph = paragraph.trim();

                        if (!trimmedParagraph) return null;

                        // Handle markdown headers
                        if (trimmedParagraph.startsWith('### ')) {
                          return (
                            <h3
                              key={index}
                              className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3"
                            >
                              {trimmedParagraph.slice(4)}
                            </h3>
                          );
                        }

                        // Handle bold text headers
                        if (
                          trimmedParagraph.startsWith('**') &&
                          trimmedParagraph.endsWith('**')
                        ) {
                          return (
                            <h3
                              key={index}
                              className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3"
                            >
                              {trimmedParagraph.slice(2, -2)}
                            </h3>
                          );
                        }

                        // Handle unordered lists (bullet points)
                        if (
                          trimmedParagraph.includes('\n- ') ||
                          trimmedParagraph.startsWith('- ')
                        ) {
                          const items = trimmedParagraph
                            .split('\n- ')
                            .filter(item => item.trim());
                          const firstItem = items[0].startsWith('- ')
                            ? items[0].slice(2)
                            : items[0];
                          const allItems = [firstItem, ...items.slice(1)];

                          return (
                            <ul
                              key={index}
                              className="list-disc pl-6 space-y-1 mb-4"
                            >
                              {allItems.map((item, itemIndex) => (
                                <li
                                  key={itemIndex}
                                  className="text-gray-600 dark:text-gray-300"
                                >
                                  {item.trim()}
                                </li>
                              ))}
                            </ul>
                          );
                        }

                        // Handle bullet points (•)
                        if (trimmedParagraph.includes('•')) {
                          const items = trimmedParagraph
                            .split('•')
                            .filter(item => item.trim());
                          return (
                            <ul
                              key={index}
                              className="list-disc pl-6 space-y-1 mb-4"
                            >
                              {items.map((item, itemIndex) => (
                                <li
                                  key={itemIndex}
                                  className="text-gray-600 dark:text-gray-300"
                                >
                                  {item.trim()}
                                </li>
                              ))}
                            </ul>
                          );
                        }

                        // Handle numbered lists
                        if (trimmedParagraph.match(/^\d+\./)) {
                          const items = trimmedParagraph
                            .split(/\d+\./)
                            .filter(item => item.trim());
                          return (
                            <ol
                              key={index}
                              className="list-decimal pl-6 space-y-1 mb-4"
                            >
                              {items.map((item, itemIndex) => (
                                <li
                                  key={itemIndex}
                                  className="text-gray-600 dark:text-gray-300"
                                >
                                  {item.trim()}
                                </li>
                              ))}
                            </ol>
                          );
                        }

                        // Handle code blocks
                        if (
                          trimmedParagraph.startsWith('```') &&
                          trimmedParagraph.endsWith('```')
                        ) {
                          const code = trimmedParagraph.slice(3, -3).trim();
                          return (
                            <pre
                              key={index}
                              className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 mb-4 overflow-x-auto"
                            >
                              <code className="text-sm text-gray-800 dark:text-gray-200">
                                {code}
                              </code>
                            </pre>
                          );
                        }

                        // Handle inline code
                        const processInlineMarkdown = (text: string) => {
                          // Handle inline code
                          const codeRegex = /`([^`]+)`/g;
                          const parts = text.split(codeRegex);

                          return parts.map((part, partIndex) => {
                            if (partIndex % 2 === 1) {
                              // This is code
                              return (
                                <code
                                  key={partIndex}
                                  className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm"
                                >
                                  {part}
                                </code>
                              );
                            } else {
                              // Handle bold text
                              const boldRegex = /\*\*([^*]+)\*\*/g;
                              const boldParts = part.split(boldRegex);

                              return boldParts.map((boldPart, boldIndex) => {
                                if (boldIndex % 2 === 1) {
                                  return (
                                    <strong key={`${partIndex}-${boldIndex}`}>
                                      {boldPart}
                                    </strong>
                                  );
                                }
                                return boldPart;
                              });
                            }
                          });
                        };

                        // Regular paragraph
                        return (
                          <p
                            key={index}
                            className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed"
                          >
                            {processInlineMarkdown(trimmedParagraph)}
                          </p>
                        );
                      })
                      .filter(Boolean)}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg text-center">
                  <BookOpenIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Cartrita User Manual
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Select a section from the table of contents to get started,
                    or use the search bar to find specific information.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4 text-left">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        🚀 New Users
                      </h3>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Start with "Getting Started" to learn the basics and set
                        up your account.
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                        🔧 Need Help?
                      </h3>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Check "Troubleshooting" for solutions to common issues.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManualPage;
