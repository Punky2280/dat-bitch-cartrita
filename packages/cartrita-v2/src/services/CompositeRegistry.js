/**
 * Composite Registry - Tool Registration Management
 * Handles registration and management of agent tools across the system
 */

import { logger } from '../core/logger.js';

export class CompositeRegistry {
    constructor() {
        this.tools = new Map();
        this.categories = new Map();
        this.initialized = false;
    }

    async initialize() {
        try {
            logger.info('🛠️ Initializing Composite Registry...');
            
            // Initialize basic tool categories
            this.setupBasicCategories();
            
            this.initialized = true;
            logger.info('✅ Composite Registry initialized successfully');
            
            return true;
        } catch (error) {
            logger.error('❌ Failed to initialize Composite Registry:', error);
            throw error;
        }
    }

    setupBasicCategories() {
        const categories = [
            'system',
            'computation',
            'communication', 
            'data',
            'ai',
            'utilities'
        ];

        categories.forEach(category => {
            this.categories.set(category, {
                name: category,
                tools: [],
                enabled: true
            });
        });
    }

    registerTool(toolName, toolDefinition, category = 'utilities') {
        try {
            if (this.tools.has(toolName)) {
                logger.warn(`⚠️ Tool ${toolName} already registered, overwriting`);
            }

            const tool = {
                name: toolName,
                definition: toolDefinition,
                category,
                registeredAt: new Date(),
                enabled: true
            };

            this.tools.set(toolName, tool);
            
            // Add to category
            if (this.categories.has(category)) {
                this.categories.get(category).tools.push(toolName);
            }

            logger.debug(`🔧 Registered tool: ${toolName} in category: ${category}`);
            return true;
        } catch (error) {
            logger.error(`❌ Failed to register tool ${toolName}:`, error);
            return false;
        }
    }

    getTool(toolName) {
        return this.tools.get(toolName);
    }

    getToolsByCategory(category) {
        const categoryData = this.categories.get(category);
        if (!categoryData) return [];

        return categoryData.tools.map(toolName => this.tools.get(toolName)).filter(Boolean);
    }

    getAllTools() {
        return Array.from(this.tools.values());
    }

    enableTool(toolName) {
        const tool = this.tools.get(toolName);
        if (tool) {
            tool.enabled = true;
            return true;
        }
        return false;
    }

    disableTool(toolName) {
        const tool = this.tools.get(toolName);
        if (tool) {
            tool.enabled = false;
            return true;
        }
        return false;
    }

    getEnabledTools() {
        return Array.from(this.tools.values()).filter(tool => tool.enabled);
    }

    getToolCount() {
        return this.tools.size;
    }

    getStatus() {
        return {
            initialized: this.initialized,
            totalTools: this.tools.size,
            enabledTools: this.getEnabledTools().length,
            categories: Array.from(this.categories.keys())
        };
    }
}

export default CompositeRegistry;