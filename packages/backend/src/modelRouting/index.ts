// Export legacy HuggingFace router for backwards compatibility
export { HuggingFaceRouterService } from './HuggingFaceRouterService';

// Export new Model Registry System components
export * from './types';
export * from './schemas';
export { ModelRouter } from './ModelRouter';
export { CostEstimator } from './CostEstimator';
export { BenchmarkHarness } from './BenchmarkHarness';
export { SafetyPipeline } from './SafetyPipeline';
export { ModelRegistryEventEmitter } from './EventEmitter';
export { ModelRegistryService } from './ModelRegistryService';

// Export main service as default
export { ModelRegistryService as default } from './ModelRegistryService';

// Legacy exports
import routerService from './HuggingFaceRouterService';
export { routerService as legacyRouter };
