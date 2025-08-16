import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs/promises';

/**
 * Resource Monitor
 * 
 * Advanced resource monitoring system with:
 * - Real-time resource tracking
 * - Threshold-based alerting
 * - Resource usage predictions
 * - Capacity planning insights
 * - Historical resource analytics
 * - Multi-dimensional resource metrics
 */
class ResourceMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      monitoringInterval: config.monitoringInterval || 3000,
      alertCooldown: config.alertCooldown || 30000,
      historySize: config.historySize || 1000,
      thresholds: {
        cpu: { warning: 70, critical: 85 },
        memory: { warning: 75, critical: 90 },
        disk: { warning: 80, critical: 95 },
        network: { warning: 80, critical: 95 },
        connections: { warning: 1000, critical: 2000 },
        ...config.thresholds
      },
      ...config
    };

    this.resourceHistory = new Map();
    this.alerts = new Map();
    this.lastAlertTimes = new Map();
    this.isMonitoring = false;
    this.monitoringTimer = null;
    this.resourceMetrics = new Map();

    // Resource tracking counters
    this.counters = {
      samples_collected: 0,
      alerts_triggered: 0,
      threshold_violations: 0,
      resource_optimizations: 0
    };

    this.initializeTracing();
    this.setupEventHandlers();
  }

  initializeTracing() {
    this.tracer = OpenTelemetryTracing.getTracer('performance-resource-monitor');
    
    // Create resource monitoring counters
    if (global.otelCounters) {
      this.resourceCounter = global.otelCounters.resource_samples || 
        OpenTelemetryTracing.createCounter('resource_samples_total', 'Total resource samples collected');
      this.alertCounter = global.otelCounters.resource_alerts || 
        OpenTelemetryTracing.createCounter('resource_alerts_total', 'Total resource alerts triggered');
      this.violationCounter = global.otelCounters.threshold_violations || 
        OpenTelemetryTracing.createCounter('threshold_violations_total', 'Total threshold violations detected');
    }
  }

  setupEventHandlers() {
    this.on('resourceAlert', (alert) => {
      console.warn(`Resource Alert: ${alert.resource} - ${alert.level} - ${alert.message}`);
    });

    this.on('thresholdViolation', (violation) => {
      this.counters.threshold_violations++;
      this.violationCounter?.add(1, { 
        resource: violation.resource, 
        level: violation.level 
      });
    });
  }

  /**
   * Start resource monitoring
   */
  async startMonitoring() {
    const span = this.tracer?.startSpan('resource_monitor.start_monitoring');
    
    try {
      if (this.isMonitoring) {
        throw new Error('Resource monitoring already running');
      }

      this.isMonitoring = true;
      
      // Start continuous monitoring
      this.monitoringTimer = setInterval(() => {
        this.collectResourceSample().catch(error => {
          console.error('Error collecting resource sample:', error);
        });
      }, this.config.monitoringInterval);

      // Initial sample collection
      await this.collectResourceSample();

      span?.setAttributes({
        monitoring_interval: this.config.monitoringInterval,
        history_size: this.config.historySize
      });

      this.emit('monitoringStarted');
      
      return {
        success: true,
        message: 'Resource monitoring started',
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
   * Stop resource monitoring
   */
  async stopMonitoring() {
    const span = this.tracer?.startSpan('resource_monitor.stop_monitoring');
    
    try {
      if (!this.isMonitoring) {
        throw new Error('Resource monitoring not running');
      }

      this.isMonitoring = false;
      
      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
        this.monitoringTimer = null;
      }

      this.emit('monitoringStopped');

      return {
        success: true,
        message: 'Resource monitoring stopped'
      };

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Collect comprehensive resource sample
   */
  async collectResourceSample() {
    const span = this.tracer?.startSpan('resource_monitor.collect_sample');
    
    try {
      const timestamp = Date.now();
      const sample = {
        timestamp,
        cpu: await this.collectCpuMetrics(),
        memory: await this.collectMemoryMetrics(),
        disk: await this.collectDiskMetrics(),
        network: await this.collectNetworkMetrics(),
        process: await this.collectProcessMetrics(),
        system: await this.collectSystemMetrics()
      };

      // Store sample with size limit
      this.storeResourceSample(timestamp, sample);

      // Check thresholds and trigger alerts
      await this.checkThresholds(sample);

      // Update resource metrics
      this.updateResourceMetrics(sample);

      this.counters.samples_collected++;
      this.resourceCounter?.add(1);

      span?.setAttributes({
        cpu_usage: sample.cpu.usage,
        memory_usage: sample.memory.usage,
        disk_usage: sample.disk.usage,
        active_processes: sample.process.count
      });

      return sample;

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Collect CPU metrics
   */
  async collectCpuMetrics() {
    const cpus = os.cpus();
    const usage = await this.calculateCpuUsage();
    const loadAvg = os.loadavg();
    
    return {
      usage: usage,
      cores: cpus.length,
      loadAverage: {
        '1min': loadAvg[0],
        '5min': loadAvg[1],
        '15min': loadAvg[2]
      },
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0,
      utilization: {
        user: 0, // Would calculate from detailed CPU stats
        system: 0,
        idle: 100 - usage,
        iowait: 0
      }
    };
  }

  /**
   * Calculate CPU usage with better accuracy
   */
  async calculateCpuUsage() {
    const startMeasure = this.getCpuMeasure();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endMeasure = this.getCpuMeasure();
    
    const idleDifference = endMeasure.idle - startMeasure.idle;
    const totalDifference = endMeasure.total - startMeasure.total;
    
    return Math.round(100 - (100 * idleDifference / totalDifference));
  }

  /**
   * Get CPU measurement for calculation
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
   * Collect memory metrics
   */
  async collectMemoryMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const processMemory = process.memoryUsage();
    
    return {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      usage: Math.round((usedMem / totalMem) * 100),
      available: freeMem,
      buffers: 0, // Would get from /proc/meminfo on Linux
      cached: 0,
      process: {
        rss: processMemory.rss,
        heapUsed: processMemory.heapUsed,
        heapTotal: processMemory.heapTotal,
        external: processMemory.external,
        arrayBuffers: processMemory.arrayBuffers
      },
      swap: {
        total: 0, // Would get from system stats
        used: 0,
        free: 0
      }
    };
  }

  /**
   * Collect disk metrics
   */
  async collectDiskMetrics() {
    try {
      // Get disk usage for current working directory
      const stats = await this.getDiskUsage(process.cwd());
      
      return {
        usage: stats.usage,
        total: stats.total,
        free: stats.free,
        used: stats.used,
        mounts: [
          {
            path: '/',
            usage: stats.usage,
            total: stats.total,
            free: stats.free,
            filesystem: 'unknown'
          }
        ],
        io: {
          readOps: 0,
          writeOps: 0,
          readBytes: 0,
          writeBytes: 0
        }
      };
    } catch (error) {
      return {
        usage: 0,
        total: 0,
        free: 0,
        used: 0,
        mounts: [],
        io: { readOps: 0, writeOps: 0, readBytes: 0, writeBytes: 0 }
      };
    }
  }

  /**
   * Get disk usage statistics
   */
  async getDiskUsage(path) {
    try {
      const stats = await fs.statvfs ? fs.statvfs(path) : null;
      if (!stats) {
        return { total: 0, free: 0, used: 0, usage: 0 };
      }
      
      const total = stats.blocks * stats.frsize;
      const free = stats.bavail * stats.frsize;
      const used = total - free;
      const usage = total > 0 ? Math.round((used / total) * 100) : 0;
      
      return { total, free, used, usage };
    } catch (error) {
      return { total: 0, free: 0, used: 0, usage: 0 };
    }
  }

  /**
   * Collect network metrics
   */
  async collectNetworkMetrics() {
    const networkInterfaces = os.networkInterfaces();
    
    return {
      interfaces: Object.keys(networkInterfaces).length,
      connections: {
        active: 0, // Would get from netstat or similar
        waiting: 0,
        established: 0
      },
      traffic: {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      },
      usage: 0, // Percentage of available bandwidth
      latency: {
        average: 0,
        min: 0,
        max: 0
      }
    };
  }

  /**
   * Collect process metrics
   */
  async collectProcessMetrics() {
    return {
      count: process._getActiveHandles().length + process._getActiveRequests().length,
      uptime: process.uptime(),
      pid: process.pid,
      ppid: process.ppid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      handles: {
        active: process._getActiveHandles().length,
        requests: process._getActiveRequests().length
      },
      eventLoop: {
        delay: await this.measureEventLoopDelay(),
        utilization: 0
      }
    };
  }

  /**
   * Measure event loop delay
   */
  async measureEventLoopDelay() {
    const start = process.hrtime.bigint();
    await new Promise(resolve => setImmediate(resolve));
    const delay = Number(process.hrtime.bigint() - start) / 1e6;
    return Math.round(delay * 100) / 100;
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics() {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      cpus: os.cpus().length,
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      homedir: os.homedir(),
      tmpdir: os.tmpdir()
    };
  }

  /**
   * Store resource sample with size management
   */
  storeResourceSample(timestamp, sample) {
    // Store in history with size limit
    if (!this.resourceHistory.has('samples')) {
      this.resourceHistory.set('samples', []);
    }
    
    const samples = this.resourceHistory.get('samples');
    samples.push({ timestamp, ...sample });
    
    // Maintain history size limit
    if (samples.length > this.config.historySize) {
      samples.splice(0, samples.length - this.config.historySize);
    }
  }

  /**
   * Check thresholds and trigger alerts
   */
  async checkThresholds(sample) {
    const alerts = [];
    const timestamp = sample.timestamp;
    
    // Check CPU threshold
    const cpuLevel = this.getThresholdLevel('cpu', sample.cpu.usage);
    if (cpuLevel && this.shouldTriggerAlert('cpu', cpuLevel, timestamp)) {
      alerts.push({
        resource: 'cpu',
        level: cpuLevel,
        value: sample.cpu.usage,
        threshold: this.config.thresholds.cpu[cpuLevel],
        message: `CPU usage ${sample.cpu.usage}% exceeds ${cpuLevel} threshold`,
        timestamp,
        recommendations: this.getCpuRecommendations(sample.cpu)
      });
    }
    
    // Check Memory threshold
    const memoryLevel = this.getThresholdLevel('memory', sample.memory.usage);
    if (memoryLevel && this.shouldTriggerAlert('memory', memoryLevel, timestamp)) {
      alerts.push({
        resource: 'memory',
        level: memoryLevel,
        value: sample.memory.usage,
        threshold: this.config.thresholds.memory[memoryLevel],
        message: `Memory usage ${sample.memory.usage}% exceeds ${memoryLevel} threshold`,
        timestamp,
        recommendations: this.getMemoryRecommendations(sample.memory)
      });
    }
    
    // Check Disk threshold
    const diskLevel = this.getThresholdLevel('disk', sample.disk.usage);
    if (diskLevel && this.shouldTriggerAlert('disk', diskLevel, timestamp)) {
      alerts.push({
        resource: 'disk',
        level: diskLevel,
        value: sample.disk.usage,
        threshold: this.config.thresholds.disk[diskLevel],
        message: `Disk usage ${sample.disk.usage}% exceeds ${diskLevel} threshold`,
        timestamp,
        recommendations: this.getDiskRecommendations(sample.disk)
      });
    }

    // Trigger alerts
    for (const alert of alerts) {
      this.triggerAlert(alert);
    }

    return alerts;
  }

  /**
   * Get threshold level for a resource
   */
  getThresholdLevel(resource, value) {
    const thresholds = this.config.thresholds[resource];
    if (!thresholds) return null;
    
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.warning) return 'warning';
    return null;
  }

  /**
   * Check if alert should be triggered (considering cooldown)
   */
  shouldTriggerAlert(resource, level, timestamp) {
    const alertKey = `${resource}_${level}`;
    const lastAlertTime = this.lastAlertTimes.get(alertKey);
    
    if (!lastAlertTime) return true;
    
    return (timestamp - lastAlertTime) >= this.config.alertCooldown;
  }

  /**
   * Trigger resource alert
   */
  triggerAlert(alert) {
    const alertKey = `${alert.resource}_${alert.level}`;
    this.lastAlertTimes.set(alertKey, alert.timestamp);
    
    // Store alert
    if (!this.alerts.has(alert.timestamp)) {
      this.alerts.set(alert.timestamp, []);
    }
    this.alerts.get(alert.timestamp).push(alert);
    
    this.counters.alerts_triggered++;
    this.alertCounter?.add(1, { 
      resource: alert.resource, 
      level: alert.level 
    });
    
    this.emit('resourceAlert', alert);
    this.emit('thresholdViolation', {
      resource: alert.resource,
      level: alert.level,
      value: alert.value,
      threshold: alert.threshold
    });
  }

  /**
   * Get CPU optimization recommendations
   */
  getCpuRecommendations(cpuMetrics) {
    const recommendations = [];
    
    if (cpuMetrics.usage > 85) {
      recommendations.push('Consider scaling horizontally');
      recommendations.push('Profile CPU-intensive operations');
      recommendations.push('Implement CPU task queuing');
    }
    
    if (cpuMetrics.loadAverage['1min'] > cpuMetrics.cores * 2) {
      recommendations.push('Load average is high - consider load balancing');
    }
    
    return recommendations;
  }

  /**
   * Get memory optimization recommendations
   */
  getMemoryRecommendations(memoryMetrics) {
    const recommendations = [];
    
    if (memoryMetrics.usage > 90) {
      recommendations.push('Memory usage critical - implement memory optimization');
      recommendations.push('Review for memory leaks');
      recommendations.push('Consider increasing available memory');
    }
    
    if (memoryMetrics.process.heapUsed > memoryMetrics.process.heapTotal * 0.8) {
      recommendations.push('Heap usage high - optimize object lifecycle');
    }
    
    return recommendations;
  }

  /**
   * Get disk optimization recommendations
   */
  getDiskRecommendations(diskMetrics) {
    const recommendations = [];
    
    if (diskMetrics.usage > 90) {
      recommendations.push('Disk space critical - cleanup required');
      recommendations.push('Implement log rotation');
      recommendations.push('Archive old data');
    }
    
    return recommendations;
  }

  /**
   * Update resource metrics aggregation
   */
  updateResourceMetrics(sample) {
    const metrics = this.resourceMetrics;
    
    // Update CPU metrics
    this.updateMetricAggregation(metrics, 'cpu_usage', sample.cpu.usage);
    this.updateMetricAggregation(metrics, 'memory_usage', sample.memory.usage);
    this.updateMetricAggregation(metrics, 'disk_usage', sample.disk.usage);
    this.updateMetricAggregation(metrics, 'load_average', sample.cpu.loadAverage['1min']);
  }

  /**
   * Update metric aggregation
   */
  updateMetricAggregation(metrics, key, value) {
    if (!metrics.has(key)) {
      metrics.set(key, {
        min: value,
        max: value,
        sum: value,
        count: 1,
        average: value,
        last: value
      });
    } else {
      const metric = metrics.get(key);
      metric.min = Math.min(metric.min, value);
      metric.max = Math.max(metric.max, value);
      metric.sum += value;
      metric.count += 1;
      metric.average = metric.sum / metric.count;
      metric.last = value;
    }
  }

  /**
   * Get resource statistics
   */
  getResourceStatistics(timeRange = '1h') {
    const endTime = Date.now();
    const startTime = endTime - this.parseTimeRange(timeRange);
    
    const samples = this.resourceHistory.get('samples') || [];
    const relevantSamples = samples.filter(
      s => s.timestamp >= startTime && s.timestamp <= endTime
    );

    if (relevantSamples.length === 0) {
      return { message: 'No data available for specified time range' };
    }

    return {
      timeRange,
      sampleCount: relevantSamples.length,
      period: { start: startTime, end: endTime },
      cpu: this.calculateResourceStats(relevantSamples, 'cpu.usage'),
      memory: this.calculateResourceStats(relevantSamples, 'memory.usage'),
      disk: this.calculateResourceStats(relevantSamples, 'disk.usage'),
      loadAverage: this.calculateResourceStats(relevantSamples, 'cpu.loadAverage.1min'),
      trends: this.calculateTrends(relevantSamples),
      alerts: this.getAlertsInRange(startTime, endTime)
    };
  }

  /**
   * Calculate statistics for a resource metric
   */
  calculateResourceStats(samples, metricPath) {
    const values = samples.map(sample => this.getNestedValue(sample, metricPath))
                         .filter(val => val !== undefined);
    
    if (values.length === 0) return {};
    
    const sorted = values.sort((a, b) => a - b);
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      current: values[values.length - 1]
    };
  }

  /**
   * Get nested object value by path
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Calculate resource trends
   */
  calculateTrends(samples) {
    if (samples.length < 5) return {};
    
    const cpuValues = samples.map(s => s.cpu.usage);
    const memoryValues = samples.map(s => s.memory.usage);
    
    return {
      cpu: this.calculateTrend(cpuValues),
      memory: this.calculateTrend(memoryValues)
    };
  }

  /**
   * Calculate trend from values
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = values.reduce((acc, val, i) => acc + i, 0);
    const sumY = values.reduce((acc, val) => acc + val, 0);
    const sumXY = values.reduce((acc, val, i) => acc + i * val, 0);
    const sumXX = values.reduce((acc, val, i) => acc + i * i, 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  /**
   * Get alerts in time range
   */
  getAlertsInRange(startTime, endTime) {
    const alerts = [];
    
    for (const [timestamp, alertList] of this.alerts.entries()) {
      if (timestamp >= startTime && timestamp <= endTime) {
        alerts.push(...alertList);
      }
    }
    
    return alerts;
  }

  /**
   * Parse time range to milliseconds
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
   * Get current resource status
   */
  async getCurrentStatus() {
    const sample = await this.collectResourceSample();
    
    return {
      timestamp: sample.timestamp,
      cpu: {
        usage: sample.cpu.usage,
        cores: sample.cpu.cores,
        loadAverage: sample.cpu.loadAverage['1min']
      },
      memory: {
        usage: sample.memory.usage,
        total: sample.memory.total,
        free: sample.memory.free
      },
      disk: {
        usage: sample.disk.usage,
        total: sample.disk.total,
        free: sample.disk.free
      },
      process: {
        uptime: sample.process.uptime,
        memory: sample.process.handles,
        eventLoopDelay: sample.process.eventLoop.delay
      },
      monitoring: {
        isActive: this.isMonitoring,
        samplesCollected: this.counters.samples_collected,
        alertsTriggered: this.counters.alerts_triggered
      }
    };
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      config: { ...this.config },
      counters: { ...this.counters },
      resourceMetrics: Object.fromEntries(this.resourceMetrics),
      historySize: this.resourceHistory.get('samples')?.length || 0,
      alertsCount: this.alerts.size
    };
  }

  /**
   * Shutdown the monitor
   */
  async shutdown() {
    if (this.isMonitoring) {
      await this.stopMonitoring();
    }
    
    this.resourceHistory.clear();
    this.alerts.clear();
    this.lastAlertTimes.clear();
    this.resourceMetrics.clear();
    this.removeAllListeners();
  }
}

export default ResourceMonitor;
