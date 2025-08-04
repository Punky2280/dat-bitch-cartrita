// packages/backend/src/agi/consciousness/CoreAgent.js

/**
 * Unified CoreAgent - Single Point of Entry
 * 
 * This is the ONE and ONLY core agent for Cartrita. It uses the enhanced
 * LangChain orchestration system that properly handles: null
 * - Time/date queries via getCurrentDateTime tool
 * - Image generation via ArtistAgent integration  
 * - Advanced agent routing and tool orchestration
 * - Personality adaptation and user context
 * 
 * This replaces all previous core agent implementations.
 */

import EnhancedLangChainCoreAgent from './EnhancedLangChainCoreAgent.js';

// Export a singleton instance of the enhanced core agent
export default new EnhancedLangChainCoreAgent();