/**
 * Workflow Graph Validator
 * 
 * Provides graph validation including cycle detection,
 * reachability analysis, and structural validation for workflows.
 */

class WorkflowGraphValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate complete workflow graph
   */
  validateWorkflow(workflow) {
    this.errors = [];
    this.warnings = [];

    const { nodes = [], edges = [] } = workflow;

    // Basic structural validation
    this.validateNodes(nodes);
    this.validateEdges(edges, nodes);

    // Graph topology validation
    if (this.errors.length === 0) {
      this.validateGraphTopology(nodes, edges);
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  /**
   * Validate nodes structure and configuration
   */
  validateNodes(nodes) {
    if (!Array.isArray(nodes)) {
      this.errors.push('Nodes must be an array');
      return;
    }

    if (nodes.length === 0) {
      this.errors.push('Workflow must contain at least one node');
      return;
    }

    const nodeIds = new Set();
    let hasStartNode = false;
    let hasEndNode = false;

    for (const [index, node] of nodes.entries()) {
      if (!node.id) {
        this.errors.push(`Node at index ${index} is missing required 'id' field`);
        continue;
      }

      if (nodeIds.has(node.id)) {
        this.errors.push(`Duplicate node ID: ${node.id}`);
        continue;
      }
      nodeIds.add(node.id);

      if (!node.type) {
        this.errors.push(`Node ${node.id} is missing required 'type' field`);
        continue;
      }

      // Check for start and end nodes
      if (node.type === 'start' || node.type === 'trigger-manual') {
        hasStartNode = true;
      }
      if (node.type === 'end' || node.type === 'output') {
        hasEndNode = true;
      }

      // Validate node-specific configuration
      this.validateNodeConfiguration(node);
    }

    if (!hasStartNode) {
      this.warnings.push('Workflow should have at least one start/trigger node');
    }

    if (!hasEndNode) {
      this.warnings.push('Workflow should have at least one end/output node');
    }
  }

  /**
   * Validate edges structure and references
   */
  validateEdges(edges, nodes) {
    if (!Array.isArray(edges)) {
      this.errors.push('Edges must be an array');
      return;
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    const edgeSet = new Set();

    for (const [index, edge] of edges.entries()) {
      if (!edge.source) {
        this.errors.push(`Edge at index ${index} is missing required 'source' field`);
        continue;
      }

      if (!edge.target) {
        this.errors.push(`Edge at index ${index} is missing required 'target' field`);
        continue;
      }

      if (!nodeIds.has(edge.source)) {
        this.errors.push(`Edge ${index} references non-existent source node: ${edge.source}`);
      }

      if (!nodeIds.has(edge.target)) {
        this.errors.push(`Edge ${index} references non-existent target node: ${edge.target}`);
      }

      // Check for duplicate edges
      const edgeKey = `${edge.source}->${edge.target}`;
      if (edgeSet.has(edgeKey)) {
        this.warnings.push(`Duplicate edge: ${edgeKey}`);
      }
      edgeSet.add(edgeKey);

      // Self-loops are generally not allowed in workflows
      if (edge.source === edge.target) {
        this.errors.push(`Self-loop detected at node: ${edge.source}`);
      }
    }
  }

  /**
   * Validate graph topology (cycles, reachability, etc.)
   */
  validateGraphTopology(nodes, edges) {
    const graph = this.buildAdjacencyList(nodes, edges);
    
    // Cycle detection
    const cycles = this.detectCycles(graph);
    if (cycles.length > 0) {
      this.errors.push(`Cycles detected in workflow: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
    }

    // Reachability analysis
    this.validateReachability(graph, nodes);

    // Check for isolated nodes
    this.validateConnectivity(graph, nodes);
  }

  /**
   * Validate node-specific configuration
   */
  validateNodeConfiguration(node) {
    const { type, data = {} } = node;

    switch (type) {
      case 'transform':
        this.validateTransformNode(node.id, data);
        break;
      case 'http-request':
        this.validateHttpRequestNode(node.id, data);
        break;
      case 'delay':
        this.validateDelayNode(node.id, data);
        break;
      case 'set-variable':
        this.validateSetVariableNode(node.id, data);
        break;
      default:
        // For now, just warn about unknown types
        this.warnings.push(`Unknown node type '${type}' for node ${node.id}`);
    }
  }

  /**
   * Validate Transform node configuration
   */
  validateTransformNode(nodeId, data) {
    const { transformations = [] } = data;

    if (!Array.isArray(transformations)) {
      this.errors.push(`Transform node ${nodeId}: transformations must be an array`);
      return;
    }

    for (const [index, transformation] of transformations.entries()) {
      if (!transformation.type) {
        this.errors.push(`Transform node ${nodeId}: transformation ${index} missing type`);
      }

      const validTypes = ['map', 'filter', 'extract', 'format'];
      if (transformation.type && !validTypes.includes(transformation.type)) {
        this.errors.push(`Transform node ${nodeId}: invalid transformation type '${transformation.type}'`);
      }
    }
  }

  /**
   * Validate HTTP Request node configuration
   */
  validateHttpRequestNode(nodeId, data) {
    const { method = 'GET', url, timeout = 10000 } = data;

    if (!url) {
      this.errors.push(`HTTP Request node ${nodeId}: URL is required`);
    }

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(method.toUpperCase())) {
      this.errors.push(`HTTP Request node ${nodeId}: invalid method '${method}'`);
    }

    if (typeof timeout !== 'number' || timeout <= 0) {
      this.errors.push(`HTTP Request node ${nodeId}: timeout must be a positive number`);
    }

    if (timeout > 300000) { // 5 minutes max
      this.warnings.push(`HTTP Request node ${nodeId}: timeout exceeds recommended maximum (5 minutes)`);
    }
  }

  /**
   * Validate Delay node configuration
   */
  validateDelayNode(nodeId, data) {
    const { duration = 1000, unit = 'milliseconds', maxWait = 30000 } = data;

    if (typeof duration !== 'number' || duration <= 0) {
      this.errors.push(`Delay node ${nodeId}: duration must be a positive number`);
    }

    const validUnits = ['milliseconds', 'seconds', 'minutes', 'hours'];
    if (!validUnits.includes(unit.toLowerCase())) {
      this.errors.push(`Delay node ${nodeId}: invalid unit '${unit}'`);
    }

    if (typeof maxWait !== 'number' || maxWait <= 0) {
      this.errors.push(`Delay node ${nodeId}: maxWait must be a positive number`);
    }

    // Convert to milliseconds for validation
    let delayMs = duration;
    switch (unit.toLowerCase()) {
      case 'seconds': delayMs *= 1000; break;
      case 'minutes': delayMs *= 60000; break;
      case 'hours': delayMs *= 3600000; break;
    }

    if (delayMs > 3600000) { // 1 hour max
      this.warnings.push(`Delay node ${nodeId}: delay exceeds recommended maximum (1 hour)`);
    }
  }

  /**
   * Validate Set Variable node configuration
   */
  validateSetVariableNode(nodeId, data) {
    const { variableName, value, type = 'string' } = data;

    if (!variableName) {
      this.errors.push(`Set Variable node ${nodeId}: variableName is required`);
    }

    if (variableName && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variableName)) {
      this.errors.push(`Set Variable node ${nodeId}: invalid variable name '${variableName}' (must be valid identifier)`);
    }

    if (value === undefined || value === null) {
      this.warnings.push(`Set Variable node ${nodeId}: value is empty`);
    }

    const validTypes = ['string', 'number', 'boolean', 'json'];
    if (!validTypes.includes(type.toLowerCase())) {
      this.errors.push(`Set Variable node ${nodeId}: invalid type '${type}'`);
    }
  }

  /**
   * Build adjacency list representation of the graph
   */
  buildAdjacencyList(nodes, edges) {
    const graph = {};
    
    // Initialize all nodes
    for (const node of nodes) {
      graph[node.id] = [];
    }

    // Add edges
    for (const edge of edges) {
      if (graph[edge.source] && graph[edge.target] !== undefined) {
        graph[edge.source].push(edge.target);
      }
    }

    return graph;
  }

  /**
   * Detect cycles using DFS
   */
  detectCycles(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (node, path = []) => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        cycles.push([...path.slice(cycleStart), node]);
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      for (const neighbor of graph[node] || []) {
        if (dfs(neighbor, [...path])) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Validate reachability from start nodes
   */
  validateReachability(graph, nodes) {
    const startNodes = nodes.filter(n => 
      n.type === 'start' || n.type === 'trigger-manual'
    ).map(n => n.id);

    if (startNodes.length === 0) {
      return; // Already warned about this
    }

    const reachable = new Set();

    const dfs = (node) => {
      if (reachable.has(node)) return;
      reachable.add(node);
      
      for (const neighbor of graph[node] || []) {
        dfs(neighbor);
      }
    };

    // Start DFS from all start nodes
    for (const startNode of startNodes) {
      dfs(startNode);
    }

    // Check if all nodes are reachable
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        this.warnings.push(`Node ${node.id} is not reachable from any start node`);
      }
    }
  }

  /**
   * Validate connectivity (no isolated nodes)
   */
  validateConnectivity(graph, nodes) {
    const connected = new Set();

    // Build undirected graph for connectivity check
    const undirectedGraph = {};
    for (const node of nodes) {
      undirectedGraph[node.id] = new Set();
    }

    for (const [source, targets] of Object.entries(graph)) {
      for (const target of targets) {
        undirectedGraph[source].add(target);
        undirectedGraph[target].add(source);
      }
    }

    const dfs = (node) => {
      if (connected.has(node)) return;
      connected.add(node);
      
      for (const neighbor of undirectedGraph[node] || []) {
        dfs(neighbor);
      }
    };

    // Start from first node
    if (nodes.length > 0) {
      dfs(nodes[0].id);
    }

    // Check for isolated nodes
    for (const node of nodes) {
      if (!connected.has(node.id)) {
        this.warnings.push(`Node ${node.id} is isolated (no connections)`);
      }
    }
  }

  /**
   * Get topological sort order (if no cycles)
   */
  getTopologicalOrder(nodes, edges) {
    const graph = this.buildAdjacencyList(nodes, edges);
    const inDegree = {};
    const result = [];
    const queue = [];

    // Initialize in-degree count
    for (const node of nodes) {
      inDegree[node.id] = 0;
    }

    // Calculate in-degrees
    for (const [source, targets] of Object.entries(graph)) {
      for (const target of targets) {
        inDegree[target]++;
      }
    }

    // Find nodes with no incoming edges
    for (const node of nodes) {
      if (inDegree[node.id] === 0) {
        queue.push(node.id);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);

      for (const neighbor of graph[current] || []) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check if all nodes were processed (no cycles)
    if (result.length !== nodes.length) {
      return null; // Cycle detected
    }

    return result;
  }
}

export default WorkflowGraphValidator;