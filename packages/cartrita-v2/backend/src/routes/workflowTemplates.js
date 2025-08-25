/**
 * Workflow Templates API Routes
 * RESTful endpoints for template management, instantiation, and ratings
 * Based on WORKFLOW_TEMPLATES_SYSTEM_PLAN.md specification
 */

import express from 'express';
import WorkflowTemplateService from '../services/WorkflowTemplateService.js';
import authenticateToken from '../middleware/authenticateToken.js';

const router = express.Router();

/**
 * GET /api/workflow-templates/categories
 * Get all template categories (public endpoint for testing)
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await WorkflowTemplateService.getCategories();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching template categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template categories',
    });
  }
});

/**
 * GET /api/workflow-templates/public
 * Get public workflow templates (no auth required for testing)
 */
router.get('/public', async (req, res) => {
  try {
    const {
      category_id,
      include_variables = 'true',
      limit = '50',
      offset = '0',
    } = req.query;

    const options = {
      category_id: category_id ? parseInt(category_id) : undefined,
      user_id: 1, // Use default user for public templates
      include_variables: include_variables === 'true',
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const templates = await WorkflowTemplateService.getTemplates(options);

    res.json({
      success: true,
      data: templates,
      meta: {
        limit: options.limit,
        offset: options.offset,
        filters: {
          category_id: options.category_id || null,
          include_variables: options.include_variables,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching public templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch public templates',
    });
  }
});

// Middleware for authenticated routes
router.use(authenticateToken);

/**
 * GET /api/workflow-templates
 * Get workflow templates with filtering
 * Query params: category_id, include_variables, limit, offset
 */
router.get('/', async (req, res) => {
  try {
    const {
      category_id,
      include_variables = 'false',
      limit = '50',
      offset = '0',
    } = req.query;

    const options = {
      category_id: category_id ? parseInt(category_id) : undefined,
      user_id: req.user.id,
      include_variables: include_variables === 'true',
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const templates = await WorkflowTemplateService.getTemplates(options);

    res.json({
      success: true,
      data: templates,
      meta: {
        limit: options.limit,
        offset: options.offset,
        filters: {
          category_id: options.category_id || null,
          include_variables: options.include_variables,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
    });
  }
});

/**
 * GET /api/workflow-templates/:id
 * Get single template with full details
 */
router.get('/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const template = await WorkflowTemplateService.getTemplate(
      templateId,
      req.user.id
    );

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template',
    });
  }
});

/**
 * POST /api/workflow-templates
 * Create new workflow template
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      category_id,
      config = {},
      variables = [],
      metadata = {},
    } = req.body;

    // Validation
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Name and description are required',
      });
    }

    if (category_id && !Number.isInteger(category_id)) {
      return res.status(400).json({
        success: false,
        error: 'Category ID must be an integer',
      });
    }

    // Validate variables structure
    if (variables && Array.isArray(variables)) {
      for (const variable of variables) {
        if (!variable.var_name || typeof variable.var_name !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Each variable must have a valid var_name',
          });
        }
      }
    }

    const templateData = {
      name,
      description,
      category_id,
      config,
      variables,
      metadata,
    };

    const template = await WorkflowTemplateService.createTemplate(
      templateData,
      req.user.id
    );

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template',
    });
  }
});

/**
 * POST /api/workflow-templates/:id/instantiate
 * Instantiate template as new workflow
 */
router.post('/:id/instantiate', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { variables = {} } = req.body;

    const result = await WorkflowTemplateService.instantiateTemplate(
      templateId,
      variables,
      req.user.id
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Template instantiated successfully',
    });
  } catch (error) {
    console.error('Error instantiating template:', error);

    if (
      error.message.includes('Missing required variables') ||
      error.message.includes('Template not found')
    ) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to instantiate template',
    });
  }
});

/**
 * POST /api/workflow-templates/:id/rate
 * Rate a template
 */
router.post('/:id/rate', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be an integer between 1 and 5',
      });
    }

    const result = await WorkflowTemplateService.rateTemplate(
      templateId,
      req.user.id,
      rating,
      review
    );

    res.json({
      success: true,
      data: result,
      message: 'Template rated successfully',
    });
  } catch (error) {
    console.error('Error rating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rate template',
    });
  }
});

/**
 * GET /api/workflow-templates/:id/stats
 * Get template usage statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const stats = await WorkflowTemplateService.getTemplateStats(templateId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching template stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template statistics',
    });
  }
});

/**
 * GET /api/workflow-templates/:id/variables
 * Get template variables (convenience endpoint)
 */
router.get('/:id/variables', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const template = await WorkflowTemplateService.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template.variables || [],
    });
  } catch (error) {
    console.error('Error fetching template variables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template variables',
    });
  }
});

export default router;
