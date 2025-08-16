import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import SecurityAuditLogger from '../system/SecurityAuditLogger.js';

/**
 * Comprehensive Business Intelligence Reporting Engine
 * 
 * Features:
 * - Automated report generation
 * - Scheduled report execution
 * - Executive summaries and dashboards
 * - KPI tracking and analysis
 * - Customizable report templates
 * - Multi-format exports (PDF, Excel, CSV, JSON)
 * - Report versioning and history
 * - Performance analytics
 * - Business insights generation
 * - Compliance reporting
 * 
 * Supports:
 * - Financial reports
 * - User behavior analysis
 * - System performance reports
 * - Security and compliance reports
 * - Custom business metrics
 * - Comparative analysis
 * - Trend forecasting
 */

class BusinessIntelligenceReportingEngine {
  constructor(analyticsEngine, databaseService) {
    this.analyticsEngine = analyticsEngine;
    this.databaseService = databaseService;
    this.isInitialized = false;
    
    // Report templates registry
    this.templates = new Map();
    
    // Scheduled reports
    this.scheduledReports = new Map();
    this.scheduleIntervals = new Map();
    
    // Report cache
    this.reportCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Export formats
    this.exportFormats = ['pdf', 'excel', 'csv', 'json'];
    
    // Report storage
    this.reportsDir = process.env.REPORTS_DIR || './reports';
    
    // Performance tracking
    this.metrics = {
      reportsGenerated: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      errorCount: 0,
      cacheHits: 0
    };
    
    this.initialize();
  }
  
  /**
   * Initialize the reporting engine
   */
  async initialize() {
    try {
      // Ensure reports directory exists
      await fs.mkdir(this.reportsDir, { recursive: true });
      
      // Load default templates
      await this.loadDefaultTemplates();
      
      // Load scheduled reports from database
      await this.loadScheduledReports();
      
      // Start scheduled report processor
      this.startScheduleProcessor();
      
      this.isInitialized = true;
      console.log('Business Intelligence Reporting Engine initialized');
      
    } catch (error) {
      console.error('Error initializing BI Reporting Engine:', error);
      throw error;
    }
  }
  
  /**
   * Load default report templates
   */
  async loadDefaultTemplates() {
    const defaultTemplates = [
      {
        id: 'executive_summary',
        name: 'Executive Summary',
        description: 'High-level business metrics and KPIs',
        category: 'executive',
        template: this.getExecutiveSummaryTemplate()
      },
      {
        id: 'user_analytics',
        name: 'User Analytics Report',
        description: 'Detailed user behavior and engagement analysis',
        category: 'analytics',
        template: this.getUserAnalyticsTemplate()
      },
      {
        id: 'system_performance',
        name: 'System Performance Report',
        description: 'Technical performance metrics and system health',
        category: 'technical',
        template: this.getSystemPerformanceTemplate()
      },
      {
        id: 'security_compliance',
        name: 'Security & Compliance Report',
        description: 'Security events, compliance status, and audit logs',
        category: 'security',
        template: this.getSecurityComplianceTemplate()
      },
      {
        id: 'financial_metrics',
        name: 'Financial Metrics Report',
        description: 'Revenue, costs, and financial KPIs',
        category: 'financial',
        template: this.getFinancialMetricsTemplate()
      }
    ];
    
    for (const template of defaultTemplates) {
      this.templates.set(template.id, template);
    }
  }
  
  /**
   * Generate a report based on template and parameters
   */
  async generateReport(templateId, parameters = {}, options = {}) {
    const span = OpenTelemetryTracing.getTracer('bi-reporting')
      .startSpan('bi_generate_report');
    
    const startTime = Date.now();
    
    try {
      // Get template
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }
      
      // Check cache if enabled
      const cacheKey = this.getCacheKey(templateId, parameters);
      if (options.useCache !== false && this.reportCache.has(cacheKey)) {
        const cached = this.reportCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          this.metrics.cacheHits++;
          span.setAttributes({ 'report.cache_hit': true });
          return cached.report;
        }
      }
      
      // Generate report data
      const reportData = await this.generateReportData(template, parameters);
      
      // Create report object
      const report = {
        id: crypto.randomUUID(),
        templateId,
        templateName: template.name,
        generatedAt: new Date().toISOString(),
        parameters,
        data: reportData,
        metadata: {
          executionTime: Date.now() - startTime,
          dataPoints: this.countDataPoints(reportData),
          version: '1.0'
        }
      };
      
      // Cache the report
      if (options.useCache !== false) {
        this.reportCache.set(cacheKey, {
          report,
          timestamp: Date.now()
        });
      }
      
      // Update metrics
      const executionTime = Date.now() - startTime;
      this.metrics.reportsGenerated++;
      this.metrics.totalExecutionTime += executionTime;
      this.metrics.averageExecutionTime = 
        this.metrics.totalExecutionTime / this.metrics.reportsGenerated;
      
      // Log report generation
      await SecurityAuditLogger.logSecurityEvent(
        'bi_report_generated',
        `Report ${template.name} generated`,
        { 
          templateId, 
          reportId: report.id,
          executionTime,
          parameters 
        }
      );
      
      span.setAttributes({
        'report.template_id': templateId,
        'report.id': report.id,
        'report.execution_time': executionTime,
        'report.data_points': report.metadata.dataPoints
      });
      
      return report;
      
    } catch (error) {
      this.metrics.errorCount++;
      console.error('Error generating report:', error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }
  
  /**
   * Generate report data based on template configuration
   */
  async generateReportData(template, parameters) {
    const data = {};
    
    // Execute data queries based on template configuration
    for (const [section, config] of Object.entries(template.template.sections)) {
      try {
        data[section] = await this.generateSectionData(config, parameters);
      } catch (error) {
        console.error(`Error generating data for section ${section}:`, error);
        data[section] = {
          error: error.message,
          status: 'failed'
        };
      }
    }
    
    return data;
  }
  
  /**
   * Generate data for a specific report section
   */
  async generateSectionData(config, parameters) {
    const { type, metrics, timeRange, filters } = config;
    
    switch (type) {
      case 'kpis':
        return await this.generateKPIData(metrics, timeRange, parameters);
        
      case 'charts':
        return await this.generateChartData(metrics, timeRange, filters, parameters);
        
      case 'tables':
        return await this.generateTableData(metrics, timeRange, filters, parameters);
        
      case 'insights':
        return await this.generateInsightsData(metrics, timeRange, parameters);
        
      case 'comparisons':
        return await this.generateComparisonData(metrics, timeRange, filters, parameters);
        
      default:
        throw new Error(`Unknown section type: ${type}`);
    }
  }
  
  /**
   * Generate KPI data
   */
  async generateKPIData(metrics, timeRange, parameters) {
    const kpis = {};
    
    for (const metric of metrics) {
      try {
        const data = await this.analyticsEngine.getKPIValue(
          metric.name,
          { timeRange, ...parameters }
        );
        
        kpis[metric.name] = {
          value: data.currentValue,
          target: data.target,
          trend: data.trend,
          status: data.status,
          unit: metric.unit,
          description: metric.description
        };
      } catch (error) {
        kpis[metric.name] = {
          error: error.message,
          status: 'error'
        };
      }
    }
    
    return kpis;
  }
  
  /**
   * Generate chart data
   */
  async generateChartData(metrics, timeRange, filters, parameters) {
    const charts = {};
    
    for (const metric of metrics) {
      try {
        const data = await this.analyticsEngine.getMetricAnalytics(
          metric.name,
          { 
            timeRange, 
            aggregation: metric.aggregation,
            filters,
            ...parameters 
          }
        );
        
        charts[metric.name] = {
          type: metric.chartType,
          data: data.timeSeries,
          statistics: data.statistics,
          title: metric.title,
          unit: metric.unit
        };
      } catch (error) {
        charts[metric.name] = {
          error: error.message,
          status: 'error'
        };
      }
    }
    
    return charts;
  }
  
  /**
   * Generate table data
   */
  async generateTableData(metrics, timeRange, filters, parameters) {
    const tables = {};
    
    for (const metric of metrics) {
      try {
        const data = await this.analyticsEngine.getDetailedMetrics(
          metric.name,
          {
            timeRange,
            groupBy: metric.groupBy,
            filters,
            limit: metric.limit || 100,
            ...parameters
          }
        );
        
        tables[metric.name] = {
          columns: metric.columns,
          rows: data.rows,
          total: data.total,
          title: metric.title
        };
      } catch (error) {
        tables[metric.name] = {
          error: error.message,
          status: 'error'
        };
      }
    }
    
    return tables;
  }
  
  /**
   * Generate insights data
   */
  async generateInsightsData(metrics, timeRange, parameters) {
    const insights = [];
    
    for (const metric of metrics) {
      try {
        const data = await this.analyticsEngine.generateInsights(
          metric.name,
          { timeRange, ...parameters }
        );
        
        insights.push({
          metric: metric.name,
          insights: data.insights,
          recommendations: data.recommendations,
          confidence: data.confidence,
          type: metric.type
        });
      } catch (error) {
        insights.push({
          metric: metric.name,
          error: error.message,
          status: 'error'
        });
      }
    }
    
    return insights;
  }
  
  /**
   * Generate comparison data
   */
  async generateComparisonData(metrics, timeRange, filters, parameters) {
    const comparisons = {};
    
    for (const metric of metrics) {
      try {
        const currentData = await this.analyticsEngine.getMetricAnalytics(
          metric.name,
          { timeRange, filters, ...parameters }
        );
        
        const previousData = await this.analyticsEngine.getMetricAnalytics(
          metric.name,
          { 
            timeRange: this.getPreviousPeriod(timeRange),
            filters,
            ...parameters 
          }
        );
        
        comparisons[metric.name] = {
          current: currentData,
          previous: previousData,
          change: this.calculateChange(currentData, previousData),
          title: metric.title,
          unit: metric.unit
        };
      } catch (error) {
        comparisons[metric.name] = {
          error: error.message,
          status: 'error'
        };
      }
    }
    
    return comparisons;
  }
  
  /**
   * Export report to specified format
   */
  async exportReport(report, format = 'pdf', options = {}) {
    const span = OpenTelemetryTracing.getTracer('bi-reporting')
      .startSpan('bi_export_report');
    
    try {
      if (!this.exportFormats.includes(format)) {
        throw new Error(`Unsupported export format: ${format}`);
      }
      
      const filename = `${report.templateId}_${report.id}_${Date.now()}.${format}`;
      const filepath = path.join(this.reportsDir, filename);
      
      let exportedFile;
      
      switch (format) {
        case 'pdf':
          exportedFile = await this.exportToPDF(report, filepath, options);
          break;
          
        case 'excel':
          exportedFile = await this.exportToExcel(report, filepath, options);
          break;
          
        case 'csv':
          exportedFile = await this.exportToCSV(report, filepath, options);
          break;
          
        case 'json':
          exportedFile = await this.exportToJSON(report, filepath, options);
          break;
      }
      
      span.setAttributes({
        'export.format': format,
        'export.filename': filename,
        'export.size': exportedFile.size || 0
      });
      
      return {
        filename,
        filepath,
        format,
        size: exportedFile.size || 0,
        url: `/api/reports/download/${filename}`
      };
      
    } catch (error) {
      console.error('Error exporting report:', error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }
  
  /**
   * Export report to PDF
   */
  async exportToPDF(report, filepath, options) {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filepath);
    
    doc.pipe(stream);
    
    // Header
    doc.fontSize(20).text(report.templateName, { align: 'center' });
    doc.fontSize(12).text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);
    
    // Executive Summary
    if (report.data.summary) {
      doc.fontSize(16).text('Executive Summary', { underline: true });
      doc.fontSize(12).text(report.data.summary.overview || 'No summary available');
      doc.moveDown();
    }
    
    // KPIs
    if (report.data.kpis) {
      doc.fontSize(16).text('Key Performance Indicators', { underline: true });
      
      Object.entries(report.data.kpis).forEach(([name, kpi]) => {
        if (kpi.error) {
          doc.fontSize(12).text(`${name}: Error - ${kpi.error}`);
        } else {
          doc.fontSize(12).text(`${name}: ${kpi.value}${kpi.unit || ''} (Target: ${kpi.target}${kpi.unit || ''})`);
        }
      });
      
      doc.moveDown();
    }
    
    // Charts (simplified text representation)
    if (report.data.charts) {
      doc.fontSize(16).text('Analytics Charts', { underline: true });
      
      Object.entries(report.data.charts).forEach(([name, chart]) => {
        if (chart.error) {
          doc.fontSize(12).text(`${name}: Error - ${chart.error}`);
        } else {
          doc.fontSize(12).text(`${chart.title || name}: ${chart.type} chart with ${chart.data?.length || 0} data points`);
        }
      });
      
      doc.moveDown();
    }
    
    // Tables
    if (report.data.tables) {
      doc.fontSize(16).text('Detailed Data', { underline: true });
      
      Object.entries(report.data.tables).forEach(([name, table]) => {
        if (table.error) {
          doc.fontSize(12).text(`${name}: Error - ${table.error}`);
        } else {
          doc.fontSize(12).text(`${table.title || name}: ${table.rows?.length || 0} records`);
        }
      });
      
      doc.moveDown();
    }
    
    // Footer
    doc.fontSize(10).text(`Report ID: ${report.id}`, { align: 'center' });
    doc.text(`Execution Time: ${report.metadata.executionTime}ms`, { align: 'center' });
    
    doc.end();
    
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        fs.stat(filepath)
          .then(stats => resolve({ size: stats.size }))
          .catch(reject);
      });
      
      stream.on('error', reject);
    });
  }
  
  /**
   * Export report to Excel
   */
  async exportToExcel(report, filepath, options) {
    const workbook = new ExcelJS.Workbook();
    
    // Summary worksheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Report', report.templateName]);
    summarySheet.addRow(['Generated', new Date(report.generatedAt).toLocaleString()]);
    summarySheet.addRow(['Report ID', report.id]);
    summarySheet.addRow([]);
    
    // KPIs worksheet
    if (report.data.kpis) {
      const kpiSheet = workbook.addWorksheet('KPIs');
      kpiSheet.addRow(['Metric', 'Current Value', 'Target', 'Status', 'Trend', 'Unit']);
      
      Object.entries(report.data.kpis).forEach(([name, kpi]) => {
        if (!kpi.error) {
          kpiSheet.addRow([
            name,
            kpi.value,
            kpi.target,
            kpi.status,
            kpi.trend,
            kpi.unit || ''
          ]);
        }
      });
    }
    
    // Tables data
    if (report.data.tables) {
      Object.entries(report.data.tables).forEach(([name, table]) => {
        if (!table.error && table.rows) {
          const tableSheet = workbook.addWorksheet(name.substring(0, 31)); // Excel sheet name limit
          
          // Add headers
          if (table.columns) {
            tableSheet.addRow(table.columns.map(col => col.title || col.name));
          }
          
          // Add data rows
          table.rows.forEach(row => {
            if (table.columns) {
              tableSheet.addRow(table.columns.map(col => row[col.name] || ''));
            } else {
              tableSheet.addRow(Object.values(row));
            }
          });
        }
      });
    }
    
    await workbook.xlsx.writeFile(filepath);
    
    const stats = await fs.stat(filepath);
    return { size: stats.size };
  }
  
  /**
   * Export report to CSV
   */
  async exportToCSV(report, filepath, options) {
    let csv = '';
    
    // Report header
    csv += `Report,${report.templateName}\n`;
    csv += `Generated,${new Date(report.generatedAt).toLocaleString()}\n`;
    csv += `Report ID,${report.id}\n\n`;
    
    // KPIs
    if (report.data.kpis) {
      csv += 'KPIs\n';
      csv += 'Metric,Current Value,Target,Status,Trend,Unit\n';
      
      Object.entries(report.data.kpis).forEach(([name, kpi]) => {
        if (!kpi.error) {
          csv += `${name},${kpi.value},${kpi.target},${kpi.status},${kpi.trend},${kpi.unit || ''}\n`;
        }
      });
      
      csv += '\n';
    }
    
    // First table data
    if (report.data.tables) {
      const firstTable = Object.values(report.data.tables)[0];
      if (firstTable && !firstTable.error && firstTable.rows) {
        csv += 'Data\n';
        
        if (firstTable.columns) {
          csv += firstTable.columns.map(col => col.title || col.name).join(',') + '\n';
          
          firstTable.rows.forEach(row => {
            csv += firstTable.columns.map(col => `"${row[col.name] || ''}"`).join(',') + '\n';
          });
        }
      }
    }
    
    await fs.writeFile(filepath, csv, 'utf8');
    
    const stats = await fs.stat(filepath);
    return { size: stats.size };
  }
  
  /**
   * Export report to JSON
   */
  async exportToJSON(report, filepath, options) {
    const jsonData = {
      ...report,
      exportedAt: new Date().toISOString()
    };
    
    await fs.writeFile(filepath, JSON.stringify(jsonData, null, 2), 'utf8');
    
    const stats = await fs.stat(filepath);
    return { size: stats.size };
  }
  
  /**
   * Schedule a report for automatic generation
   */
  async scheduleReport(templateId, schedule, parameters = {}, exportOptions = {}) {
    const scheduleId = crypto.randomUUID();
    
    const scheduledReport = {
      id: scheduleId,
      templateId,
      schedule, // cron-like format or interval
      parameters,
      exportOptions,
      createdAt: new Date().toISOString(),
      lastRun: null,
      nextRun: this.calculateNextRun(schedule),
      isActive: true
    };
    
    // Store in database (simplified for demo)
    // In real implementation, save to database
    this.scheduledReports.set(scheduleId, scheduledReport);
    
    await SecurityAuditLogger.logSecurityEvent(
      'bi_report_scheduled',
      `Report ${templateId} scheduled`,
      { scheduleId, templateId, schedule }
    );
    
    return scheduledReport;
  }
  
  /**
   * Start the schedule processor
   */
  startScheduleProcessor() {
    // Check every minute for due reports
    setInterval(() => {
      this.processScheduledReports();
    }, 60 * 1000);
  }
  
  /**
   * Process scheduled reports
   */
  async processScheduledReports() {
    const now = Date.now();
    
    for (const [scheduleId, scheduledReport] of this.scheduledReports) {
      if (scheduledReport.isActive && 
          scheduledReport.nextRun && 
          now >= new Date(scheduledReport.nextRun).getTime()) {
        
        try {
          // Generate report
          const report = await this.generateReport(
            scheduledReport.templateId,
            scheduledReport.parameters
          );
          
          // Export if requested
          if (scheduledReport.exportOptions.format) {
            await this.exportReport(report, scheduledReport.exportOptions.format);
          }
          
          // Update schedule
          scheduledReport.lastRun = new Date().toISOString();
          scheduledReport.nextRun = this.calculateNextRun(scheduledReport.schedule);
          
          console.log(`Scheduled report ${scheduleId} executed successfully`);
          
        } catch (error) {
          console.error(`Error executing scheduled report ${scheduleId}:`, error);
        }
      }
    }
  }
  
  /**
   * Get cache key for report caching
   */
  getCacheKey(templateId, parameters) {
    const paramString = JSON.stringify(parameters);
    return `${templateId}:${crypto.createHash('md5').update(paramString).digest('hex')}`;
  }
  
  /**
   * Count data points in report data
   */
  countDataPoints(data) {
    let count = 0;
    
    for (const [section, sectionData] of Object.entries(data)) {
      if (typeof sectionData === 'object' && sectionData !== null) {
        if (sectionData.rows) {
          count += sectionData.rows.length;
        } else if (Array.isArray(sectionData)) {
          count += sectionData.length;
        } else {
          count += Object.keys(sectionData).length;
        }
      }
    }
    
    return count;
  }
  
  /**
   * Calculate previous time period for comparisons
   */
  getPreviousPeriod(timeRange) {
    // Simplified implementation
    switch (timeRange) {
      case '24h': return '48h';
      case '7d': return '14d';
      case '30d': return '60d';
      default: return '24h';
    }
  }
  
  /**
   * Calculate change percentage between current and previous data
   */
  calculateChange(currentData, previousData) {
    if (!currentData.statistics || !previousData.statistics) {
      return null;
    }
    
    const current = currentData.statistics.average || currentData.statistics.sum || 0;
    const previous = previousData.statistics.average || previousData.statistics.sum || 0;
    
    if (previous === 0) return current > 0 ? 100 : 0;
    
    return ((current - previous) / previous) * 100;
  }
  
  /**
   * Calculate next run time for scheduled reports
   */
  calculateNextRun(schedule) {
    // Simplified implementation - in real app use proper cron parser
    const now = new Date();
    
    if (schedule === 'hourly') {
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (schedule === 'daily') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9 AM
      return tomorrow.toISOString();
    } else if (schedule === 'weekly') {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0);
      return nextWeek.toISOString();
    }
    
    return null;
  }
  
  // Report Template Definitions
  
  getExecutiveSummaryTemplate() {
    return {
      sections: {
        summary: {
          type: 'insights',
          metrics: [
            { name: 'business_overview', type: 'summary' }
          ]
        },
        kpis: {
          type: 'kpis',
          metrics: [
            { name: 'revenue', unit: '$', description: 'Total Revenue' },
            { name: 'users', unit: '', description: 'Active Users' },
            { name: 'conversion_rate', unit: '%', description: 'Conversion Rate' },
            { name: 'customer_satisfaction', unit: '/10', description: 'Customer Satisfaction' }
          ],
          timeRange: '30d'
        },
        trends: {
          type: 'charts',
          metrics: [
            { name: 'revenue', chartType: 'line', aggregation: 'sum', title: 'Revenue Trend' },
            { name: 'users', chartType: 'line', aggregation: 'count', title: 'User Growth' }
          ],
          timeRange: '90d'
        }
      }
    };
  }
  
  getUserAnalyticsTemplate() {
    return {
      sections: {
        engagement: {
          type: 'kpis',
          metrics: [
            { name: 'session_duration', unit: 'min', description: 'Average Session Duration' },
            { name: 'pages_per_session', unit: '', description: 'Pages per Session' },
            { name: 'bounce_rate', unit: '%', description: 'Bounce Rate' }
          ],
          timeRange: '7d'
        },
        behavior: {
          type: 'charts',
          metrics: [
            { name: 'page_views', chartType: 'bar', aggregation: 'count', title: 'Page Views' },
            { name: 'user_actions', chartType: 'line', aggregation: 'count', title: 'User Actions' }
          ],
          timeRange: '30d'
        },
        demographics: {
          type: 'tables',
          metrics: [
            { 
              name: 'user_demographics',
              columns: [
                { name: 'age_group', title: 'Age Group' },
                { name: 'location', title: 'Location' },
                { name: 'device', title: 'Device Type' },
                { name: 'count', title: 'Users' }
              ],
              limit: 50
            }
          ],
          timeRange: '30d'
        }
      }
    };
  }
  
  getSystemPerformanceTemplate() {
    return {
      sections: {
        performance: {
          type: 'kpis',
          metrics: [
            { name: 'response_time', unit: 'ms', description: 'Average Response Time' },
            { name: 'uptime', unit: '%', description: 'System Uptime' },
            { name: 'error_rate', unit: '%', description: 'Error Rate' }
          ],
          timeRange: '24h'
        },
        resources: {
          type: 'charts',
          metrics: [
            { name: 'cpu_usage', chartType: 'line', aggregation: 'average', title: 'CPU Usage' },
            { name: 'memory_usage', chartType: 'line', aggregation: 'average', title: 'Memory Usage' },
            { name: 'disk_usage', chartType: 'line', aggregation: 'average', title: 'Disk Usage' }
          ],
          timeRange: '24h'
        }
      }
    };
  }
  
  getSecurityComplianceTemplate() {
    return {
      sections: {
        security: {
          type: 'kpis',
          metrics: [
            { name: 'security_incidents', unit: '', description: 'Security Incidents' },
            { name: 'failed_logins', unit: '', description: 'Failed Login Attempts' },
            { name: 'compliance_score', unit: '%', description: 'Compliance Score' }
          ],
          timeRange: '7d'
        },
        events: {
          type: 'tables',
          metrics: [
            {
              name: 'security_events',
              columns: [
                { name: 'timestamp', title: 'Timestamp' },
                { name: 'event_type', title: 'Event Type' },
                { name: 'severity', title: 'Severity' },
                { name: 'description', title: 'Description' }
              ],
              limit: 100
            }
          ],
          timeRange: '30d'
        }
      }
    };
  }
  
  getFinancialMetricsTemplate() {
    return {
      sections: {
        revenue: {
          type: 'kpis',
          metrics: [
            { name: 'total_revenue', unit: '$', description: 'Total Revenue' },
            { name: 'recurring_revenue', unit: '$', description: 'Monthly Recurring Revenue' },
            { name: 'average_order_value', unit: '$', description: 'Average Order Value' }
          ],
          timeRange: '30d'
        },
        trends: {
          type: 'comparisons',
          metrics: [
            { name: 'revenue', title: 'Revenue Comparison', unit: '$' },
            { name: 'costs', title: 'Cost Comparison', unit: '$' },
            { name: 'profit_margin', title: 'Profit Margin', unit: '%' }
          ],
          timeRange: '30d'
        }
      }
    };
  }
  
  /**
   * Get engine status and metrics
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      metrics: { ...this.metrics },
      templates: this.templates.size,
      scheduledReports: this.scheduledReports.size,
      cacheSize: this.reportCache.size
    };
  }
  
  /**
   * Load scheduled reports from database
   */
  async loadScheduledReports() {
    // In real implementation, load from database
    // For demo, create some sample scheduled reports
    const sampleSchedules = [
      {
        templateId: 'executive_summary',
        schedule: 'daily',
        parameters: {},
        exportOptions: { format: 'pdf' }
      },
      {
        templateId: 'system_performance',
        schedule: 'hourly',
        parameters: {},
        exportOptions: { format: 'json' }
      }
    ];
    
    for (const schedule of sampleSchedules) {
      await this.scheduleReport(
        schedule.templateId,
        schedule.schedule,
        schedule.parameters,
        schedule.exportOptions
      );
    }
  }
}

export default BusinessIntelligenceReportingEngine;
