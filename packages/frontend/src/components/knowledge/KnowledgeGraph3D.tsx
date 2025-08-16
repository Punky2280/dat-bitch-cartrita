import React, { useEffect, useRef, useState, useMemo } from 'react';
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';

interface Node {
  id: string;
  label: string;
  category: string;
  tags: string[];
  importance: number;
  size: number;
  degree: number;
  x?: number;
  y?: number;
  z?: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  opacity: number;
}

interface Cluster {
  id: string;
  name: string;
  color: string;
  entry_count: number;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
  clusters: Cluster[];
  meta: {
    node_count: number;
    edge_count: number;
    cluster_count: number;
  };
}

interface KnowledgeGraph3DProps {
  graphData: GraphData | null;
  onNodeClick?: (node: Node) => void;
  onNodeHover?: (node: Node | null) => void;
  selectedCategories?: string[];
  showSemanticEdges?: boolean;
  minEdgeStrength?: number;
  width?: number;
  height?: number;
  className?: string;
  enablePhysics?: boolean;
  enableParticles?: boolean;
  clusteringAlgorithm?: 'force' | 'community' | 'hierarchy';
}

const KnowledgeGraph3D: React.FC<KnowledgeGraph3DProps> = ({
  graphData,
  onNodeClick,
  onNodeHover,
  selectedCategories = [],
  showSemanticEdges = true,
  minEdgeStrength = 0.5,
  width = 800,
  height = 600
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Category color mapping
  const categoryColors = useMemo(() => ({
    'ai': '#8b5cf6',
    'database': '#06b6d4',
    'frontend': '#10b981',
    'security': '#f59e0b',
    'general': '#64748b',
    'backend': '#ef4444',
    'ml': '#ec4899',
    'devops': '#14b8a6'
  }), []);

  // Filter graph data based on user selections
  const filteredGraphData = useMemo(() => {
    if (!graphData || !graphData.nodes || !graphData.edges) return null;

    let nodes = [...graphData.nodes];
    let edges = [...graphData.edges];

    // Filter by categories
    if (selectedCategories.length > 0) {
      nodes = nodes.filter(node => selectedCategories.includes(node.category));
      const nodeIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    }

    // Filter by semantic edges
    if (!showSemanticEdges) {
      edges = edges.filter(edge => edge.type !== 'semantic');
    }

    // Filter by edge strength
    edges = edges.filter(edge => edge.weight >= minEdgeStrength);

    return { ...graphData, nodes, edges };
  }, [graphData, selectedCategories, showSemanticEdges, minEdgeStrength]);

  // Initialize and update the 3D graph
  useEffect(() => {
    if (!mountRef.current || !filteredGraphData) return;

    // Create or update the graph
    if (!graphRef.current) {
      const ctor: any = ForceGraph3D as any;
      graphRef.current = new ctor()(mountRef.current);
    }

    const graph = graphRef.current;

    // Configure graph
    graph
      .width(width)
      .height(height)
      .backgroundColor('#0f172a')
      .graphData(filteredGraphData)
      .nodeId('id')
      .nodeLabel((node: Node) => `
        <div class="bg-slate-800 text-white p-3 rounded-lg shadow-lg max-w-sm">
          <div class="font-bold text-lg mb-2">${node.label}</div>
          <div class="text-sm text-slate-300 mb-2">Category: ${node.category}</div>
          <div class="text-sm text-slate-300 mb-2">Connections: ${node.degree}</div>
          <div class="text-sm text-slate-300 mb-2">Importance: ${(node.importance * 100).toFixed(0)}%</div>
          ${node.tags.length > 0 ? `<div class="text-xs text-slate-400">Tags: ${node.tags.join(', ')}</div>` : ''}
        </div>
      `)
      .nodeColor((node: Node) => {
        if (selectedNode && selectedNode.id === node.id) {
          return '#fbbf24'; // Highlight selected node
        }
        return categoryColors[node.category as keyof typeof categoryColors] || categoryColors.general;
      })
      .nodeVal((node: Node) => Math.max(1, node.size * 2))
      .nodeThreeObject((node: Node) => {
        // Create text sprite for node labels
        const sprite = new SpriteText(node.label);
        sprite.color = selectedNode && selectedNode.id === node.id ? '#fbbf24' : '#ffffff';
        sprite.textHeight = Math.max(4, node.importance * 8);
        sprite.borderWidth = 2;
        sprite.borderColor = categoryColors[node.category as keyof typeof categoryColors] || categoryColors.general;
        sprite.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        sprite.padding = 2;
        return sprite;
      })
      .linkSource('source')
      .linkTarget('target')
      .linkLabel((edge: Edge) => `
        <div class="bg-slate-800 text-white p-2 rounded shadow-lg">
          <div class="text-sm font-medium">${edge.type.replace('_', ' ').toUpperCase()}</div>
          <div class="text-xs text-slate-300">Strength: ${(edge.weight * 100).toFixed(0)}%</div>
        </div>
      `)
      .linkColor((edge: Edge) => {
        const alpha = edge.opacity;
        switch (edge.type) {
          case 'semantic':
            return `rgba(139, 92, 246, ${alpha})`; // Purple for semantic
          case 'references':
            return `rgba(34, 197, 94, ${alpha})`; // Green for references
          case 'similar_to':
            return `rgba(239, 68, 68, ${alpha})`; // Red for similarity
          default:
            return `rgba(148, 163, 184, ${alpha})`; // Gray for others
        }
      })
      .linkWidth((edge: Edge) => Math.max(0.5, edge.weight * 3))
      .linkOpacity((edge: Edge) => edge.opacity)
      .linkDirectionalArrowLength(3)
      .linkDirectionalArrowColor((edge: Edge) => {
        switch (edge.type) {
          case 'semantic':
            return '#8b5cf6';
          case 'references':
            return '#22c55e';
          case 'similar_to':
            return '#ef4444';
          default:
            return '#94a3b8';
        }
      })
      .onNodeClick((node: Node) => {
        setSelectedNode(node);
        onNodeClick?.(node);
      })
      .onNodeHover((node: Node | null) => {
        mountRef.current!.style.cursor = node ? 'pointer' : 'default';
        onNodeHover?.(node);
      })
      .onLinkHover((link: any) => {
        mountRef.current!.style.cursor = link ? 'pointer' : 'default';
      })
      .cooldownTicks(100)
      .d3AlphaDecay(0.02)
      .d3VelocityDecay(0.1);

    // Add controls hint
    const controlsHint = document.createElement('div');
    controlsHint.innerHTML = `
      <div class="absolute bottom-4 left-4 bg-slate-800 text-white p-3 rounded-lg text-xs">
        <div class="font-medium mb-1">Controls:</div>
        <div>• Mouse: Rotate view</div>
        <div>• Scroll: Zoom in/out</div>
        <div>• Click: Select node</div>
        <div>• Drag: Move camera</div>
      </div>
    `;
    controlsHint.style.position = 'absolute';
    controlsHint.style.bottom = '16px';
    controlsHint.style.left = '16px';
    controlsHint.style.zIndex = '10';
    controlsHint.style.pointerEvents = 'none';
    
    if (mountRef.current) {
      // Remove existing controls hint
      const existingHint = mountRef.current.querySelector('.controls-hint');
      if (existingHint) {
        existingHint.remove();
      }
      
      controlsHint.className = 'controls-hint';
      mountRef.current.appendChild(controlsHint);
    }

    return () => {
      // Cleanup
      if (graphRef.current) {
        graphRef.current._destructor?.();
      }
    };
  }, [filteredGraphData, width, height, selectedNode, categoryColors, onNodeClick, onNodeHover]);

  // Loading state
  if (!graphData) {
    return (
      <div 
        ref={mountRef}
        className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg"
        style={{ width, height }}
      >
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-slate-400">Loading knowledge graph...</div>
        </div>
      </div>
    );
  }

  // Empty state
  if (filteredGraphData?.nodes.length === 0) {
    return (
      <div 
        ref={mountRef}
        className="w-full h-full flex items-center justify-center bg-slate-900 rounded-lg"
        style={{ width, height }}
      >
        <div className="text-center">
          <div className="text-6xl mb-4">🧠</div>
          <div className="text-slate-400 text-lg mb-2">No knowledge entries found</div>
          <div className="text-slate-500 text-sm">
            {selectedCategories.length > 0 
              ? 'Try adjusting your category filters'
              : 'Create some knowledge entries to see the graph'
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        ref={mountRef} 
        className="rounded-lg overflow-hidden shadow-2xl border border-slate-700"
        style={{ width, height }}
      />
      
      {/* Graph Statistics */}
      <div className="absolute top-4 right-4 bg-slate-800 text-white p-3 rounded-lg text-sm">
        <div className="font-medium mb-2">Graph Statistics</div>
        <div className="space-y-1 text-xs">
          <div>Nodes: {filteredGraphData ? filteredGraphData.nodes.length : 0}</div>
          <div>Edges: {filteredGraphData ? filteredGraphData.edges.length : 0}</div>
          <div>Clusters: {filteredGraphData ? filteredGraphData.clusters.length : 0}</div>
        </div>
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="absolute top-4 left-4 bg-slate-800 text-white p-4 rounded-lg max-w-sm">
          <div className="font-bold text-lg mb-2">{selectedNode.label}</div>
          <div className="space-y-1 text-sm">
            <div><span className="text-slate-400">Category:</span> {selectedNode.category}</div>
            <div><span className="text-slate-400">Connections:</span> {selectedNode.degree}</div>
            <div><span className="text-slate-400">Importance:</span> {(selectedNode.importance * 100).toFixed(0)}%</div>
            {selectedNode.tags.length > 0 && (
              <div>
                <span className="text-slate-400">Tags:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedNode.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 bg-slate-700 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-slate-800 text-white p-3 rounded-lg text-xs">
        <div className="font-medium mb-2">Edge Types:</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-purple-500"></div>
            <span>Semantic</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-500"></div>
            <span>References</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-500"></div>
            <span>Similar</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-slate-400"></div>
            <span>Other</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraph3D;