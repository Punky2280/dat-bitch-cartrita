/**
 * @fileoverview Main MCP (Master Control Program) Entry Point
 * Cartrita Hierarchical MCP System - Tier 0, 1, and 2 Integration
 */
// Core MCP exports
export * from './core/index.js';
// Orchestrator exports (Tier 0)
export { MCPOrchestrator } from './orchestrator/index.js';
// Supervisor exports (Tier 1)
export { IntelligenceSupervisor } from './supervisors/intelligence/index.js';
export { MultiModalSupervisor } from './supervisors/multimodal/index.js';
// Agent exports (Tier 2)
export { AgentRegistry } from './supervisors/intelligence/agents/agent-registry.js';
export { WriterAgent } from './supervisors/intelligence/agents/writer-agent.js';
export { CodeWriterAgent } from './supervisors/intelligence/agents/codewriter-agent.js';
export { AnalyticsAgent } from './supervisors/intelligence/agents/analytics-agent.js';
export { ResearchAgent } from './supervisors/intelligence/agents/research-agent.js';
export { LangChainAgentExecutor } from './supervisors/intelligence/agents/langchain-executor.js';
export { HuggingFaceLanguageAgent } from './supervisors/intelligence/agents/huggingface-language.js';
export { DeepgramAgent } from './supervisors/multimodal/agents/deepgram-agent.js';
// Utility exports
export { CostManager } from './supervisors/intelligence/cost/cost-manager.js';
export { QualityGate } from './supervisors/intelligence/quality/quality-gate.js';
export { ModelCache } from './supervisors/intelligence/cache/model-cache.js';
export { TaskRouter } from './supervisors/intelligence/routing/task-router.js';
export { StreamManager } from './supervisors/multimodal/streaming/stream-manager.js';
export { SensorFusion } from './supervisors/multimodal/fusion/sensor-fusion.js';
export { MediaProcessor } from './supervisors/multimodal/processing/media-processor.js';
/**
 * Initialize the complete MCP system
 */
export async function initializeMCPSystem(config = {}) {
    const { Logger } = await import('./core/index.js');
    const logger = Logger.create('MCPSystem');
    logger.info('Initializing Cartrita MCP System...');
    // Initialize Orchestrator (Tier 0)
    const { MCPOrchestrator } = await import('./orchestrator/index.js');
    const orchestrator = new MCPOrchestrator(config.orchestrator);
    // Initialize Intelligence Supervisor (Tier 1)
    const { IntelligenceSupervisor } = await import('./supervisors/intelligence/index.js');
    const intelligence = new IntelligenceSupervisor(config.intelligence);
    // Initialize MultiModal Supervisor (Tier 1)  
    const { MultiModalSupervisor } = await import('./supervisors/multimodal/index.js');
    const multimodal = new MultiModalSupervisor(config.multimodal);
    // Initialize all components
    await Promise.all([
        orchestrator.initialize(),
        intelligence.initialize(),
        multimodal.initialize()
    ]);
    logger.info('Cartrita MCP System initialized successfully');
    return {
        orchestrator,
        intelligence,
        multimodal
    };
}
/**
 * Shutdown the complete MCP system
 */
export async function shutdownMCPSystem(system) {
    const { Logger } = await import('./core/index.js');
    const logger = Logger.create('MCPSystem');
    logger.info('Shutting down Cartrita MCP System...');
    await Promise.all([
        system.orchestrator.shutdown(),
        system.intelligence.shutdown(),
        system.multimodal.shutdown()
    ]);
    logger.info('Cartrita MCP System shutdown complete');
}
