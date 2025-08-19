/**
 * Sourcery Integration Service for Cartrita V2
 * Provides automated code quality analysis and refactoring capabilities
 * Token: user_jgWWmo1BwazNufvKZEmx6k3P3rAPFQQdZykTooF2ZEg9gJyrnrjQBO25GGw
 * Created: January 27, 2025
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

export default class SourceryService {
  constructor() {
    this.initialized = false;
    this.token = process.env.SOURCERY_TOKEN || 'user_jgWWmo1BwazNufvKZEmx6k3P3rAPFQQdZykTooF2ZEg9gJyrnrjQBO25GGw';
    this.metrics = {
      totalAnalyses: 0,
      issuesFound: 0,
      fixesApplied: 0,
      averageComplexityScore: 0,
      filesAnalyzed: 0
    };
  }

  /**
   * Initialize Sourcery service and authenticate
   */
  async initialize() {
    try {
      console.log('[SourceryService] 🔍 Initializing Sourcery code quality service...');
      
      // Check if Sourcery CLI is available
      const version = await this.executeSourceryCommand(['--version']);
      console.log(`[SourceryService] Found Sourcery CLI: ${version.trim()}`);

      // Authenticate with token if needed
      if (this.token) {
        try {
          await this.executeSourceryCommand(['login', '--token', this.token]);
          console.log('[SourceryService] ✅ Authenticated with Sourcery');
        } catch (loginError) {
          console.warn('[SourceryService] ⚠️ Authentication may have failed, continuing...');
        }
      }

      this.initialized = true;
      console.log('[SourceryService] ✅ Sourcery service initialized successfully');
      return true;

    } catch (error) {
      console.error('[SourceryService] ❌ Failed to initialize Sourcery service:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Execute Sourcery CLI command
   * @param {array} args - Command arguments
   * @param {string} workingDir - Working directory
   * @returns {Promise<string>} Command output
   */
  async executeSourceryCommand(args, workingDir = process.cwd()) {
    return new Promise((resolve, reject) => {
      const sourcery = spawn('sourcery', args, { 
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      sourcery.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      sourcery.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      sourcery.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Sourcery command failed: ${stderr || stdout}`));
        }
      });

      sourcery.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Analyze code quality for a file or directory
   * @param {string} targetPath - Path to analyze
   * @param {object} options - Analysis options
   * @returns {object} Analysis results
   */
  async analyzeCodeQuality(targetPath, options = {}) {
    if (!this.initialized) {
      throw new Error('SourceryService not initialized');
    }

    const startTime = Date.now();

    return await OpenTelemetryTracing.traceOperation('sourcery.analyze', {
      'sourcery.target': targetPath,
      'sourcery.language': options.language || 'auto'
    }, async () => {
      try {
        console.log(`[SourceryService] 🔍 Analyzing code quality for: ${targetPath}`);

        const args = ['review', targetPath];
        
        // Add options
        if (options.output === 'json') {
          args.push('--json');
        }
        
        if (options.language) {
          args.push('--language', options.language);
        }

        if (options.config) {
          args.push('--config', options.config);
        }

        const output = await this.executeSourceryCommand(args);
        const analysisResult = this.parseAnalysisOutput(output, options.output);

        const responseTime = Date.now() - startTime;
        
        // Update metrics
        this.updateAnalysisMetrics(analysisResult);

        return {
          target: targetPath,
          analysis: analysisResult,
          performance: {
            responseTime,
            timestamp: new Date().toISOString()
          }
        };

      } catch (error) {
        console.error(`[SourceryService] Analysis failed for ${targetPath}:`, error);
        throw error;
      }
    });
  }

  /**
   * Apply automatic refactoring suggestions
   * @param {string} targetPath - Path to refactor
   * @param {object} options - Refactoring options
   * @returns {object} Refactoring results
   */
  async applyAutoRefactoring(targetPath, options = {}) {
    if (!this.initialized) {
      throw new Error('SourceryService not initialized');
    }

    return await OpenTelemetryTracing.traceOperation('sourcery.refactor', {
      'sourcery.target': targetPath,
      'sourcery.dry_run': options.dryRun || false
    }, async () => {
      try {
        console.log(`[SourceryService] 🛠️ Applying refactoring to: ${targetPath}`);

        const args = ['refactor', targetPath];

        if (options.dryRun) {
          args.push('--diff');
        }

        if (options.rules) {
          args.push('--rules', options.rules.join(','));
        }

        if (options.exclude) {
          args.push('--exclude', options.exclude.join(','));
        }

        const output = await this.executeSourceryCommand(args);
        const refactorResult = this.parseRefactorOutput(output, options.dryRun);

        // Update metrics
        if (!options.dryRun) {
          this.metrics.fixesApplied += refactorResult.fixesApplied || 0;
        }

        return {
          target: targetPath,
          refactoring: refactorResult,
          dryRun: options.dryRun,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        console.error(`[SourceryService] Refactoring failed for ${targetPath}:`, error);
        throw error;
      }
    });
  }

  /**
   * Generate code quality report
   * @param {string} projectPath - Path to project
   * @param {object} options - Report options
   * @returns {object} Comprehensive quality report
   */
  async generateQualityReport(projectPath, options = {}) {
    if (!this.initialized) {
      throw new Error('SourceryService not initialized');
    }

    try {
      console.log(`[SourceryService] 📊 Generating quality report for: ${projectPath}`);

      // Run comprehensive analysis
      const analysisResult = await this.analyzeCodeQuality(projectPath, {
        output: 'json',
        ...options
      });

      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(analysisResult.analysis);

      // Generate recommendations
      const recommendations = this.generateRecommendations(analysisResult.analysis);

      return {
        project: projectPath,
        summary: qualityMetrics,
        issues: analysisResult.analysis.issues || [],
        recommendations,
        technicalDebt: this.calculateTechnicalDebt(analysisResult.analysis),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[SourceryService] Failed to generate quality report:`, error);
      throw error;
    }
  }

  /**
   * Parse Sourcery analysis output
   * @param {string} output - Raw CLI output
   * @param {string} format - Output format
   * @returns {object} Parsed analysis data
   */
  parseAnalysisOutput(output, format = 'text') {
    try {
      if (format === 'json') {
        return JSON.parse(output);
      }

      // Parse text output
      const lines = output.split('\n');
      const issues = [];
      let currentFile = null;

      lines.forEach(line => {
        const trimmed = line.trim();
        
        // File detection
        if (trimmed.includes('.py:') || trimmed.includes('.js:') || trimmed.includes('.ts:')) {
          const parts = trimmed.split(':');
          currentFile = parts[0];
        }

        // Issue detection (simple pattern matching)
        if (trimmed.includes('complexity') || trimmed.includes('refactor') || trimmed.includes('style')) {
          issues.push({
            file: currentFile,
            line: this.extractLineNumber(trimmed),
            type: this.extractIssueType(trimmed),
            message: trimmed,
            severity: this.extractSeverity(trimmed)
          });
        }
      });

      return {
        issues,
        summary: {
          totalIssues: issues.length,
          filesAnalyzed: [...new Set(issues.map(i => i.file))].length
        }
      };

    } catch (error) {
      console.error('[SourceryService] Failed to parse analysis output:', error);
      return { issues: [], summary: { totalIssues: 0, filesAnalyzed: 0 } };
    }
  }

  /**
   * Parse Sourcery refactor output
   * @param {string} output - Raw CLI output
   * @param {boolean} dryRun - Whether this was a dry run
   * @returns {object} Parsed refactoring data
   */
  parseRefactorOutput(output, dryRun) {
    const lines = output.split('\n');
    const changes = [];
    let fixesApplied = 0;

    lines.forEach(line => {
      if (line.includes('Fixed') || line.includes('Refactored')) {
        fixesApplied++;
        changes.push(line.trim());
      }
    });

    return {
      fixesApplied,
      changes,
      summary: `${fixesApplied} ${dryRun ? 'potential fixes' : 'fixes applied'}`
    };
  }

  /**
   * Calculate quality metrics from analysis
   * @param {object} analysis - Analysis results
   * @returns {object} Quality metrics
   */
  calculateQualityMetrics(analysis) {
    const issues = analysis.issues || [];
    const totalIssues = issues.length;
    const filesAnalyzed = analysis.summary?.filesAnalyzed || 0;

    const issuesByType = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {});

    const issuesBySeverity = issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {});

    // Calculate quality score (0-100)
    const qualityScore = Math.max(0, 100 - (totalIssues * 2));

    return {
      qualityScore,
      totalIssues,
      filesAnalyzed,
      issuesPerFile: filesAnalyzed > 0 ? (totalIssues / filesAnalyzed).toFixed(2) : 0,
      issuesByType,
      issuesBySeverity,
      maintainabilityIndex: this.calculateMaintainabilityIndex(issues)
    };
  }

  /**
   * Generate recommendations based on analysis
   * @param {object} analysis - Analysis results
   * @returns {array} Array of recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    const issues = analysis.issues || [];

    // Complexity recommendations
    const complexityIssues = issues.filter(i => i.type === 'complexity');
    if (complexityIssues.length > 0) {
      recommendations.push({
        type: 'complexity',
        priority: 'high',
        message: `Reduce complexity in ${complexityIssues.length} locations`,
        actions: ['Break down large functions', 'Simplify conditional logic', 'Extract helper methods']
      });
    }

    // Style recommendations
    const styleIssues = issues.filter(i => i.type === 'style');
    if (styleIssues.length > 0) {
      recommendations.push({
        type: 'style',
        priority: 'medium',
        message: `Fix ${styleIssues.length} style issues`,
        actions: ['Apply consistent formatting', 'Follow naming conventions', 'Remove unused imports']
      });
    }

    // Performance recommendations
    const performanceIssues = issues.filter(i => i.type === 'performance');
    if (performanceIssues.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `Optimize ${performanceIssues.length} performance issues`,
        actions: ['Cache frequently used values', 'Optimize loops', 'Use more efficient algorithms']
      });
    }

    return recommendations;
  }

  /**
   * Calculate technical debt in minutes
   * @param {object} analysis - Analysis results
   * @returns {number} Technical debt in minutes
   */
  calculateTechnicalDebt(analysis) {
    const issues = analysis.issues || [];
    
    // Rough estimation: each issue represents X minutes of technical debt
    const debtPerIssue = {
      complexity: 30,
      performance: 45,
      style: 10,
      security: 60,
      bug: 20
    };

    return issues.reduce((total, issue) => {
      return total + (debtPerIssue[issue.type] || 15);
    }, 0);
  }

  /**
   * Calculate maintainability index (0-100)
   * @param {array} issues - Array of issues
   * @returns {number} Maintainability index
   */
  calculateMaintainabilityIndex(issues) {
    const totalIssues = issues.length;
    const complexityIssues = issues.filter(i => i.type === 'complexity').length;
    const performanceIssues = issues.filter(i => i.type === 'performance').length;

    // Higher penalties for complexity and performance issues
    const penalty = (complexityIssues * 3) + (performanceIssues * 2) + totalIssues;
    
    return Math.max(0, Math.min(100, 100 - penalty));
  }

  /**
   * Helper methods for parsing
   */
  extractLineNumber(text) {
    const match = text.match(/:(\d+):/);
    return match ? parseInt(match[1]) : null;
  }

  extractIssueType(text) {
    if (text.includes('complexity')) return 'complexity';
    if (text.includes('performance')) return 'performance';
    if (text.includes('style')) return 'style';
    if (text.includes('security')) return 'security';
    if (text.includes('bug')) return 'bug';
    return 'other';
  }

  extractSeverity(text) {
    if (text.includes('error') || text.includes('critical')) return 'high';
    if (text.includes('warning')) return 'medium';
    return 'low';
  }

  /**
   * Update analysis metrics
   * @param {object} analysisResult - Analysis results
   */
  updateAnalysisMetrics(analysisResult) {
    this.metrics.totalAnalyses++;
    this.metrics.issuesFound += analysisResult.summary?.totalIssues || 0;
    this.metrics.filesAnalyzed += analysisResult.summary?.filesAnalyzed || 0;

    // Update average complexity score if available
    if (analysisResult.complexityScore) {
      const currentAvg = this.metrics.averageComplexityScore;
      const totalAnalyses = this.metrics.totalAnalyses;
      this.metrics.averageComplexityScore = 
        ((currentAvg * (totalAnalyses - 1)) + analysisResult.complexityScore) / totalAnalyses;
    }
  }

  /**
   * Get service metrics for monitoring
   * @returns {object} Current service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      initialized: this.initialized,
      technicalDebtMinutes: this.metrics.issuesFound * 15, // Rough estimation
      qualityTrend: this.metrics.totalAnalyses > 1 ? 'stable' : 'initial'
    };
  }

  /**
   * Reset service metrics (useful for testing)
   */
  resetMetrics() {
    this.metrics = {
      totalAnalyses: 0,
      issuesFound: 0,
      fixesApplied: 0,
      averageComplexityScore: 0,
      filesAnalyzed: 0
    };
  }
}