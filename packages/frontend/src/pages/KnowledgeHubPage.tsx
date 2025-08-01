import React, { useState, useEffect, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { useThemedStyles } from '../context/ThemeContext';
 
interface KnowledgeHubPageProps {
  token: string;
  onBack: () => void;
}

interface KnowledgeEntry {
  id: number;
  title: string;
  content: string;
  content_type: string;
  category: string;
  tags: string[];
  importance_score: number;
  access_count: number;
  created_at: string;
  cluster_names?: string[];
}

interface KnowledgeCluster {
  id: number;
  name: string;
  description: string;
  color: string;
  entry_count: number;
  entries?: any[];
  size: number;
}

interface GraphNode {
  id: string;
  name: string;
  val: number;
  color: string;
  group: string;
  type: 'entry' | 'cluster';
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
}

interface SearchResult {
  id: number;
  title: string;
  content: string;
  similarity: number;
  cluster_names: string[];
}

export const KnowledgeHubPage: React.FC<KnowledgeHubPageProps> = ({ token, onBack }) => {
  const themedStyles = useThemedStyles();
  const [activeView, setActiveView] = useState<'overview' | 'graph' | 'search' | 'entries' | 'create'>('overview');
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [clusters, setClusters] = useState<KnowledgeCluster[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Create entry state
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    content_type: 'text',
    category: 'general',
    tags: [] as string[],
    importance_score: 0.5
  });
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');
  
  const fgRef = useRef<any>();

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [entriesRes, clustersRes, graphRes] = await Promise.all([
        fetch('/api/knowledge/entries', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/knowledge/clusters', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/knowledge/graph', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [entriesData, clustersData, graphData] = await Promise.all([
        entriesRes.json(),
        clustersRes.json(),
        graphRes.json()
      ]);

      if (entriesData.success) setEntries(entriesData.entries);
      if (clustersData.success) setClusters(clustersData.clusters);
      if (graphData.success) setGraphData(transformGraphData(graphData.graph));
    } catch (error) {
      console.error('Error loading knowledge data:', error);
    } finally {
      setLoading(false);
    }
  };

  const transformGraphData = (data: any) => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Add entry nodes
    data.nodes.forEach((entry: any) => {
      nodes.push({
        id: `entry_${entry.id}`,
        name: entry.title,
        val: entry.importance_score * 10 + 5,
        color: getContentTypeColor(entry.content_type),
        group: entry.category,
        type: 'entry'
      });
    });

    // Add cluster nodes
    clusters.forEach((cluster) => {
      nodes.push({
        id: `cluster_${cluster.id}`,
        name: cluster.name,
        val: cluster.size * 2 + 10,
        color: cluster.color,
        group: 'cluster',
        type: 'cluster'
      });
    });

    // Add relationship links
    data.edges.forEach((edge: any) => {
      links.push({
        source: `entry_${edge.source_entry_id}`,
        target: `entry_${edge.target_entry_id}`,
        value: edge.strength * 5
      });
    });

    return { nodes, links };
  };

  const getContentTypeColor = (contentType: string): string => {
    const colors: { [key: string]: string } = {
      text: '#3B82F6',
      code: '#10B981',
      image: '#F59E0B',
      document: '#8B5CF6',
      link: '#EF4444'
    };
    return colors[contentType] || '#6B7280';
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 20,
          threshold: 0.6
        })
      });

      const data = await response.json();
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Error searching knowledge:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateEntry = async () => {
    try {
      const response = await fetch('/api/knowledge/entries', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newEntry)
      });

      const data = await response.json();
      if (data.success) {
        setNewEntry({
          title: '',
          content: '',
          content_type: 'text',
          category: 'general',
          tags: [],
          importance_score: 0.5
        });
        setActiveView('entries');
        loadData();
      }
    } catch (error) {
      console.error('Error creating knowledge entry:', error);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const categoryMatch = categoryFilter === 'all' || entry.category === categoryFilter;
    const typeMatch = contentTypeFilter === 'all' || entry.content_type === contentTypeFilter;
    return categoryMatch && typeMatch;
  });

  const categories = [...new Set(entries.map(e => e.category))];
  const contentTypes = [...new Set(entries.map(e => e.content_type))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-white text-xl mt-4">Loading Knowledge Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-animated text-white">
      {/* Header */}
      <header className="glass-card border-b border-gray-600/50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800/50"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gradient">
                🧠 AI Knowledge Hub
              </h1>
              <p className="text-gray-400 mt-1">
                Your personal Memory Palace - Discover, connect, and explore knowledge
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setActiveView('create')}
              className="px-4 py-2 bg-gradient-purple rounded-lg font-semibold transition-all duration-300 hover:scale-105 flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Add Knowledge</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: '📊' },
              { id: 'graph', name: '3D Knowledge Graph', icon: '🕸️' },
              { id: 'search', name: 'Semantic Search', icon: '🔍' },
              { id: 'entries', name: 'All Entries', icon: '📚' },
              { id: 'create', name: 'Create Entry', icon: '✏️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeView === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {activeView === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100">Total Entries</p>
                    <p className="text-2xl font-bold">{entries.length}</p>
                  </div>
                  <div className="text-3xl">📚</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100">Knowledge Clusters</p>
                    <p className="text-2xl font-bold">{clusters.length}</p>
                  </div>
                  <div className="text-3xl">🧩</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100">Categories</p>
                    <p className="text-2xl font-bold">{categories.length}</p>
                  </div>
                  <div className="text-3xl">🏷️</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100">Avg. Importance</p>
                    <p className="text-2xl font-bold">
                      {entries.length > 0 ? (entries.reduce((sum, e) => sum + e.importance_score, 0) / entries.length * 100).toFixed(0) : 0}%
                    </p>
                  </div>
                  <div className="text-3xl">⭐</div>
                </div>
              </div>
            </div>

            {/* Recent Entries & Clusters */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Entries */}
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <span>🕒</span>
                  <span>Recent Entries</span>
                </h2>
                <div className="space-y-4">
                  {entries.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{entry.title}</h3>
                          <p className="text-gray-400 text-sm mt-1 line-clamp-2">{entry.content}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>{entry.content_type}</span>
                            <span>{entry.category}</span>
                            <span>{new Date(entry.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-12 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500"
                              style={{ width: `${entry.importance_score * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Knowledge Clusters */}
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <span>🎯</span>
                  <span>Knowledge Clusters</span>
                </h2>
                <div className="space-y-4">
                  {clusters.slice(0, 5).map((cluster) => (
                    <div key={cluster.id} className="border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: cluster.color }}
                          />
                          <div>
                            <h3 className="font-semibold text-white">{cluster.name}</h3>
                            <p className="text-gray-400 text-sm">{cluster.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-purple-400">{cluster.entry_count || 0}</div>
                          <div className="text-xs text-gray-500">entries</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'graph' && (
          <div className="h-screen bg-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold">3D Knowledge Graph</h2>
              <p className="text-gray-400 text-sm">Interactive visualization of your knowledge network</p>
            </div>
            <div className="h-full">
              {graphData && (
                <ForceGraph3D
                  ref={fgRef}
                  graphData={graphData}
                  nodeLabel="name"
                  nodeColor="color"
                  nodeVal="val"
                  linkWidth="value"
                  backgroundColor="#1F2937"
                  showNavInfo={false}
                  controlType="orbit"
                  onNodeClick={(node: any) => {
                    console.log('Node clicked:', node);
                  }}
                  nodeThreeObject={(node: any) => {
                    try {
                      const canvas = document.createElement('canvas');
                      const context = canvas.getContext('2d');
                      if (!context) return new THREE.Mesh();
                      
                      canvas.width = 256;
                      canvas.height = 256;
                      
                      context.fillStyle = node.color || '#3B82F6';
                      context.beginPath();
                      context.arc(128, 128, 100, 0, 2 * Math.PI);
                      context.fill();
                      
                      context.fillStyle = 'white';
                      context.font = '32px Arial';
                      context.textAlign = 'center';
                      context.fillText(node.type === 'cluster' ? '🧩' : '📄', 128, 140);
                      
                      const texture = new THREE.CanvasTexture(canvas);
                      const material = new THREE.SpriteMaterial({ map: texture });
                      const sprite = new THREE.Sprite(material);
                      sprite.scale.set(node.val || 1, node.val || 1, 1);
                      return sprite;
                    } catch (error) {
                      console.error('Error creating node sprite:', error);
                      // Fallback to simple geometry
                      const geometry = new THREE.SphereGeometry(node.val || 1);
                      const material = new THREE.MeshBasicMaterial({ color: node.color || '#3B82F6' });
                      return new THREE.Mesh(geometry, material);
                    }
                  }}
                />
              )}
            </div>
          </div>
        )}

        {activeView === 'search' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Semantic Search</h2>
              <div className="flex space-x-4">
                <input
                  type="text"
                  placeholder="Search your knowledge base..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
                >
                  {isSearching ? '🔍 Searching...' : '🔍 Search'}
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Search Results ({searchResults.length})</h3>
                {searchResults.map((result) => (
                  <div key={result.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-purple-500 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">{result.title}</h3>
                      <div className="flex items-center space-x-2">
                        <div className="px-2 py-1 bg-purple-600 text-white rounded text-xs">
                          {(result.similarity * 100).toFixed(0)}% match
                        </div>
                      </div>
                    </div>
                    <p className="text-gray-300 mb-3 line-clamp-3">{result.content}</p>
                    <div className="flex items-center space-x-2">
                      {result.cluster_names.map((cluster, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                          {cluster}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'entries' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">All Knowledge Entries</h2>
              <div className="flex space-x-4">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select
                  value={contentTypeFilter}
                  onChange={(e) => setContentTypeFilter(e.target.value)}
                  className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Types</option>
                  {contentTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Entries Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-purple-500 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-white text-lg">{entry.title}</h3>
                    <div className="flex items-center space-x-1">
                      <span className="text-yellow-400">⭐</span>
                      <span className="text-sm text-gray-400">{(entry.importance_score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 text-sm mb-4 line-clamp-3">{entry.content}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span className="px-2 py-1 bg-gray-700 rounded">{entry.content_type}</span>
                    <span className="px-2 py-1 bg-gray-700 rounded">{entry.category}</span>
                    <span>{entry.access_count} views</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {entry.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-purple-600 text-purple-100 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs text-gray-500">
                    Created {new Date(entry.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'create' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-6">Create New Knowledge Entry</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                  <input
                    type="text"
                    value={newEntry.title}
                    onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                    placeholder="Enter knowledge title..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Content</label>
                  <textarea
                    value={newEntry.content}
                    onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                    placeholder="Enter your knowledge content..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Content Type</label>
                    <select
                      value={newEntry.content_type}
                      onChange={(e) => setNewEntry({ ...newEntry, content_type: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="text">Text</option>
                      <option value="code">Code</option>
                      <option value="image">Image</option>
                      <option value="document">Document</option>
                      <option value="link">Link</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                    <select
                      value={newEntry.category}
                      onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="general">General</option>
                      <option value="programming">Programming</option>
                      <option value="ai">AI & ML</option>
                      <option value="business">Business</option>
                      <option value="personal">Personal</option>
                      <option value="research">Research</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Importance Score: {(newEntry.importance_score * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={newEntry.importance_score}
                    onChange={(e) => setNewEntry({ ...newEntry, importance_score: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tags (comma-separated)</label>
                  <input
                    type="text"
                    onChange={(e) => setNewEntry({ ...newEntry, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                    placeholder="ai, machine learning, neural networks..."
                  />
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={handleCreateEntry}
                    className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
                  >
                    Create Knowledge Entry
                  </button>
                  <button
                    onClick={() => setActiveView('entries')}
                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};