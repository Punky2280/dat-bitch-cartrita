import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, BookOpenIcon, TagIcon, ClockIcon } from '@heroicons/react/24/outline';
import { debounce } from 'lodash';

interface SearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  importance_score: number;
  similarity_score?: number;
  search_type: 'semantic' | 'fulltext' | 'hybrid';
  snippet: string;
  created_at: string;
  updated_at: string;
}

interface SearchResponse {
  results: SearchResult[];
  meta: {
    query: string;
    search_type: string;
    total_results: number;
    duration_ms: number;
  };
}

interface KnowledgeSearchPanelProps {
  onResultClick?: (result: SearchResult) => void;
  selectedCategories?: string[];
  onCategoryChange?: (categories: string[]) => void;
  className?: string;
}

const KnowledgeSearchPanel: React.FC<KnowledgeSearchPanelProps> = ({
  onResultClick,
  selectedCategories = [],
  onCategoryChange,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'semantic' | 'fulltext' | 'hybrid'>('semantic');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchMeta, setSearchMeta] = useState<SearchResponse['meta'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Available categories
  const availableCategories = useMemo(() => [
    'ai', 'database', 'frontend', 'backend', 'security', 'ml', 'devops', 'general'
  ], []);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string, type: string, categories: string[]) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setSearchMeta(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/knowledge/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-session-id': `search-${Date.now()}`
          },
          body: JSON.stringify({
            query: searchQuery,
            search_type: type,
            limit: 20,
            threshold: 0.6,
            category: categories.length === 1 ? categories[0] : undefined,
            tags: categories.length > 1 ? categories : undefined
          })
        });

        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }

        const data: SearchResponse = await response.json();
        setResults(data.results || []);
        setSearchMeta(data.meta);

      } catch (error) {
        console.error('Search error:', error);
        setError(error instanceof Error ? error.message : 'Search failed');
        setResults([]);
        setSearchMeta(null);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  // Trigger search when query or filters change
  useEffect(() => {
    debouncedSearch(query, searchType, selectedCategories);
  }, [query, searchType, selectedCategories, debouncedSearch]);

  const handleCategoryToggle = (category: string) => {
    const newCategories = selectedCategories.includes(category)
      ? selectedCategories.filter(c => c !== category)
      : [...selectedCategories, category];
    onCategoryChange?.(newCategories);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const highlightSnippet = (snippet: string, query: string) => {
    if (!query.trim()) return snippet;
    
    const queryWords = query.toLowerCase().split(/\s+/);
    let highlightedSnippet = snippet;
    
    queryWords.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlightedSnippet = highlightedSnippet.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
    });
    
    return highlightedSnippet;
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 ${className}`}>
      {/* Search Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg 
                         bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border ${showFilters 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
            } hover:bg-blue-600 transition-colors`}
          >
            <FunnelIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Search Type Selector */}
        <div className="flex gap-2">
          {(['semantic', 'fulltext', 'hybrid'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSearchType(type)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                searchType === type
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Categories</h4>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryToggle(category)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    selectedCategories.includes(category)
                      ? 'bg-blue-500 text-white'
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
          
          {selectedCategories.length > 0 && (
            <button
              onClick={() => onCategoryChange?.([])}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Search Results */}
      <div className="max-h-96 overflow-y-auto">
        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <div className="text-slate-500 dark:text-slate-400">Searching...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 text-center text-red-600 dark:text-red-400">
            <div className="text-sm">{error}</div>
          </div>
        )}

        {/* Search Metadata */}
        {searchMeta && !isLoading && (
          <div className="p-3 bg-slate-50 dark:bg-slate-750 border-b border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Found {searchMeta.total_results} results in {searchMeta.duration_ms}ms
              {searchMeta.search_type && ` using ${searchMeta.search_type} search`}
            </div>
          </div>
        )}

        {/* Results List */}
        {results.length > 0 && !isLoading && (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {results.map((result) => (
              <div
                key={result.id}
                onClick={() => onResultClick?.(result)}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
                    {result.title}
                  </h3>
                  {result.similarity_score && (
                    <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                      {(result.similarity_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                
                <div 
                  className="text-xs text-slate-600 dark:text-slate-400 mb-2 line-clamp-2"
                  dangerouslySetInnerHTML={{ 
                    __html: highlightSnippet(result.snippet, query) 
                  }}
                />
                
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${result.category === 'ai' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                        result.category === 'database' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        result.category === 'frontend' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        result.category === 'security' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {result.category}
                    </span>
                    
                    {result.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        <TagIcon className="h-3 w-3" />
                        <span>{result.tags.slice(0, 2).join(', ')}</span>
                        {result.tags.length > 2 && <span>+{result.tags.length - 2}</span>}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" />
                    <span>{formatDate(result.updated_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && !isLoading && query.trim() && (
          <div className="p-8 text-center">
            <BookOpenIcon className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <div className="text-slate-500 dark:text-slate-400 mb-2">No results found</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              Try adjusting your search terms or filters
            </div>
          </div>
        )}

        {/* Initial State */}
        {results.length === 0 && !isLoading && !query.trim() && (
          <div className="p-8 text-center">
            <MagnifyingGlassIcon className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <div className="text-slate-500 dark:text-slate-400 mb-2">Search your knowledge base</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              Enter a query to find relevant entries using semantic or full-text search
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeSearchPanel;