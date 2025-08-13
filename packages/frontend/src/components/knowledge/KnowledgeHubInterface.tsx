/**
 * Knowledge Hub Interface - Main dashboard for knowledge management
 * Integrates 3D graph, entry management, search, and analytics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Search, Plus, BarChart3, Network } from 'lucide-react';
import KnowledgeGraph3D from './KnowledgeGraph3D';
// import { toast } from 'sonner';

interface KnowledgeEntry {
  id: number;
  title: string;
  content: string;
  content_type: string;
  category: string;
  subcategory?: string;
  tags: string[];
  importance_score: number;
  similarity?: number;
  cluster_names?: string[];
  created_at: string;
  updated_at: string;
}

interface KnowledgeCluster {
  id: number;
  name: string;
  description: string;
  entry_count: number;
  avg_importance: number;
  color: string;
  size: number;
}

// Using graph data shape from KnowledgeGraph3D; no local GraphData interface needed

interface Analytics {
  total_entries: number;
  total_clusters: number;
  total_relationships: number;
  avg_importance: number;
  categories_count: number;
  knowledge_density: number;
  recent_entries: number;
}

interface KnowledgeHubInterfaceProps {
  onCreateEntry?: () => void;
  onEditEntry?: (entry: KnowledgeEntry) => void;
}

const KnowledgeHubInterface: React.FC<KnowledgeHubInterfaceProps> = ({ 
  onCreateEntry, 
  onEditEntry 
}) => {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [clusters, setClusters] = useState<KnowledgeCluster[]>([]);
  const [graphData, setGraphData] = useState<any>({
    nodes: [],
    edges: [],
    clusters: [],
    meta: { node_count: 0, edge_count: 0, cluster_count: 0 }
  });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
    content_type: 'all',
    importance_min: 0
  });

  // Get auth token
  const getAuthToken = () => localStorage.getItem('token');

  // API call wrapper
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const response = await fetch(`/api/knowledge${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  };

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [entriesData, clustersData, graphResult, analyticsData] = await Promise.all([
        apiCall('/entries?limit=50'),
        apiCall('/clusters'),
        apiCall('/graph'),
        apiCall('/analytics')
      ]);

      setEntries(entriesData.entries || []);
      setClusters(clustersData.clusters || []);
      setGraphData(
        graphResult.graph || {
          nodes: [],
          edges: [],
          clusters: [],
          meta: { node_count: 0, edge_count: 0, cluster_count: 0 }
        }
      );
      setAnalytics(analyticsData.analytics || null);
    } catch (error) {
  console.error('Failed to load knowledge hub data', error);
    } finally {
      setLoading(false);
    }
  };

  // Search functionality
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const result = await apiCall('/search', {
        method: 'POST',
        body: JSON.stringify({
          query: searchQuery,
          search_type: 'semantic',
          limit: 20
        })
      });

      setSearchResults(result.results || []);
      setActiveTab('search');
    } catch (error) {
  console.error('Search failed', error);
    } finally {
      setLoading(false);
    }
  };

  // Create new entry
  // const createEntry = async (entryData: Partial<KnowledgeEntry>) => {
  //   try {
  //     const result = await apiCall('/entries', {
  //       method: 'POST',
  //       body: JSON.stringify(entryData)
  //     });
  //     console.log('Knowledge entry created successfully');
  //     loadDashboardData(); // Refresh data
  //     return result.entry;
  //   } catch (error) {
  //     console.error('Failed to create entry', error);
  //   }
  // };

  // Delete entry
  const deleteEntry = async (entryId: number) => {
    try {
      await apiCall(`/entries/${entryId}`, { method: 'DELETE' });
  console.log('Entry deleted successfully');
      loadDashboardData();
    } catch (error) {
  console.error('Failed to delete entry', error);
    }
  };

  // Auto-cluster entries
  const performAutoClustering = async () => {
    setLoading(true);
    try {
      await apiCall('/cluster-entries', {
        method: 'POST',
        body: JSON.stringify({
          algorithm: 'kmeans',
          num_clusters: 5
        })
      });

  console.log('Auto-clustering completed');
      loadDashboardData();
    } catch (error) {
  console.error('Auto-clustering failed', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle graph node selection
  const handleNodeClick = useCallback((node: any) => {
    const entry = entries.find(e => e.id.toString() === node.id);
    if (entry) {
      setSelectedEntry(entry);
      setActiveTab('details');
    }
  }, [entries]);

  const filteredEntries = entries.filter(entry => {
    if (filters.category !== 'all' && entry.category !== filters.category) return false;
    if (filters.content_type !== 'all' && entry.content_type !== filters.content_type) return false;
    if (entry.importance_score < filters.importance_min) return false;
    return true;
  });

  const categories = [...new Set(entries.map(e => e.category))];
  const contentTypes = [...new Set(entries.map(e => e.content_type))];

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Knowledge Hub</h1>
          <p className="text-slate-600 dark:text-slate-300">Advanced knowledge management with AI-powered insights</p>
        </div>
        
        <div className="flex gap-3">
          <Button onClick={performAutoClustering} disabled={loading} variant="outline">
            <Network className="w-4 h-4 mr-2" />
            Auto Cluster
          </Button>
          <Button onClick={() => onCreateEntry?.()} disabled={loading}>
            <Plus className="w-4 h-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search knowledge entries with AI semantic search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !searchQuery.trim()}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Entries</p>
                  <p className="text-2xl font-bold">{analytics.total_entries}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Knowledge Clusters</p>
                  <p className="text-2xl font-bold">{analytics.total_clusters}</p>
                </div>
                <Network className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Relationships</p>
                  <p className="text-2xl font-bold">{analytics.total_relationships}</p>
                </div>
                <Network className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Knowledge Density</p>
                  <p className="text-2xl font-bold">{(analytics.knowledge_density * 100).toFixed(1)}%</p>
                </div>
                <BarChart3 className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="graph">3D Graph</TabsTrigger>
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="search">Search Results</TabsTrigger>
          <TabsTrigger value="clusters">Clusters</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Entries */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Entries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {entries.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{entry.title}</h4>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary">{entry.category}</Badge>
                          <Badge variant="outline">{entry.content_type}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {(entry.importance_score * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Clusters */}
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Clusters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {clusters.slice(0, 5).map((cluster) => (
                    <div key={cluster.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: cluster.color }}
                        />
                        <div>
                          <h4 className="font-medium">{cluster.name}</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {cluster.entry_count} entries
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {(cluster.avg_importance * 100).toFixed(0)}% avg
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="graph">
          <Card>
            <CardHeader>
              <CardTitle>3D Knowledge Graph</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[600px]">
                <KnowledgeGraph3D
                  graphData={graphData}
                  onNodeClick={handleNodeClick}
                  width={800}
                  height={600}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="entries">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Knowledge Entries ({filteredEntries.length})</CardTitle>
                <div className="flex gap-2">
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
                    className="px-3 py-1 border rounded"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <select
                    value={filters.content_type}
                    onChange={(e) => setFilters(f => ({ ...f, content_type: e.target.value }))}
                    className="px-3 py-1 border rounded"
                  >
                    <option value="all">All Types</option>
                    {contentTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {filteredEntries.map((entry) => (
                  <div key={entry.id} className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{entry.title}</h3>
                        <p className="text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                          {entry.content.substring(0, 200)}...
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Badge variant="secondary">{entry.category}</Badge>
                          <Badge variant="outline">{entry.content_type}</Badge>
                          {entry.tags.map(tag => (
                            <Badge key={tag} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {(entry.importance_score * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditEntry?.(entry)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle>Search Results ({searchResults.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {searchQuery ? 'No results found for your search.' : 'Enter a search query to find relevant knowledge entries.'}
                </div>
              ) : (
                <div className="grid gap-4">
                  {searchResults.map((entry) => (
                    <div key={entry.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{entry.title}</h3>
                          {entry.similarity && (
                            <div className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                              {(entry.similarity * 100).toFixed(1)}% similarity
                            </div>
                          )}
                          <p className="text-slate-600 dark:text-slate-400 mt-1">
                            {entry.content.substring(0, 300)}...
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Badge variant="secondary">{entry.category}</Badge>
                            <Badge variant="outline">{entry.content_type}</Badge>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditEntry?.(entry)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clusters">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Clusters ({clusters.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clusters.map((cluster) => (
                  <div key={cluster.id} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: cluster.color }}
                      />
                      <h3 className="font-semibold">{cluster.name}</h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      {cluster.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Entries:</span> {cluster.entry_count}
                      </div>
                      <div>
                        <span className="font-medium">Avg Importance:</span> {(cluster.avg_importance * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Entry Details Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto m-4">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{selectedEntry.title}</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary">{selectedEntry.category}</Badge>
                    <Badge variant="outline">{selectedEntry.content_type}</Badge>
                    {selectedEntry.tags.map(tag => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
                <Button variant="outline" onClick={() => setSelectedEntry(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Content</h4>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border">
                    {selectedEntry.content}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-1">Importance Score</h4>
                    <p>{(selectedEntry.importance_score * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Created</h4>
                    <p>{new Date(selectedEntry.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {selectedEntry.cluster_names && selectedEntry.cluster_names.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Clusters</h4>
                    <div className="flex gap-2">
                      {selectedEntry.cluster_names.map(name => (
                        <Badge key={name} variant="secondary">{name}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelectedEntry(null)}>
                    Close
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      deleteEntry(selectedEntry.id);
                      setSelectedEntry(null);
                    }}
                  >
                    Delete Entry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default KnowledgeHubInterface;