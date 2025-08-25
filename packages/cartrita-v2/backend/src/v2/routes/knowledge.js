/*
 * Cartrita V2 Knowledge Domain Routes
 * Knowledge management, semantic search, and content organization endpoints
 */

import express from 'express';
import crypto from 'crypto';
import { body, query, validationResult } from 'express-validator';
import { CartritaV2ResponseFormatter } from '../utils/ResponseFormatter.js';
import { CartritaV2ErrorHandler } from '../utils/ErrorHandler.js';
import { CartritaV2Middleware } from '../middleware/index.js';
import { traceOperation } from '../../system/OpenTelemetryTracing.js';

const router = express.Router();

// Apply V2 middleware to all knowledge routes
router.use(CartritaV2Middleware.addV2Headers());
router.use(CartritaV2Middleware.traceV2Request('knowledge'));
router.use(CartritaV2Middleware.enhanceV2Context());
router.use(CartritaV2Middleware.authenticateV2Token());
router.use(CartritaV2Middleware.rateLimitV2({ max: 100, windowMs: 60000, domain: 'knowledge' }));

// V2 Knowledge Search Endpoint
router.get('/search', [
  query('q').isString().notEmpty().isLength({ min: 1, max: 500 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('type').optional().isIn(['document', 'snippet', 'workflow', 'template', 'all']),
  query('category').optional().isString(),
  query('semantic').optional().isBoolean(),
  query('threshold').optional().isFloat({ min: 0, max: 1 })
], async (req, res) => {
  const span = traceOperation('v2.knowledge.search');
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(CartritaV2ResponseFormatter.validationError(
        errors.array(),
        { domain: 'knowledge', request_id: req.requestId }
      ));
    }

    const {
      q: query,
      limit = 20,
      offset = 0,
      type = 'all',
      category,
      semantic = true,
      threshold = 0.7
    } = req.query;

    const startTime = Date.now();

    // Mock semantic search results
    const searchResults = generateMockKnowledgeResults(query, type, category, semantic, threshold);
    
    // Apply pagination
    const total = searchResults.length;
    const paginatedResults = searchResults.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    const searchResponse = {
      query,
      search_type: semantic ? 'semantic' : 'keyword',
      results: paginatedResults,
      metadata: {
        total_results: total,
        returned_results: paginatedResults.length,
        search_time_ms: Date.now() - startTime,
        semantic_threshold: semantic ? threshold : null,
        filters: {
          type: type !== 'all' ? type : null,
          category
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: (parseInt(offset) + parseInt(limit)) < total
        }
      }
    };

    res.json(CartritaV2ResponseFormatter.paginated(paginatedResults, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total
    }, {
      domain: 'knowledge',
      request_id: req.requestId,
      user_id: req.user.id,
      search_query: query,
      search_metadata: searchResponse.metadata
    }));
    
    span?.setAttributes({
      'knowledge.search.query': query,
      'knowledge.search.type': type,
      'knowledge.search.semantic': semantic,
      'knowledge.search.results_count': paginatedResults.length,
      'knowledge.user_id': req.user.id
    });
    
  } catch (error) {
    console.error('[V2 Knowledge] Search failed:', error);
    res.status(500).json(CartritaV2ResponseFormatter.error(
      'Knowledge search failed',
      500,
      { 
        domain: 'knowledge', 
        request_id: req.requestId,
        service: 'knowledge_search'
      }
    ));
  } finally {
    span?.end();
  }
});

// V2 Knowledge Entries Endpoint
router.get('/entries', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('category').optional().isString(),
  query('sort').optional().isIn(['created', 'updated', 'title', 'relevance']),
  query('order').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  const span = traceOperation('v2.knowledge.entries');
  
  try {
    const {
      limit = 50,
      offset = 0,
      category,
      sort = 'updated',
      order = 'desc'
    } = req.query;

    // Mock knowledge entries
    let entries = [
      {
        id: crypto.randomUUID(),
        title: 'Cartrita Multi-Agent System Architecture',
        type: 'document',
        category: 'architecture',
        content_preview: 'Comprehensive overview of the Cartrita multi-agent system, including supervisor patterns, delegation mechanisms, and state management...',
        tags: ['architecture', 'agents', 'system-design'],
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
        created_by: req.user.id,
        version: '1.2.0',
        word_count: 2500,
        read_time_minutes: 10,
        relevance_score: 0.95
      },
      {
        id: crypto.randomUUID(),
        title: 'V2 API Migration Guide',
        type: 'workflow',
        category: 'documentation',
        content_preview: 'Step-by-step guide for migrating from V1 to V2 API endpoints, including breaking changes, new features, and migration strategies...',
        tags: ['migration', 'api', 'v2', 'documentation'],
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
        created_by: 'system',
        version: '2.1.0',
        word_count: 1800,
        read_time_minutes: 7,
        relevance_score: 0.88
      },
      {
        id: crypto.randomUUID(),
        title: 'Security Best Practices Template',
        type: 'template',
        category: 'security',
        content_preview: 'Template for implementing security controls, authentication patterns, and audit logging in Cartrita applications...',
        tags: ['security', 'template', 'best-practices', 'authentication'],
        created_at: new Date(Date.now() - 259200000).toISOString(),
        updated_at: new Date(Date.now() - 10800000).toISOString(),
        created_by: 'SecurityAgent',
        version: '1.5.0',
        word_count: 1200,
        read_time_minutes: 5,
        relevance_score: 0.82
      },
      {
        id: crypto.randomUUID(),
        title: 'Knowledge Management Workflow',
        type: 'workflow',
        category: 'knowledge',
        content_preview: 'Automated workflow for knowledge capture, categorization, and retrieval using semantic search and AI-powered tagging...',
        tags: ['knowledge', 'workflow', 'automation', 'semantic-search'],
        created_at: new Date(Date.now() - 345600000).toISOString(),
        updated_at: new Date(Date.now() - 14400000).toISOString(),
        created_by: 'KnowledgeAgent',
        version: '1.0.0',
        word_count: 950,
        read_time_minutes: 4,
        relevance_score: 0.79
      }
    ];

    // Apply filters
    if (category) {
      entries = entries.filter(entry => entry.category === category);
    }

    // Apply sorting
    entries.sort((a, b) => {
      let comparison = 0;
      switch (sort) {
        case 'created':
          comparison = new Date(a.created_at) - new Date(b.created_at);
          break;
        case 'updated':
          comparison = new Date(a.updated_at) - new Date(b.updated_at);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'relevance':
          comparison = b.relevance_score - a.relevance_score;
          break;
      }
      return order === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const total = entries.length;
    const paginatedEntries = entries.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json(CartritaV2ResponseFormatter.paginated(paginatedEntries, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total
    }, {
      domain: 'knowledge',
      request_id: req.requestId,
      user_id: req.user.id,
      filters: { category, sort, order }
    }));
    
  } catch (error) {
    console.error('[V2 Knowledge] Entries fetch failed:', error);
    res.status(500).json(CartritaV2ResponseFormatter.error(
      'Failed to fetch knowledge entries',
      500,
      { domain: 'knowledge', request_id: req.requestId }
    ));
  } finally {
    span?.end();
  }
});

// V2 Knowledge Entry Detail Endpoint
router.get('/entries/:id', async (req, res) => {
  const span = traceOperation('v2.knowledge.entry_detail');
  
  try {
    const { id } = req.params;

    // Mock knowledge entry detail
    const entry = {
      id,
      title: 'Cartrita V2 Multi-Agent Architecture Deep Dive',
      type: 'document',
      category: 'architecture',
      content: `# Cartrita V2 Multi-Agent Architecture

## Overview
The Cartrita V2 system represents a significant evolution in multi-agent AI architectures, featuring:

- **Hierarchical Agent Organization**: Supervisor-delegated task management
- **Dynamic Agent Loading**: Runtime agent discovery and instantiation
- **State Graph Management**: LangChain StateGraph for conversation flow
- **OpenTelemetry Integration**: Comprehensive observability and tracing

## Core Components

### Supervisor Agent
The \`CartritaSupervisorAgent\` serves as the central orchestrator:
- Manages agent lifecycle and delegation
- Handles conversation state and context
- Implements recursion limits and safety guards
- Provides unified response formatting

### Specialized Sub-Agents
- **AnalyticsAgent**: Data analysis and insights
- **KnowledgeAgent**: Information retrieval and management
- **SecurityAgent**: Security monitoring and analysis
- **WorkflowAgent**: Process automation and orchestration

## Architecture Patterns

### Delegation Flow
1. Request arrives at supervisor
2. Task analysis and agent selection
3. Context preparation and handoff
4. Sub-agent processing
5. Response aggregation and formatting

### State Management
- Immutable state transitions
- Private state isolation per agent
- Context preservation across delegations
- Rollback capabilities for error scenarios

## Implementation Guidelines

### Agent Development
- Extend \`BaseAgent\` class
- Implement required interface methods
- Define \`allowedTools\` explicitly
- Include proper error handling

### Tool Integration
- Register tools in \`AgentToolRegistry\`
- Implement ownership validation
- Add OpenTelemetry tracing
- Follow response formatting standards

## Performance Considerations

### Optimization Strategies
- Agent result caching
- Context window management
- Selective tool loading
- Background task processing

### Monitoring Points
- Agent response times
- Delegation success rates
- Tool execution metrics
- Resource utilization

## Security Framework

### Authentication
- JWT-based token validation
- Session management
- Role-based access control
- API key rotation

### Data Protection
- Encryption at rest and in transit
- Audit logging
- Privacy controls
- Compliance frameworks

## Future Enhancements

### Planned Features
- Multi-modal agent capabilities
- Advanced reasoning chains
- External system integrations
- Real-time collaboration tools

This architecture provides a robust foundation for AI-powered automation while maintaining security, observability, and extensibility.`,
      tags: ['architecture', 'agents', 'system-design', 'v2'],
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      created_by: req.user.id,
      version: '2.0.0',
      word_count: 2847,
      read_time_minutes: 11,
      relevance_score: 0.95,
      related_entries: [
        {
          id: crypto.randomUUID(),
          title: 'V2 API Migration Guide',
          relevance: 0.88
        },
        {
          id: crypto.randomUUID(),
          title: 'Agent Development Best Practices',
          relevance: 0.85
        }
      ],
      edit_history: [
        {
          version: '2.0.0',
          edited_at: new Date(Date.now() - 3600000).toISOString(),
          edited_by: req.user.id,
          changes: 'Updated V2 architecture details'
        },
        {
          version: '1.5.0',
          edited_at: new Date(Date.now() - 86400000).toISOString(),
          edited_by: 'system',
          changes: 'Added security framework section'
        }
      ]
    };

    res.json(CartritaV2ResponseFormatter.success(entry, {
      domain: 'knowledge',
      request_id: req.requestId,
      user_id: req.user.id,
      entry_id: id
    }));
    
  } catch (error) {
    console.error('[V2 Knowledge] Entry detail fetch failed:', error);
    res.status(404).json(CartritaV2ResponseFormatter.error(
      'Knowledge entry not found',
      404,
      { domain: 'knowledge', request_id: req.requestId, entry_id: req.params.id }
    ));
  } finally {
    span?.end();
  }
});

// V2 Knowledge Creation Endpoint
router.post('/entries', [
  body('title').isString().notEmpty().isLength({ min: 1, max: 200 }),
  body('content').isString().notEmpty().isLength({ min: 10, max: 100000 }),
  body('type').isIn(['document', 'snippet', 'workflow', 'template']),
  body('category').isString().notEmpty(),
  body('tags').optional().isArray(),
  body('metadata').optional().isObject()
], async (req, res) => {
  const span = traceOperation('v2.knowledge.create_entry');
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(CartritaV2ResponseFormatter.validationError(
        errors.array(),
        { domain: 'knowledge', request_id: req.requestId }
      ));
    }

    const {
      title,
      content,
      type,
      category,
      tags = [],
      metadata = {}
    } = req.body;

    const entryId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newEntry = {
      id: entryId,
      title,
      content,
      type,
      category,
      tags,
      metadata,
      created_at: now,
      updated_at: now,
      created_by: req.user.id,
      version: '1.0.0',
      word_count: content.split(/\s+/).length,
      read_time_minutes: Math.ceil(content.split(/\s+/).length / 200), // ~200 words per minute
      status: 'published',
      visibility: 'private'
    };

    // Simulate content processing
    setTimeout(() => {
      console.log(`[V2 Knowledge] Entry ${entryId} created and indexed`);
    }, 1000);

    res.status(201).json(CartritaV2ResponseFormatter.success(newEntry, {
      domain: 'knowledge',
      request_id: req.requestId,
      user_id: req.user.id,
      action: 'create_entry',
      entry_id: entryId
    }));
    
    span?.setAttributes({
      'knowledge.entry.id': entryId,
      'knowledge.entry.type': type,
      'knowledge.entry.category': category,
      'knowledge.entry.word_count': newEntry.word_count,
      'knowledge.user_id': req.user.id
    });
    
  } catch (error) {
    console.error('[V2 Knowledge] Entry creation failed:', error);
    res.status(500).json(CartritaV2ResponseFormatter.error(
      'Failed to create knowledge entry',
      500,
      { 
        domain: 'knowledge', 
        request_id: req.requestId,
        service: 'knowledge_creation'
      }
    ));
  } finally {
    span?.end();
  }
});

// V2 Knowledge Categories Endpoint
router.get('/categories', async (req, res) => {
  const span = traceOperation('v2.knowledge.categories');
  
  try {
    const categories = [
      {
        name: 'architecture',
        display_name: 'System Architecture',
        description: 'System design patterns, architectural decisions, and technical blueprints',
        entry_count: 15,
        color: '#3B82F6',
        icon: 'architecture'
      },
      {
        name: 'documentation',
        display_name: 'Documentation',
        description: 'User guides, API documentation, and procedural information',
        entry_count: 32,
        color: '#10B981',
        icon: 'book'
      },
      {
        name: 'security',
        display_name: 'Security',
        description: 'Security protocols, best practices, and compliance information',
        entry_count: 8,
        color: '#EF4444',
        icon: 'shield'
      },
      {
        name: 'knowledge',
        display_name: 'Knowledge Management',
        description: 'Knowledge organization, retrieval strategies, and information architecture',
        entry_count: 12,
        color: '#8B5CF6',
        icon: 'brain'
      },
      {
        name: 'workflows',
        display_name: 'Workflows',
        description: 'Process automation, workflow templates, and operational procedures',
        entry_count: 24,
        color: '#F59E0B',
        icon: 'workflow'
      },
      {
        name: 'templates',
        display_name: 'Templates',
        description: 'Reusable templates, code snippets, and configuration patterns',
        entry_count: 18,
        color: '#06B6D4',
        icon: 'template'
      }
    ];

    const summary = {
      total_categories: categories.length,
      total_entries: categories.reduce((sum, cat) => sum + cat.entry_count, 0),
      most_popular: categories.reduce((max, cat) => cat.entry_count > max.entry_count ? cat : max),
      categories
    };

    res.json(CartritaV2ResponseFormatter.collection(categories, summary, {
      domain: 'knowledge',
      request_id: req.requestId,
      user_id: req.user.id,
      endpoint: 'categories'
    }));
    
  } catch (error) {
    console.error('[V2 Knowledge] Categories fetch failed:', error);
    res.status(500).json(CartritaV2ResponseFormatter.error(
      'Failed to fetch knowledge categories',
      500,
      { domain: 'knowledge', request_id: req.requestId }
    ));
  } finally {
    span?.end();
  }
});

// Helper Functions
function generateMockKnowledgeResults(query, type, category, semantic, threshold) {
  const baseResults = [
    {
      id: crypto.randomUUID(),
      title: 'Multi-Agent System Design Patterns',
      type: 'document',
      category: 'architecture',
      content_preview: 'Comprehensive guide to designing scalable multi-agent systems with proper delegation patterns...',
      relevance_score: 0.95,
      tags: ['agents', 'architecture', 'patterns'],
      match_type: semantic ? 'semantic' : 'keyword'
    },
    {
      id: crypto.randomUUID(),
      title: 'API Authentication Best Practices',
      type: 'template',
      category: 'security',
      content_preview: 'Template for implementing secure API authentication using JWT tokens and session management...',
      relevance_score: 0.87,
      tags: ['security', 'authentication', 'api'],
      match_type: semantic ? 'semantic' : 'keyword'
    },
    {
      id: crypto.randomUUID(),
      title: 'Knowledge Search Implementation',
      type: 'workflow',
      category: 'knowledge',
      content_preview: 'Step-by-step workflow for implementing semantic search with embedding generation and storage...',
      relevance_score: 0.82,
      tags: ['search', 'semantic', 'embeddings'],
      match_type: semantic ? 'semantic' : 'keyword'
    },
    {
      id: crypto.randomUUID(),
      title: 'Error Handling Strategies',
      type: 'snippet',
      category: 'documentation',
      content_preview: 'Code snippets and patterns for robust error handling in distributed systems...',
      relevance_score: 0.75,
      tags: ['error-handling', 'patterns', 'reliability'],
      match_type: 'keyword'
    }
  ];

  let filteredResults = baseResults;

  // Apply type filter
  if (type && type !== 'all') {
    filteredResults = filteredResults.filter(result => result.type === type);
  }

  // Apply category filter
  if (category) {
    filteredResults = filteredResults.filter(result => result.category === category);
  }

  // Apply semantic threshold
  if (semantic && threshold) {
    filteredResults = filteredResults.filter(result => result.relevance_score >= threshold);
  }

  // Add query-specific relevance adjustments
  const queryLower = query.toLowerCase();
  filteredResults.forEach(result => {
    if (result.title.toLowerCase().includes(queryLower) || 
        result.content_preview.toLowerCase().includes(queryLower)) {
      result.relevance_score = Math.min(1.0, result.relevance_score + 0.1);
    }
  });

  // Sort by relevance
  return filteredResults.sort((a, b) => b.relevance_score - a.relevance_score);
}

// Error handling middleware for knowledge routes
router.use(CartritaV2ErrorHandler.middleware());

export default router;