import express from 'express';
import multer from 'multer';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityAuditLogger from '../system/SecurityAuditLogger.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

/**
 * Business Intelligence Reporting API Routes
 * 
 * Provides comprehensive business intelligence endpoints including:
 * - Report generation and management
 * - Template management and customization
 * - Scheduled report automation
 * - Report export in multiple formats
 * - Executive dashboards and KPIs
 * - Business insights and analytics
 * - Compliance and audit reporting
 * - Performance monitoring reports
 */

// Middleware for BI route telemetry
const biMiddleware = (req, res, next) => {
  const span = OpenTelemetryTracing.getTracer('bi-api').startSpan(`bi_${req.method}_${req.route?.path || 'unknown'}`);
  req.span = span;
  
  res.on('finish', () => {
    span.setAttributes({
      'http.method': req.method,
      'http.url': req.originalUrl,
      'http.status_code': res.statusCode,
      'user.id': req.user?.id || 'anonymous'
    });
    
    if (res.statusCode >= 400) {
      span.setStatus({ code: 2, message: `HTTP ${res.statusCode}` });
    } else {
      span.setStatus({ code: 1, message: 'Success' });
    }
    
    span.end();
  });
  
  next();
};

router.use(biMiddleware);

// =======================
// REPORT GENERATION
// =======================

/**
 * Generate a report from a template
 * POST /api/bi/reports/generate
 */
router.post('/reports/generate', async (req, res) => {
  try {
    const { templateId, parameters = {}, options = {} } = req.body;
    
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'templateId is required'
      });
    }
    
    // Check if BI engine is available
    if (!req.app.locals.biEngine) {
      return res.status(503).json({
        success: false,
        error: 'Business Intelligence engine not available'
      });
    }
    
    // Enrich parameters with user context
    const enrichedParameters = {
      ...parameters,
      userId: req.user?.id,
      userRole: req.user?.role,
      generatedBy: req.user?.email || 'system'
    };
    
    const report = await req.app.locals.biEngine.generateReport(
      templateId,
      enrichedParameters,
      options
    );
    
    await SecurityAuditLogger.logSecurityEvent(
      'bi_report_generated',
      `Report generated from template ${templateId}`,
      { 
        templateId, 
        reportId: report.id, 
        userId: req.user?.id,
        executionTime: report.metadata.executionTime 
      }
    );
    
    res.json({
      success: true,
      data: report
    });
    
  } catch (error) {
    console.error('Error generating report:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    });
  }
});

/**
 * Get available report templates
 * GET /api/bi/templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { category, search } = req.query;
    
    if (!req.app.locals.biEngine) {
      return res.status(503).json({
        success: false,
        error: 'Business Intelligence engine not available'
      });
    }
    
    // Get all templates (in real implementation, this would be from database)
    const templates = [];
    const templateMap = req.app.locals.biEngine.templates;
    
    for (const [id, template] of templateMap) {
      // Filter by category if specified
      if (category && template.category !== category) {
        continue;
      }
      
      // Filter by search term if specified
      if (search && !template.name.toLowerCase().includes(search.toLowerCase()) &&
          !template.description.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }
      
      templates.push({
        id,
        name: template.name,
        description: template.description,
        category: template.category
      });
    }
    
    res.json({
      success: true,
      data: {
        templates,
        total: templates.length
      }
    });
    
  } catch (error) {
    console.error('Error getting templates:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get templates'
    });
  }
});

/**
 * Get template details
 * GET /api/bi/templates/:templateId
 */
router.get('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    
    if (!req.app.locals.biEngine) {
      return res.status(503).json({
        success: false,
        error: 'Business Intelligence engine not available'
      });
    }
    
    const template = req.app.locals.biEngine.templates.get(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    res.json({
      success: true,
      data: template
    });
    
  } catch (error) {
    console.error('Error getting template:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get template'
    });
  }
});

// =======================
// REPORT EXPORT
// =======================

/**
 * Export a report to specified format
 * POST /api/bi/reports/:reportId/export
 */
router.post('/reports/:reportId/export', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { format = 'pdf', options = {} } = req.body;
    
    if (!req.app.locals.biEngine) {
      return res.status(503).json({
        success: false,
        error: 'Business Intelligence engine not available'
      });
    }
    
    // In a real implementation, you would retrieve the report from storage
    // For now, we'll assume the report is passed in the request body
    const { report } = req.body;
    
    if (!report) {
      return res.status(400).json({
        success: false,
        error: 'Report data is required for export'
      });
    }
    
    const exportResult = await req.app.locals.biEngine.exportReport(
      report,
      format,
      options
    );
    
    await SecurityAuditLogger.logSecurityEvent(
      'bi_report_exported',
      `Report ${reportId} exported to ${format}`,
      { 
        reportId, 
        format, 
        filename: exportResult.filename,
        size: exportResult.size,
        userId: req.user?.id 
      }
    );
    
    res.json({
      success: true,
      data: exportResult
    });
    
  } catch (error) {
    console.error('Error exporting report:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to export report'
    });
  }
});

/**
 * Download exported report file
 * GET /api/bi/reports/download/:filename
 */
router.get('/reports/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }
    
    const reportsDir = process.env.REPORTS_DIR || './reports';
    const filepath = `${reportsDir}/${filename}`;
    
    // Check if file exists
    try {
      const fs = await import('fs/promises');
      await fs.access(filepath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Set appropriate headers
    const ext = filename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case 'pdf':
        contentType = 'application/pdf';
        break;
      case 'xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'csv':
        contentType = 'text/csv';
        break;
      case 'json':
        contentType = 'application/json';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    res.sendFile(path.resolve(filepath));
    
    await SecurityAuditLogger.logSecurityEvent(
      'bi_report_downloaded',
      `Report file ${filename} downloaded`,
      { filename, userId: req.user?.id }
    );
    
  } catch (error) {
    console.error('Error downloading report:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to download report'
    });
  }
});

// =======================
// SCHEDULED REPORTS
// =======================

/**
 * Schedule a report for automatic generation
 * POST /api/bi/reports/schedule
 */
router.post('/reports/schedule', async (req, res) => {
  try {
    const { templateId, schedule, parameters = {}, exportOptions = {} } = req.body;
    
    if (!templateId || !schedule) {
      return res.status(400).json({
        success: false,
        error: 'templateId and schedule are required'
      });
    }
    
    if (!req.app.locals.biEngine) {
      return res.status(503).json({
        success: false,
        error: 'Business Intelligence engine not available'
      });
    }
    
    // Enrich parameters with user context
    const enrichedParameters = {
      ...parameters,
      scheduledBy: req.user?.id,
      scheduledByEmail: req.user?.email
    };
    
    const scheduledReport = await req.app.locals.biEngine.scheduleReport(
      templateId,
      schedule,
      enrichedParameters,
      exportOptions
    );
    
    await SecurityAuditLogger.logSecurityEvent(
      'bi_report_scheduled',
      `Report ${templateId} scheduled for ${schedule}`,
      { 
        templateId, 
        scheduleId: scheduledReport.id,
        schedule,
        userId: req.user?.id 
      }
    );
    
    res.json({
      success: true,
      data: scheduledReport
    });
    
  } catch (error) {
    console.error('Error scheduling report:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to schedule report'
    });
  }
});

/**
 * Get scheduled reports
 * GET /api/bi/reports/scheduled
 */
router.get('/reports/scheduled', async (req, res) => {
  try {
    if (!req.app.locals.biEngine) {
      return res.status(503).json({
        success: false,
        error: 'Business Intelligence engine not available'
      });
    }
    
    const scheduledReports = Array.from(req.app.locals.biEngine.scheduledReports.values());
    
    res.json({
      success: true,
      data: {
        scheduledReports,
        total: scheduledReports.length
      }
    });
    
  } catch (error) {
    console.error('Error getting scheduled reports:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduled reports'
    });
  }
});

/**
 * Update scheduled report
 * PUT /api/bi/reports/scheduled/:scheduleId
 */
router.put('/reports/scheduled/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { schedule, parameters, exportOptions, isActive } = req.body;
    
    if (!req.app.locals.biEngine) {
      return res.status(503).json({
        success: false,
        error: 'Business Intelligence engine not available'
      });
    }
    
    const scheduledReport = req.app.locals.biEngine.scheduledReports.get(scheduleId);
    
    if (!scheduledReport) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled report not found'
      });
    }
    
    // Update fields if provided
    if (schedule !== undefined) scheduledReport.schedule = schedule;
    if (parameters !== undefined) scheduledReport.parameters = { ...scheduledReport.parameters, ...parameters };
    if (exportOptions !== undefined) scheduledReport.exportOptions = { ...scheduledReport.exportOptions, ...exportOptions };
    if (isActive !== undefined) scheduledReport.isActive = isActive;
    
    // Recalculate next run time if schedule changed
    if (schedule !== undefined) {
      scheduledReport.nextRun = req.app.locals.biEngine.calculateNextRun(schedule);
    }
    
    scheduledReport.updatedAt = new Date().toISOString();
    
    await SecurityAuditLogger.logSecurityEvent(
      'bi_scheduled_report_updated',
      `Scheduled report ${scheduleId} updated`,
      { scheduleId, updates: { schedule, parameters, exportOptions, isActive }, userId: req.user?.id }
    );
    
    res.json({
      success: true,
      data: scheduledReport
    });
    
  } catch (error) {
    console.error('Error updating scheduled report:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update scheduled report'
    });
  }
});

/**
 * Delete scheduled report
 * DELETE /api/bi/reports/scheduled/:scheduleId
 */
router.delete('/reports/scheduled/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    
    if (!req.app.locals.biEngine) {
      return res.status(503).json({
        success: false,
        error: 'Business Intelligence engine not available'
      });
    }
    
    const scheduledReport = req.app.locals.biEngine.scheduledReports.get(scheduleId);
    
    if (!scheduledReport) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled report not found'
      });
    }
    
    req.app.locals.biEngine.scheduledReports.delete(scheduleId);
    
    await SecurityAuditLogger.logSecurityEvent(
      'bi_scheduled_report_deleted',
      `Scheduled report ${scheduleId} deleted`,
      { scheduleId, templateId: scheduledReport.templateId, userId: req.user?.id }
    );
    
    res.json({
      success: true,
      message: 'Scheduled report deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete scheduled report'
    });
  }
});

// =======================
// EXECUTIVE DASHBOARD
// =======================

/**
 * Get executive dashboard data
 * GET /api/bi/dashboard/executive
 */
router.get('/dashboard/executive', async (req, res) => {
  try {
    const {
      timeRange = '30d',
      includeComparisons = true,
      includeForecasts = false
    } = req.query;
    
    if (!req.app.locals.biEngine) {
      return res.status(503).json({
        success: false,
        error: 'Business Intelligence engine not available'
      });
    }
    
    // Generate executive summary report
    const report = await req.app.locals.biEngine.generateReport(
      'executive_summary',
      {
        timeRange,
        includeComparisons: includeComparisons === 'true',
        includeForecasts: includeForecasts === 'true',
        userId: req.user?.id
      },
      { useCache: true }
    );
    
    res.json({
      success: true,
      data: {
        dashboard: report.data,
        metadata: report.metadata,
        lastUpdated: report.generatedAt
      }
    });
    
  } catch (error) {
    console.error('Error getting executive dashboard:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get executive dashboard'
    });
  }
});

/**
 * Get business KPIs
 * GET /api/bi/kpis
 */
router.get('/kpis', async (req, res) => {
  try {
    const { 
      category,
      timeRange = '24h',
      includeTargets = true,
      includeTrends = true 
    } = req.query;
    
    if (!req.app.locals.biEngine || !req.app.locals.analyticsEngine) {
      return res.status(503).json({
        success: false,
        error: 'Analytics engine not available'
      });
    }
    
    // Get KPIs from analytics engine
    const kpis = await req.app.locals.analyticsEngine.getBusinessKPIs({
      category,
      timeRange,
      includeTargets: includeTargets === 'true',
      includeTrends: includeTrends === 'true'
    });
    
    res.json({
      success: true,
      data: kpis
    });
    
  } catch (error) {
    console.error('Error getting KPIs:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get KPIs'
    });
  }
});

/**
 * Get BI engine status
 * GET /api/bi/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = req.app.locals.biEngine?.getStatus() || {
      isInitialized: false,
      error: 'Business Intelligence engine not available'
    };
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('Error getting BI status:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get BI status'
    });
  }
});

// =======================
// CUSTOM TEMPLATES
// =======================

/**
 * Create custom report template
 * POST /api/bi/templates/custom
 */
router.post('/templates/custom', async (req, res) => {
  try {
    const { name, description, category, template } = req.body;
    
    if (!name || !template) {
      return res.status(400).json({
        success: false,
        error: 'name and template configuration are required'
      });
    }
    
    if (!req.app.locals.biEngine) {
      return res.status(503).json({
        success: false,
        error: 'Business Intelligence engine not available'
      });
    }
    
    const templateId = `custom_${Date.now()}`;
    
    const customTemplate = {
      id: templateId,
      name,
      description,
      category: category || 'custom',
      template,
      createdBy: req.user?.id,
      createdAt: new Date().toISOString(),
      isCustom: true
    };
    
    // In real implementation, save to database
    req.app.locals.biEngine.templates.set(templateId, customTemplate);
    
    await SecurityAuditLogger.logSecurityEvent(
      'bi_custom_template_created',
      `Custom template ${name} created`,
      { templateId, name, category, userId: req.user?.id }
    );
    
    res.json({
      success: true,
      data: customTemplate
    });
    
  } catch (error) {
    console.error('Error creating custom template:', error);
    req.span?.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to create custom template'
    });
  }
});

export default router;
