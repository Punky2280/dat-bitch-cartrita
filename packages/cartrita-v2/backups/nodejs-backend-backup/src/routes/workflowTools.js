import express from 'express';
import WorkflowToolsService from '../services/WorkflowToolsService.js';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// Get all workflow categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await WorkflowToolsService.getCategories();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('[WorkflowTools] Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
});

// Search workflow tools
router.get('/search', async (req, res) => {
  try {
    const {
      q: searchQuery = '',
      limit = 20,
      offset = 0,
      category_id,
      tool_type,
      complexity_level,
      embedding, // Base64 encoded embedding for semantic search
    } = req.query;

    let parsedEmbedding = null;
    if (embedding) {
      try {
        // Decode base64 embedding
        const embeddingArray = JSON.parse(
          Buffer.from(embedding, 'base64').toString()
        );
        parsedEmbedding = `[${embeddingArray.join(',')}]`;
      } catch (e) {
        console.warn('[WorkflowTools] Invalid embedding format:', e.message);
      }
    }

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      category_id: category_id ? parseInt(category_id) : undefined,
      tool_type,
      complexity_level,
      embedding: parsedEmbedding,
    };

    const tools = await WorkflowToolsService.searchWorkflowTools(
      searchQuery,
      options
    );

    res.json({
      success: true,
      data: tools,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: tools.length,
      },
    });
  } catch (error) {
    console.error('[WorkflowTools] Error searching tools:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search workflow tools',
    });
  }
});

// Get trending/popular tools
router.get('/trending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const tools = await WorkflowToolsService.getTrendingTools(parseInt(limit));

    res.json({
      success: true,
      data: tools,
    });
  } catch (error) {
    console.error('[WorkflowTools] Error fetching trending tools:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending tools',
    });
  }
});

// Get workflow tool by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tool = await WorkflowToolsService.getWorkflowTool(parseInt(id));

    if (!tool) {
      return res.status(404).json({
        success: false,
        message: 'Workflow tool not found',
      });
    }

    res.json({
      success: true,
      data: tool,
    });
  } catch (error) {
    console.error('[WorkflowTools] Error fetching tool:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow tool',
    });
  }
});

// Add new workflow tool (authenticated)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const toolData = {
      ...req.body,
      author: req.user?.name || 'Anonymous',
    };

    // Generate embedding for the tool if OpenAI is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const embeddingText = `${toolData.title} ${toolData.description} ${
          toolData.use_case || ''
        } ${toolData.tags?.join(' ') || ''}`;
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingText,
        });

        toolData.embedding = `[${embeddingResponse.data[0].embedding.join(
          ','
        )}]`;
      } catch (embeddingError) {
        console.warn(
          '[WorkflowTools] Failed to generate embedding:',
          embeddingError.message
        );
      }
    }

    const result = await WorkflowToolsService.addWorkflowTool(toolData);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Workflow tool added successfully',
    });
  } catch (error) {
    console.error('[WorkflowTools] Error adding tool:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add workflow tool',
    });
  }
});

// Log workflow execution (authenticated)
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const executionData = {
      tool_id: parseInt(id),
      user_id: req.user?.id,
      ...req.body,
    };

    const result =
      await WorkflowToolsService.logWorkflowExecution(executionData);

    res.json({
      success: true,
      data: result,
      message: 'Execution logged successfully',
    });
  } catch (error) {
    console.error('[WorkflowTools] Error logging execution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log execution',
    });
  }
});

// Get user favorites (authenticated)
router.get('/user/favorites', authenticateToken, async (req, res) => {
  try {
    const { type } = req.query;
    const favorites = await WorkflowToolsService.getUserFavorites(
      req.user.id,
      type
    );

    res.json({
      success: true,
      data: favorites,
    });
  } catch (error) {
    console.error('[WorkflowTools] Error fetching user favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user favorites',
    });
  }
});

// Search manual sections
router.get('/manual/search', async (req, res) => {
  try {
    const {
      q: searchQuery = '',
      limit = 20,
      offset = 0,
      section_type,
      difficulty_level,
      embedding,
    } = req.query;

    let parsedEmbedding = null;
    if (embedding) {
      try {
        const embeddingArray = JSON.parse(
          Buffer.from(embedding, 'base64').toString()
        );
        parsedEmbedding = `[${embeddingArray.join(',')}]`;
      } catch (e) {
        console.warn('[WorkflowTools] Invalid embedding format:', e.message);
      }
    }

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      section_type,
      difficulty_level,
      embedding: parsedEmbedding,
    };

    const sections = await WorkflowToolsService.searchManualSections(
      searchQuery,
      options
    );

    res.json({
      success: true,
      data: sections,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: sections.length,
      },
    });
  } catch (error) {
    console.error('[WorkflowTools] Error searching manual sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search manual sections',
    });
  }
});

// Add manual section (authenticated)
router.post('/manual', authenticateToken, async (req, res) => {
  try {
    const sectionData = {
      ...req.body,
      last_updated_by: req.user?.name || 'Anonymous',
    };

    // Generate embedding for the section if OpenAI is available
    if (process.env.OPENAI_API_KEY) {
      try {
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const embeddingText = `${sectionData.title} ${sectionData.content}`;
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingText,
        });

        sectionData.embedding = `[${embeddingResponse.data[0].embedding.join(
          ','
        )}]`;
      } catch (embeddingError) {
        console.warn(
          '[WorkflowTools] Failed to generate embedding:',
          embeddingError.message
        );
      }
    }

    const result = await WorkflowToolsService.addManualSection(sectionData);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Manual section added successfully',
    });
  } catch (error) {
    console.error('[WorkflowTools] Error adding manual section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add manual section',
    });
  }
});

// Bulk import tools (authenticated admin only)
router.post('/bulk-import', authenticateToken, async (req, res) => {
  try {
    // Simple admin check - you might want to implement proper role-based auth
    if (req.user?.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    const { tools } = req.body;
    if (!Array.isArray(tools)) {
      return res.status(400).json({
        success: false,
        message: 'Expected an array of tools',
      });
    }

    const results = [];
    const errors = [];

    // Process tools with OpenTelemetry tracing
    await OpenTelemetryTracing.traceOperation(
      'workflow-tools.bulk-import',
      { attributes: { 'import.count': tools.length } },
      async span => {
        for (let i = 0; i < tools.length; i++) {
          try {
            const toolData = {
              ...tools[i],
              author: req.user?.name || 'System Import',
            };

            // Generate embedding if OpenAI is available
            if (process.env.OPENAI_API_KEY) {
              try {
                const { default: OpenAI } = await import('openai');
                const openai = new OpenAI({
                  apiKey: process.env.OPENAI_API_KEY,
                });

                const embeddingText = `${toolData.title} ${
                  toolData.description
                } ${toolData.use_case || ''} ${toolData.tags?.join(' ') || ''}`;
                const embeddingResponse = await openai.embeddings.create({
                  model: 'text-embedding-3-small',
                  input: embeddingText,
                });

                toolData.embedding = `[${embeddingResponse.data[0].embedding.join(
                  ','
                )}]`;
              } catch (embeddingError) {
                console.warn(
                  `[WorkflowTools] Failed to generate embedding for tool ${i}:`,
                  embeddingError.message
                );
              }
            }

            const result = await WorkflowToolsService.addWorkflowTool(toolData);
            results.push(result);
          } catch (error) {
            console.error(`[WorkflowTools] Error importing tool ${i}:`, error);
            errors.push({
              index: i,
              tool: tools[i]?.title || `Tool ${i}`,
              error: error.message,
            });
          }
        }

        span.setAttributes({
          'import.success_count': results.length,
          'import.error_count': errors.length,
        });
      }
    );

    res.json({
      success: true,
      data: {
        imported: results.length,
        errorCount: errors.length,
        results,
        errors,
      },
      message: `Successfully imported ${results.length} tools with ${errors.length} errors`,
    });
  } catch (error) {
    console.error('[WorkflowTools] Error in bulk import:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import tools',
    });
  }
});

export default router;
