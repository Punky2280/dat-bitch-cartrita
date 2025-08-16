import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, BookOpenIcon, TagIcon, ClockIcon, PlusIcon, XMarkIcon, FolderIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
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
    filters_applied?: {
      categories?: string[] | null;
      tags?: string[] | null;
      date_range?: any | null;
    };
  };
}

interface Category {
  id: number;
  name: string;
  description?: string;
  parent_id?: number;
  icon?: string;
  color?: string;
  item_count: number;
  children: Category[];
}

interface Tag {
  id: number;
  name: string;
  description?: string;
  usage_count: number;
  actual_usage: number;
}

interface KnowledgeSearchPanelProps {
  onResultClick?: (result: SearchResult) => void;
  selectedCategories?: string[];
  onCategoryChange?: (categories: string[]) => void;
  className?: string;
  // Optional: constrain search to specific document IDs when using router
  documentIds?: number[];
}

const KnowledgeSearchPanel: React.FC<KnowledgeSearchPanelProps> = ({
  onResultClick,
  selectedCategories = [],
  onCategoryChange,
  className = '',
  documentIds
}) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'semantic' | 'fulltext' | 'hybrid'>('semantic');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchMeta, setSearchMeta] = useState<SearchResponse['meta'] | null>(null);
  
  // Enhanced state for categories and tags
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCategoryTree, setShowCategoryTree] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(0.6);
  const useRouterForKH = String(import.meta.env.VITE_USE_ROUTER_FOR_KH || 'false') === 'true';

  // API functions for categories and tags
  const fetchCategories = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/knowledge/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.warn('Failed to fetch categories:', error);
    }
  }, []);

  const fetchTags = useCallback(async (searchTerm = '') => {
    try {
      const token = localStorage.getItem('token');
      const url = `/api/knowledge/tags?limit=50${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags);
      }
    } catch (error) {
      console.warn('Failed to fetch tags:', error);
    }
  }, []);

  // Load categories and tags on mount
  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, [fetchCategories, fetchTags]);

  // Available categories
  const availableCategories = useMemo(() => [
    'ai', 'database', 'frontend', 'backend', 'security', 'ml', 'devops', 'general'
  ], []);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string, type: string, categories: string[], thr: number) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setSearchMeta(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        if (useRouterForKH) {
          const response = await fetch('/api/router', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'x-session-id': `search-${Date.now()}`
            },
            body: JSON.stringify({
              task: 'search',
              query: searchQuery,
              options: {
                limit: 20,
                threshold: thr,
                documentIds: documentIds && documentIds.length ? documentIds : undefined,
              }
            })
          });

          if (!response.ok) {
            throw new Error(`Router search failed: ${response.statusText}`);
          }
          const payload = await response.json();
          const result = payload?.result;
          const mapped: SearchResult[] = Array.isArray(result?.results)
            ? result.results.map((r: any) => ({
                id: `${r.document_id}:${r.chunk_id}`,
                title: r.document_title || 'Document',
                content: r.chunk_text || '',
                category: (r.document_metadata?.category) || 'general',
                tags: r.document_metadata?.tags || [],
                importance_score: r.similarity || 0,
                similarity_score: r.similarity,
                search_type: 'semantic',
                snippet: (r.chunk_text || '').slice(0, 240),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }))
            : [];
          setResults(mapped);
          setSearchMeta({
            query: searchQuery,
            search_type: 'semantic',
            total_results: mapped.length,
            duration_ms: payload?.timing_ms ?? 0,
          });
        } else {
          // Use enhanced search with category and tag filtering
          const response = await fetch('/api/knowledge/search/enhanced', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'x-session-id': `search-${Date.now()}`
            },
            body: JSON.stringify({
              query: searchQuery,
              search_type: type,
              categories: categories.length > 0 ? categories : [],
              tags: selectedTags.length > 0 ? selectedTags : [],
              limit: 20,
              min_score: thr,
              date_range: dateRange
            })
          });

          if (!response.ok) {
            throw new Error(`Enhanced search failed: ${response.statusText}`);
          }

          const data: SearchResponse = await response.json();
          setResults(data.results || []);
          setSearchMeta(data.meta);
        }
      } catch (error) {
        console.error('Search error:', error);
        setError(error instanceof Error ? error.message : 'Search failed');
        setResults([]);
        setSearchMeta(null);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [useRouterForKH, documentIds]
  );

  // Trigger search when query or filters change
  useEffect(() => {
    debouncedSearch(query, searchType, selectedCategories, threshold);
  }, [query, searchType, selectedCategories, selectedTags, dateRange, threshold, debouncedSearch]);

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

  // Tag management functions
  const handleTagToggle = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleTagSearch = useCallback(
    debounce((searchTerm: string) => {
      fetchTags(searchTerm);
    }, 300),
    [fetchTags]
  );

  // Category tree rendering
  const renderCategoryTree = (categories: Category[], level = 0) => {
    return categories.map(category => (
      <div key={category.id} className={`ml-${level * 4}`}>
        <div 
          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 ${
            selectedCategories.includes(category.name) ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
          }`}
          onClick={() => handleCategoryToggle(category.name)}
        >
          <FolderIcon className="h-4 w-4" style={{ color: category.color || '#64748b' }} />
          <span className="flex-1">{category.name}</span>
          <span className="text-xs bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">
            {category.item_count}
          </span>
        </div>
        {category.children.length > 0 && renderCategoryTree(category.children, level + 1)}
      </div>
    ));
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

        {/* Search Type + Threshold */}
        <div className="flex items-center gap-4 flex-wrap">
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

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-600 dark:text-slate-300">Threshold</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-32"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300 w-10 text-right">{(threshold*100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Enhanced Filters Panel */}
      {showFilters && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Categories Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Categories</h4>
                <button
                  onClick={() => setShowCategoryTree(!showCategoryTree)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800"
                >
                  {showCategoryTree ? 'Hide Tree' : 'Show Tree'}
                </button>
              </div>
              
              {showCategoryTree ? (
                <div className="max-h-48 overflow-y-auto bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 p-2">
                  {categories.length > 0 ? renderCategoryTree(categories) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 p-2">No categories available</div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryToggle(category.name)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                        selectedCategories.includes(category.name)
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                      }`}
                    >
                      <FolderIcon className="h-3 w-3" style={{ color: selectedCategories.includes(category.name) ? 'white' : category.color }} />
                      {category.name} ({category.item_count})
                    </button>
                  ))}
                </div>
              )}
              
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => onCategoryChange?.([])}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-2"
                >
                  Clear categories
                </button>
              )}
            </div>

            {/* Tags Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Tags</h4>
                <button
                  onClick={() => setShowTagSelector(!showTagSelector)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800"
                >
                  {showTagSelector ? 'Hide' : 'Browse'}
                </button>
              </div>
              
              {showTagSelector && (
                <div className="bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 p-2 mb-2">
                  <input
                    type="text"
                    placeholder="Search tags..."
                    value={tagSearch}
                    onChange={(e) => {
                      setTagSearch(e.target.value);
                      handleTagSearch(e.target.value);
                    }}
                    className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 mb-2"
                  />
                  <div className="max-h-32 overflow-y-auto">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleTagToggle(tag.name)}
                        className={`block w-full text-left px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-600 ${
                          selectedTags.includes(tag.name) ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{tag.name}</span>
                          <span className="text-xs bg-slate-200 dark:bg-slate-600 px-1 py-0.5 rounded">
                            {tag.actual_usage}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Selected Tags */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full"
                    >
                      <TagIcon className="h-3 w-3" />
                      {tag}
                      <button
                        onClick={() => handleTagToggle(tag)}
                        className="hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-full p-0.5"
                      >
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  Clear tags
                </button>
              )}
            </div>
          </div>
          
          {/* Clear All Filters */}
          {(selectedCategories.length > 0 || selectedTags.length > 0) && (
            <div className="mt-4 pt-2 border-t border-slate-200 dark:border-slate-600">
              <button
                onClick={() => {
                  onCategoryChange?.([]);
                  setSelectedTags([]);
                  setDateRange(null);
                }}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                Clear all filters
              </button>
            </div>
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