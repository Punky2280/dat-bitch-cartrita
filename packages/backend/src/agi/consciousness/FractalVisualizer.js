class FractalVisualizer {
  constructor() {
    this.activeSubAgents = [];
  }

  // Simulate spawning a sub-agent
  spawn(agentType) {
    if (!this.activeSubAgents.includes(agentType)) {
      this.activeSubAgents.push(agentType);
    }
  }

  // Simulate despawning a sub-agent
  despawn(agentType) {
    this.activeSubAgents = this.activeSubAgents.filter(
      agent => agent !== agentType
    );
  }

  getVisualizationData() {
    const nodes = [{ id: 'core', type: 'core', name: 'Cartrita Core' }];
    const links = [];

    this.activeSubAgents.forEach(agentType => {
      nodes.push({
        id: agentType,
        type: 'sub-agent',
        name: `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent`,
      });
      links.push({ source: 'core', target: agentType });
    });

    return { nodes, links };
  }
}

// Export a single instance to maintain state
module.exports = new FractalVisualizer();
