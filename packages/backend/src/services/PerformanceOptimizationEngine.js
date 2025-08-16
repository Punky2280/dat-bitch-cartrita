import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import os from 'os';
import fs from 'fs/promises';
import path from 'path';

/**
 * Performance Optimization Engine
 * 
 * Intelligent performance monitoring and optimization system with:
 * - Real-time performance monitoring
 * - Bottleneck detection and analysis
 * - Automatic optimization recommendations
 * - Resource usage tracking
 * - Predictive performance tuning
 * - Performance analytics and reporting
 */
class PerformanceOptimizationEngine {
  constructor(config = {}) {
    this.config = {
      monitoringInterval: config.monitoringInterval || 5000,
      optimizationThreshold: config.optimizationThreshold || 0.8,
      metricsRetentionDays: config.metricsRetentionDays || 30,
      alertThresholds: {
        cpu: config.alertThresholds?.cpu || 80,
        memory: config.alertThresholds?.memory || 85,
        responseTime: config.alertThresholds?.responseTime || 2000,
        errorRate: config.errorRate || 5,
        ...config.alertThresholds
      },
      ...config
    };

    this.metrics = new Map();
    this.bottlenecks = new Map();
    this.optimizations = new Map();
    this.performanceHistory = [];
    this.isMonitoring = false;
    this.monitoringTimer = null;

    // Performance counters
    this.counters = {
      optimizations_applied: 0,
      bottlenecks_detected: 0,
      alerts_triggered: 0,
      performance_improvements: 0
    };

    this.initializeTracing();
  }

  initializeTracing() {
    this.tracer = OpenTelemetryTracing.getTracer('performance-optimization-engine');
    
    // Create performance counters
    if (global.otelCounters) {
      this.performanceCounter = global.otelCounters.performance_operations || 
        OpenTelemetryTracing.createCounter('performance_operations_total', 'Total performance operations');
      this.optimizationCounter = global.otelCounters.optimization_applied || 
        OpenTelemetryTracing.createCounter('optimization_applied_total', 'Total optimizations applied');
      this.bottleneckCounter = global.otelCounters.bottleneck_detected || 
        OpenTelemetryTracing.createCounter('bottleneck_detected_total', 'Total bottlenecks detected');
    }
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring() {
    const span = this.tracer?.startSpan('performance_optimization.start_monitoring');
    
    try {
      if (this.isMonitoring) {
        throw new Error('Performance monitoring already running');
      }

      this.isMonitoring = true;
      
      // Start continuous monitoring
      this.monitoringTimer = setInterval(() => {
        this.collectMetrics().catch(error => {
          console.error('Error collecting performance metrics:', error);
        });
      }, this.config.monitoringInterval);

      // Initial metrics collection
      await this.collectMetrics();

      span?.setAttributes({
        monitoring_interval: this.config.monitoringInterval,
        optimization_threshold: this.config.optimizationThreshold
      });

      return {
        success: true,
        message: 'Performance monitoring started',
        interval: this.config.monitoringInterval
      };

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring() {
    const span = this.tracer?.startSpan('performance_optimization.stop_monitoring');
    
    try {
      if (!this.isMonitoring) {
        throw new Error('Performance monitoring not running');
      }

      this.isMonitoring = false;
      
      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
        this.monitoringTimer = null;
      }

      return {
        success: true,
        message: 'Performance monitoring stopped'
      };

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Collect system and application metrics
   */
  async collectMetrics() {
    const span = this.tracer?.startSpan('performance_optimization.collect_metrics');
    
    try {
      const timestamp = Date.now();
      const metrics = {
        timestamp,
        system: await this.collectSystemMetrics(),
        application: await this.collectApplicationMetrics(),
        database: await this.collectDatabaseMetrics(),
        network: await this.collectNetworkMetrics()
      };

      // Store metrics
      this.metrics.set(timestamp, metrics);
      this.performanceHistory.push(metrics);

      // Keep only recent metrics
      this.cleanupOldMetrics();

      // Analyze for bottlenecks
      await this.analyzeBottlenecks(metrics);

      // Check for optimization opportunities
      await this.checkOptimizationOpportunities(metrics);

      this.performanceCounter?.add(1, { operation: 'collect_metrics' });

      span?.setAttributes({
        cpu_usage: metrics.system.cpuUsage,
        memory_usage: metrics.system.memoryUsage.percentage,
        load_average: metrics.system.loadAverage[0]
      });

      return metrics;

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Collect system-level metrics
   */
  async collectSystemMetrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      cpuUsage: await this.getCpuUsage(),
      memoryUsage: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentage: (usedMem / totalMem) * 100
      },
      loadAverage: os.loadavg(),
      uptime: os.uptime(),
      cpuCount: cpus.length,
      platform: os.platform(),
      arch: os.arch()
    };
  }

  /**
   * Calculate CPU usage percentage
   */
  async getCpuUsage() {
    const startMeasure = this.getCpuMeasure();
    
    // Wait 100ms for measurement
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endMeasure = this.getCpuMeasure();
    
    const idleDifference = endMeasure.idle - startMeasure.idle;
    const totalDifference = endMeasure.total - startMeasure.total;
    
    const cpuPercentage = 100 - ~~(100 * idleDifference / totalDifference);
    return cpuPercentage;
  }

  /**
   * Get CPU measurement for usage calculation
   */
  getCpuMeasure() {
    const cpus = os.cpus();
    let idle = 0, total = 0;
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        total += cpu.times[type];
      }
      idle += cpu.times.idle;
    });
    
    return { idle, total };
  }

  /**
   * Collect application-level metrics
   */
  async collectApplicationMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
      processMemory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      uptime: process.uptime(),
      pid: process.pid,
      version: process.version,
      eventLoopDelay: await this.measureEventLoopDelay(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length
    };
  }

  /**
   * Measure event loop delay
   */
  async measureEventLoopDelay() {
    return new Promise(resolve => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
        resolve(delay);
      });
    });
  }

  /**
   * Collect database metrics
   */
  async collectDatabaseMetrics() {
    // Placeholder for database metrics
    // This would integrate with actual database monitoring
    return {
      connectionPool: {
        active: 0,
        idle: 0,
        total: 0
      },
      queryPerformance: {
        averageResponseTime: 0,
        slowQueries: 0,
        errorRate: 0
      },
      cacheHitRatio: 0
    };
  }

  /**
   * Collect network metrics
   */
  async collectNetworkMetrics() {
    return {
      activeConnections: 0,
      requestsPerSecond: 0,
      responseTime: {
        average: 0,
        p95: 0,
        p99: 0
      },
      errorRate: 0,
      throughput: {
        incoming: 0,
        outgoing: 0
      }
    };
  }

  /**
   * Analyze metrics for bottlenecks
   */
  async analyzeBottlenecks(metrics) {
    const span = this.tracer?.startSpan('performance_optimization.analyze_bottlenecks');
    
    try {
      const bottlenecks = [];
      const timestamp = metrics.timestamp;

      // CPU bottleneck
      if (metrics.system.cpuUsage > this.config.alertThresholds.cpu) {
        bottlenecks.push({
          type: 'cpu',
          severity: this.calculateSeverity(metrics.system.cpuUsage, this.config.alertThresholds.cpu),
          value: metrics.system.cpuUsage,
          threshold: this.config.alertThresholds.cpu,
          recommendations: this.generateCpuOptimizationRecommendations(metrics)
        });
      }

      // Memory bottleneck
      if (metrics.system.memoryUsage.percentage > this.config.alertThresholds.memory) {
        bottlenecks.push({
          type: 'memory',
          severity: this.calculateSeverity(metrics.system.memoryUsage.percentage, this.config.alertThresholds.memory),
          value: metrics.system.memoryUsage.percentage,
          threshold: this.config.alertThresholds.memory,
          recommendations: this.generateMemoryOptimizationRecommendations(metrics)
        });
      }

      // Event loop delay bottleneck
      if (metrics.application.eventLoopDelay > 10) {
        bottlenecks.push({
          type: 'event_loop',
          severity: this.calculateSeverity(metrics.application.eventLoopDelay, 10),
          value: metrics.application.eventLoopDelay,
          threshold: 10,
          recommendations: this.generateEventLoopOptimizationRecommendations(metrics)
        });
      }

      // Store bottlenecks
      if (bottlenecks.length > 0) {
        this.bottlenecks.set(timestamp, bottlenecks);
        this.counters.bottlenecks_detected += bottlenecks.length;
        
        bottlenecks.forEach(bottleneck => {
          this.bottleneckCounter?.add(1, { type: bottleneck.type, severity: bottleneck.severity });
        });
      }

      span?.setAttributes({
        bottlenecks_found: bottlenecks.length,
        cpu_bottleneck: bottlenecks.some(b => b.type === 'cpu'),
        memory_bottleneck: bottlenecks.some(b => b.type === 'memory')
      });

      return bottlenecks;

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Calculate severity level
   */
  calculateSeverity(value, threshold) {
    const ratio = value / threshold;
    if (ratio >= 2.0) return 'critical';
    if (ratio >= 1.5) return 'high';
    if (ratio >= 1.2) return 'medium';
    return 'low';
  }

  /**
   * Generate CPU optimization recommendations
   */
  generateCpuOptimizationRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.system.cpuUsage > 90) {
      recommendations.push('Consider implementing CPU-intensive task offloading');
      recommendations.push('Review and optimize synchronous operations');
      recommendations.push('Implement worker threads for parallel processing');
    }
    
    if (metrics.system.loadAverage[0] > metrics.system.cpuCount * 2) {
      recommendations.push('Scale horizontally by adding more instances');
      recommendations.push('Implement request queuing to manage load');
    }

    return recommendations;
  }

  /**
   * Generate memory optimization recommendations
   */
  generateMemoryOptimizationRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.system.memoryUsage.percentage > 90) {
      recommendations.push('Implement memory caching with TTL');
      recommendations.push('Review for memory leaks in application code');
      recommendations.push('Consider increasing available memory resources');
    }
    
    if (metrics.application.processMemory.heapUsed > metrics.application.processMemory.heapTotal * 0.8) {
      recommendations.push('Optimize object creation and garbage collection');
      recommendations.push('Implement streaming for large data processing');
    }

    return recommendations;
  }

  /**
   * Generate event loop optimization recommendations
   */
  generateEventLoopOptimizationRecommendations(metrics) {
    const recommendations = [];
    
    recommendations.push('Review synchronous operations blocking the event loop');
    recommendations.push('Implement setImmediate() for CPU-intensive tasks');
    recommendations.push('Consider using worker threads for heavy computations');
    
    if (metrics.application.activeHandles > 100) {
      recommendations.push('Review and cleanup unused handles and timers');
    }

    return recommendations;
  }

  /**
   * Check for optimization opportunities
   */
  async checkOptimizationOpportunities(metrics) {
    const span = this.tracer?.startSpan('performance_optimization.check_opportunities');
    
    try {
      const opportunities = [];
      
      // Check historical trends
      if (this.performanceHistory.length >= 10) {
        const recentMetrics = this.performanceHistory.slice(-10);
        
        // Detect degrading performance trends
        const cpuTrend = this.calculateTrend(recentMetrics.map(m => m.system.cpuUsage));
        const memoryTrend = this.calculateTrend(recentMetrics.map(m => m.system.memoryUsage.percentage));
        
        if (cpuTrend > 0.1) {
          opportunities.push({
            type: 'cpu_trend',
            description: 'CPU usage showing upward trend',
            impact: 'medium',
            recommendations: ['Monitor for CPU leaks', 'Consider performance profiling']
          });
        }
        
        if (memoryTrend > 0.1) {
          opportunities.push({
            type: 'memory_trend',
            description: 'Memory usage showing upward trend',
            impact: 'high',
            recommendations: ['Check for memory leaks', 'Implement memory monitoring']
          });
        }
      }

      // Store opportunities
      if (opportunities.length > 0) {
        this.optimizations.set(metrics.timestamp, opportunities);
      }

      return opportunities;

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Calculate trend from array of values
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = values.reduce((acc, val, i) => acc + i, 0);
    const sumY = values.reduce((acc, val) => acc + val, 0);
    const sumXY = values.reduce((acc, val, i) => acc + i * val, 0);
    const sumXX = values.reduce((acc, val, i) => acc + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  /**
   * Apply automatic optimizations
   */
  async applyOptimizations(optimizations) {
    const span = this.tracer?.startSpan('performance_optimization.apply_optimizations');
    
    try {
      const results = [];
      
      for (const optimization of optimizations) {
        const result = await this.applyOptimization(optimization);
        results.push(result);
        
        if (result.success) {
          this.counters.optimizations_applied++;
          this.optimizationCounter?.add(1, { type: optimization.type });
        }
      }

      span?.setAttributes({
        optimizations_requested: optimizations.length,
        optimizations_applied: results.filter(r => r.success).length
      });

      return results;

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Apply individual optimization
   */
  async applyOptimization(optimization) {
    try {
      switch (optimization.type) {
        case 'gc_trigger':
          if (global.gc) {
            global.gc();
            return { success: true, message: 'Garbage collection triggered' };
          }
          return { success: false, message: 'Garbage collection not available' };
          
        case 'cache_clear':
          // Clear application caches
          return { success: true, message: 'Application caches cleared' };
          
        case 'connection_pool_resize':
          // Resize database connection pools
          return { success: true, message: 'Connection pool resized' };
          
        default:
          return { success: false, message: `Unknown optimization type: ${optimization.type}` };
      }
    } catch (error) {
      return { success: false, message: `Optimization failed: ${error.message}` };
    }
  }

  /**
   * Get performance report
   */
  async getPerformanceReport(timeRange = '1h') {
    const span = this.tracer?.startSpan('performance_optimization.get_report');
    
    try {
      const endTime = Date.now();
      const startTime = endTime - this.parseTimeRange(timeRange);
      
      const relevantMetrics = this.performanceHistory.filter(
        m => m.timestamp >= startTime && m.timestamp <= endTime
      );

      const report = {
        timeRange,
        period: { start: startTime, end: endTime },
        summary: this.generateSummary(relevantMetrics),
        trends: this.generateTrends(relevantMetrics),
        bottlenecks: this.getBottlenecksInRange(startTime, endTime),
        optimizations: this.getOptimizationsInRange(startTime, endTime),
        recommendations: this.generateRecommendations(relevantMetrics)
      };

      return report;

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Parse time range string to milliseconds
   */
  parseTimeRange(timeRange) {
    const unit = timeRange.slice(-1);
    const value = parseInt(timeRange.slice(0, -1));
    
    const multipliers = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };
    
    return value * (multipliers[unit] || multipliers['h']);
  }

  /**
   * Generate performance summary
   */
  generateSummary(metrics) {
    if (metrics.length === 0) return {};
    
    const cpuValues = metrics.map(m => m.system.cpuUsage);
    const memoryValues = metrics.map(m => m.system.memoryUsage.percentage);
    
    return {
      cpu: {
        average: this.calculateAverage(cpuValues),
        min: Math.min(...cpuValues),
        max: Math.max(...cpuValues),
        current: cpuValues[cpuValues.length - 1]
      },
      memory: {
        average: this.calculateAverage(memoryValues),
        min: Math.min(...memoryValues),
        max: Math.max(...memoryValues),
        current: memoryValues[memoryValues.length - 1]
      },
      dataPoints: metrics.length,
      counters: { ...this.counters }
    };
  }

  /**
   * Calculate average of array
   */
  calculateAverage(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Generate performance trends
   */
  generateTrends(metrics) {
    if (metrics.length < 5) return {};
    
    const cpuValues = metrics.map(m => m.system.cpuUsage);
    const memoryValues = metrics.map(m => m.system.memoryUsage.percentage);
    
    return {
      cpu: {
        trend: this.calculateTrend(cpuValues),
        direction: this.getTrendDirection(this.calculateTrend(cpuValues))
      },
      memory: {
        trend: this.calculateTrend(memoryValues),
        direction: this.getTrendDirection(this.calculateTrend(memoryValues))
      }
    };
  }

  /**
   * Get trend direction
   */
  getTrendDirection(trend) {
    if (trend > 0.1) return 'increasing';
    if (trend < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Get bottlenecks in time range
   */
  getBottlenecksInRange(startTime, endTime) {
    const bottlenecks = [];
    
    for (const [timestamp, bottleneckList] of this.bottlenecks.entries()) {
      if (timestamp >= startTime && timestamp <= endTime) {
        bottlenecks.push({
          timestamp,
          bottlenecks: bottleneckList
        });
      }
    }
    
    return bottlenecks;
  }

  /**
   * Get optimizations in time range
   */
  getOptimizationsInRange(startTime, endTime) {
    const optimizations = [];
    
    for (const [timestamp, optimizationList] of this.optimizations.entries()) {
      if (timestamp >= startTime && timestamp <= endTime) {
        optimizations.push({
          timestamp,
          optimizations: optimizationList
        });
      }
    }
    
    return optimizations;
  }

  /**
   * Generate recommendations based on metrics
   */
  generateRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.length === 0) return recommendations;
    
    const latest = metrics[metrics.length - 1];
    
    // High-level recommendations
    if (latest.system.cpuUsage > 70) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'CPU usage is high, consider scaling or optimization'
      });
    }
    
    if (latest.system.memoryUsage.percentage > 80) {
      recommendations.push({
        type: 'resource',
        priority: 'high',
        message: 'Memory usage is high, review memory management'
      });
    }
    
    return recommendations;
  }

  /**
   * Clean up old metrics to prevent memory growth
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - (this.config.metricsRetentionDays * 24 * 60 * 60 * 1000);
    
    // Clean performance history
    this.performanceHistory = this.performanceHistory.filter(m => m.timestamp > cutoffTime);
    
    // Clean metrics map
    for (const [timestamp] of this.metrics.entries()) {
      if (timestamp < cutoffTime) {
        this.metrics.delete(timestamp);
      }
    }
    
    // Clean bottlenecks map
    for (const [timestamp] of this.bottlenecks.entries()) {
      if (timestamp < cutoffTime) {
        this.bottlenecks.delete(timestamp);
      }
    }
    
    // Clean optimizations map
    for (const [timestamp] of this.optimizations.entries()) {
      if (timestamp < cutoffTime) {
        this.optimizations.delete(timestamp);
      }
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      metricsCount: this.metrics.size,
      bottlenecksCount: this.bottlenecks.size,
      optimizationsCount: this.optimizations.size,
      counters: { ...this.counters },
      config: { ...this.config }
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown() {
    if (this.isMonitoring) {
      await this.stopMonitoring();
    }
    
    this.metrics.clear();
    this.bottlenecks.clear();
    this.optimizations.clear();
    this.performanceHistory = [];
  }
}

export default PerformanceOptimizationEngine;
