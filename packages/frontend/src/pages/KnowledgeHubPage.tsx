import React, { useState, useEffect, useCallback } from 'react';
import { 
  CubeIcon,
  PlusIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  Squares2X2Icon,
  RectangleStackIcon
} from '@heroicons/react/24/outline';
import KnowledgeGraph3D from '../components/knowledge/KnowledgeGraph3D';
import KnowledgeSearchPanel from '../components/knowledge/KnowledgeSearchPanel';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  tags: string[];
  importance_score: number;
  created_at: string;
  updated_at: string;
  has_embedding: boolean;
}

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    category: string;
    tags: string[];
    importance: number;
    size: number;
    degree: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    weight: number;
    opacity: number;
  }>;
  clusters: Array<{
    id: string;
    name: string;
    color: string;
    entry_count: number;
  }>;
  meta: {
    node_count: number;
    edge_count: number;
    cluster_count: number;
  };
}

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

interface KnowledgeHubPageProps {
  token?: string;
  onBack?: () => void;
}

const KnowledgeHubPage: React.FC<KnowledgeHubPageProps> = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'graph' | 'entries' | 'analytics'>('search');
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  // const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Graph display options
  const [showSemanticEdges, setShowSemanticEdges] = useState(true);
  const [minEdgeStrength, setMinEdgeStrength] = useState(0.5);

  // Load knowledge entries
  const loadEntries = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/knowledge/entries', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load entries');
      }

      const data = await response.json();
      setEntries(data.entries || []);
    } catch (error) {
      console.error('Error loading entries:', error);
      setError('Failed to load knowledge entries');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load graph data
  const loadGraphData = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams({
        include_relationships: 'true',
        include_clusters: 'true',
        min_strength: minEdgeStrength.toString()
      });

      const response = await fetch(`/api/knowledge/graph?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load graph data');
      }

      const data = await response.json();
      setGraphData(data);
    } catch (error) {
      console.error('Error loading graph data:', error);
      // Provide mock data for development when backend is unavailable
      const mockGraphData: GraphData = {
        nodes: [
          { id: '1', label: 'AI Research', category: 'concept', size: 20, color: '#3b82f6' },
          { id: '2', label: 'Machine Learning', category: 'concept', size: 18, color: '#10b981' },
          { id: '3', label: 'Neural Networks', category: 'concept', size: 16, color: '#f59e0b' }
        ],
        edges: [
          { source: '1', target: '2', type: 'related', weight: 0.8, opacity: 0.8 },
          { source: '2', target: '3', type: 'related', weight: 0.9, opacity: 0.9 }
        ],
        clusters: [
          { id: 'ai', name: 'Artificial Intelligence', color: '#3b82f6' }
        ]
      };
      setGraphData(mockGraphData);
      setError('Using mock data - backend unavailable');
    } finally {
      setIsLoading(false);
    }
  }, [minEdgeStrength]);

  // Load data on component mount
  useEffect(() => {
    loadEntries();
    if (activeTab === 'graph') {
      loadGraphData();
    }
  }, [activeTab, loadEntries, loadGraphData]);

  // Handle node click in graph
  const handleNodeClick = useCallback((node: any) => {
    const entry = entries.find(e => e.id === node.id);
    if (entry) {
      setSelectedEntry(entry);
    }
  }, [entries]);

  // Handle search result click
  const handleSearchResultClick = useCallback((result: SearchResult) => {
    const entry = entries.find(e => e.id === result.id);
    if (entry) {
      setSelectedEntry(entry);
    }
  }, [entries]);

  // Refresh data
  const handleRefresh = useCallback(() => {
    loadEntries();
    if (activeTab === 'graph') {
      loadGraphData();
    }
  }, [activeTab, loadEntries, loadGraphData]);

  // Filter entries by category
  const filteredEntries = selectedCategories.length > 0 
    ? entries.filter(entry => selectedCategories.includes(entry.category))
    : entries;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <CubeIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Knowledge Hub
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Semantic search & 3D visualization
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Add Entry
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 border-b border-slate-200 dark:border-slate-700">
            {[
              { id: 'search', label: 'Search', icon: MagnifyingGlassIcon },
              { id: 'graph', label: '3D Graph', icon: CubeIcon },
              { id: 'entries', label: 'All Entries', icon: RectangleStackIcon },
              { id: 'analytics', label: 'Analytics', icon: ChartBarIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="text-red-800 dark:text-red-200 text-sm">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {activeTab === 'search' && (
              <div className="space-y-6">
                <KnowledgeSearchPanel
                  selectedCategories={selectedCategories}
                  onCategoryChange={setSelectedCategories}
                  onResultClick={handleSearchResultClick}
                  className="h-[600px]"
                />
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      3D Knowledge Graph
                    </h2>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={showSemanticEdges}
                          onChange={(e) => setShowSemanticEdges(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span className="text-slate-600 dark:text-slate-300">Semantic edges</span>
                      </label>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600 dark:text-slate-300">Min strength:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={minEdgeStrength}
                          onChange={(e) => setMinEdgeStrength(parseFloat(e.target.value))}
                          className="w-20"
                        />
                        <span className="text-slate-600 dark:text-slate-300 w-8">
                          {(minEdgeStrength * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <KnowledgeGraph3D
                    graphData={graphData}
                    onNodeClick={handleNodeClick}
                    selectedCategories={selectedCategories}
                    showSemanticEdges={showSemanticEdges}
                    minEdgeStrength={minEdgeStrength}
                    width={800}
                    height={600}
                  />
                </div>
              </div>
            )}

            {activeTab === 'entries' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      All Knowledge Entries ({filteredEntries.length})
                    </h2>
                  </div>
                  
                  <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
                    {filteredEntries.map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {entry.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            {!entry.has_embedding && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-1 rounded">
                                Indexing...
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full
                              ${entry.category === 'ai' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                entry.category === 'database' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                entry.category === 'frontend' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {entry.category}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                          {entry.content.substring(0, 200)}...
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-2">
                            {entry.tags.length > 0 && (
                              <span>{entry.tags.slice(0, 3).join(', ')}</span>
                            )}
                          </div>
                          <span>
                            {new Date(entry.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Total Entries
                        </p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                          {entries.length}
                        </p>
                      </div>
                      <RectangleStackIcon className="h-8 w-8 text-blue-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          With Embeddings
                        </p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                          {entries.filter(e => e.has_embedding).length}
                        </p>
                      </div>
                      <CubeIcon className="h-8 w-8 text-green-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Categories
                        </p>
                        <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                          {new Set(entries.map(e => e.category)).size}
                        </p>
                      </div>
                      <Squares2X2Icon className="h-8 w-8 text-purple-500" />
                    </div>
                  </div>
                </div>

                {/* Category breakdown */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Category Breakdown
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(
                      entries.reduce((acc, entry) => {
                        acc[entry.category] = (acc[entry.category] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-300 capitalize">
                          {category}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${(count / entries.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 w-8">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Category Filter */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Filter by Category
              </h3>
              <div className="space-y-2">
                {['ai', 'database', 'frontend', 'backend', 'security', 'ml', 'devops', 'general'].map((category) => {
                  const count = entries.filter(e => e.category === category).length;
                  return (
                    <label key={category} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories([...selectedCategories, category]);
                          } else {
                            setSelectedCategories(selectedCategories.filter(c => c !== category));
                          }
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-slate-600 dark:text-slate-300 capitalize">
                        {category} ({count})
                      </span>
                    </label>
                  );
                })}
              </div>
              
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Selected Entry Details */}
            {selectedEntry && (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Entry Details
                  </h3>
                  <button
                    onClick={() => setSelectedEntry(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ×
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                      {selectedEntry.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-4">
                      {selectedEntry.content}
                    </p>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Category:</span>
                      <span className="text-slate-900 dark:text-slate-100">{selectedEntry.category}</span>
                    </div>
                    
                    {selectedEntry.tags.length > 0 && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Tags:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedEntry.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Importance:</span>
                      <span className="text-slate-900 dark:text-slate-100">
                        {(selectedEntry.importance_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Updated:</span>
                      <span className="text-slate-900 dark:text-slate-100">
                        {new Date(selectedEntry.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeHubPage;