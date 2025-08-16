import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import { EventEmitter } from 'events';

/**
 * Auto Scaler
 * 
 * Intelligent auto-scaling system with:
 * - Predictive scaling based on performance metrics
 * - Resource demand forecasting
 * - Dynamic scaling policies
 * - Cost-optimized scaling decisions
 * - Multi-dimensional scaling strategies
 * - Automated rollback capabilities
 */
class AutoScaler extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      scalingInterval: config.scalingInterval || 30000,
      cooldownPeriod: config.cooldownPeriod || 300000, // 5 minutes
      scaleUpThresholds: {
        cpu: 75,
        memory: 80,
        responseTime: 2000,
        errorRate: 5,
        queueDepth: 100,
        ...config.scaleUpThresholds
      },
      scaleDownThresholds: {
        cpu: 30,
        memory: 40,
        responseTime: 500,
        errorRate: 1,
        queueDepth: 10,
        ...config.scaleDownThresholds
      },
      scalingPolicies: {
        minInstances: config.scalingPolicies?.minInstances || 1,
        maxInstances: config.scalingPolicies?.maxInstances || 10,
        scaleUpFactor: config.scalingPolicies?.scaleUpFactor || 1.5,
        scaleDownFactor: config.scalingPolicies?.scaleDownFactor || 0.7,
        targetUtilization: config.scalingPolicies?.targetUtilization || 70,
        ...config.scalingPolicies
      },
      predictionWindow: config.predictionWindow || 900000, // 15 minutes
      ...config
    };

    this.currentInstances = 1;
    this.scalingHistory = [];
    this.performanceHistory = [];
    this.scalingDecisions = new Map();
    this.lastScalingAction = 0;
    this.isScaling = false;
    this.scalingTimer = null;

    // Scaling strategies
    this.scalingStrategies = {
      REACTIVE: 'reactive',
      PREDICTIVE: 'predictive',
      SCHEDULED: 'scheduled',
      HYBRID: 'hybrid'
    };

    this.currentStrategy = this.scalingStrategies.HYBRID;

    // Scaling counters
    this.counters = {
      scale_up_actions: 0,
      scale_down_actions: 0,
      scaling_decisions: 0,
      predictions_made: 0,
      rollbacks_performed: 0
    };

    this.initializeTracing();
  }

  initializeTracing() {
    this.tracer = OpenTelemetryTracing.getTracer('performance-auto-scaler');
    
    // Create auto-scaling counters
    if (global.otelCounters) {
      this.scalingCounter = global.otelCounters.scaling_actions || 
        OpenTelemetryTracing.createCounter('scaling_actions_total', 'Total scaling actions performed');
      this.predictionCounter = global.otelCounters.scaling_predictions || 
        OpenTelemetryTracing.createCounter('scaling_predictions_total', 'Total scaling predictions made');
      this.decisionCounter = global.otelCounters.scaling_decisions || 
        OpenTelemetryTracing.createCounter('scaling_decisions_total', 'Total scaling decisions made');
    }
  }

  /**
   * Start auto-scaling
   */
  async startScaling() {
    const span = this.tracer?.startSpan('auto_scaler.start_scaling');
    
    try {
      if (this.isScaling) {
        throw new Error('Auto-scaling already running');
      }

      this.isScaling = true;
      
      // Start periodic scaling evaluation
      this.scalingTimer = setInterval(() => {
        this.evaluateScalingDecision().catch(error => {
          console.error('Error evaluating scaling decision:', error);
        });
      }, this.config.scalingInterval);

      this.emit('scalingStarted');

      return {
        success: true,
        message: 'Auto-scaling started',
        strategy: this.currentStrategy,
        currentInstances: this.currentInstances
      };

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Stop auto-scaling
   */
  async stopScaling() {
    const span = this.tracer?.startSpan('auto_scaler.stop_scaling');
    
    try {
      if (!this.isScaling) {
        throw new Error('Auto-scaling not running');
      }

      this.isScaling = false;
      
      if (this.scalingTimer) {
        clearInterval(this.scalingTimer);
        this.scalingTimer = null;
      }

      this.emit('scalingStopped');

      return {
        success: true,
        message: 'Auto-scaling stopped'
      };

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Evaluate scaling decision based on current metrics
   */
  async evaluateScalingDecision(performanceMetrics) {
    const span = this.tracer?.startSpan('auto_scaler.evaluate_scaling_decision');
    
    try {
      const now = Date.now();
      
      // Check cooldown period
      if (now - this.lastScalingAction < this.config.cooldownPeriod) {
        return {
          decision: 'wait',
          reason: 'Cooling down from recent scaling action',
          timeRemaining: this.config.cooldownPeriod - (now - this.lastScalingAction)
        };
      }

      // Get current performance metrics (would come from ResourceMonitor)
      const metrics = performanceMetrics || await this.getCurrentMetrics();
      
      // Store metrics for trend analysis
      this.performanceHistory.push({
        timestamp: now,
        metrics: { ...metrics },
        instances: this.currentInstances
      });
      
      // Maintain history size
      if (this.performanceHistory.length > 100) {
        this.performanceHistory.splice(0, 10);
      }

      // Make scaling decision based on strategy
      let decision;
      switch (this.currentStrategy) {
        case this.scalingStrategies.REACTIVE:
          decision = await this.makeReactiveScalingDecision(metrics);
          break;
        case this.scalingStrategies.PREDICTIVE:
          decision = await this.makePredictiveScalingDecision(metrics);
          break;
        case this.scalingStrategies.SCHEDULED:
          decision = await this.makeScheduledScalingDecision(metrics);
          break;
        case this.scalingStrategies.HYBRID:
        default:
          decision = await this.makeHybridScalingDecision(metrics);
          break;
      }

      // Store decision
      this.scalingDecisions.set(now, decision);
      this.counters.scaling_decisions++;
      this.decisionCounter?.add(1, { 
        action: decision.action, 
        strategy: this.currentStrategy 
      });

      // Execute scaling if needed
      if (decision.action === 'scale_up' || decision.action === 'scale_down') {
        const result = await this.executeScalingAction(decision);
        decision.executionResult = result;
      }

      span?.setAttributes({
        decision_action: decision.action,
        current_instances: this.currentInstances,
        target_instances: decision.targetInstances || this.currentInstances,
        cpu_usage: metrics.cpu,
        memory_usage: metrics.memory
      });

      return decision;

    } catch (error) {
      span?.recordException(error);
      throw error;
    } finally {
      span?.end();
    }
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics() {
    // This would typically get metrics from ResourceMonitor
    // For now, return mock data
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      responseTime: Math.random() * 3000,
      errorRate: Math.random() * 10,
      requestsPerSecond: Math.random() * 1000,
      queueDepth: Math.random() * 200,
      activeConnections: Math.random() * 500
    };
  }

  /**
   * Make reactive scaling decision
   */
  async makeReactiveScalingDecision(metrics) {
    const decision = {
      strategy: this.scalingStrategies.REACTIVE,
      timestamp: Date.now(),
      metrics: { ...metrics },
      action: 'none',
      reason: '',
      confidence: 1.0
    };

    // Check scale-up conditions
    const scaleUpReasons = [];
    if (metrics.cpu > this.config.scaleUpThresholds.cpu) {
      scaleUpReasons.push(`CPU usage ${metrics.cpu}% > ${this.config.scaleUpThresholds.cpu}%`);
    }
    if (metrics.memory > this.config.scaleUpThresholds.memory) {
      scaleUpReasons.push(`Memory usage ${metrics.memory}% > ${this.config.scaleUpThresholds.memory}%`);
    }
    if (metrics.responseTime > this.config.scaleUpThresholds.responseTime) {
      scaleUpReasons.push(`Response time ${metrics.responseTime}ms > ${this.config.scaleUpThresholds.responseTime}ms`);
    }
    if (metrics.errorRate > this.config.scaleUpThresholds.errorRate) {
      scaleUpReasons.push(`Error rate ${metrics.errorRate}% > ${this.config.scaleUpThresholds.errorRate}%`);
    }

    // Check scale-down conditions
    const scaleDownReasons = [];
    if (metrics.cpu < this.config.scaleDownThresholds.cpu) {
      scaleDownReasons.push(`CPU usage ${metrics.cpu}% < ${this.config.scaleDownThresholds.cpu}%`);
    }
    if (metrics.memory < this.config.scaleDownThresholds.memory) {
      scaleDownReasons.push(`Memory usage ${metrics.memory}% < ${this.config.scaleDownThresholds.memory}%`);
    }
    if (metrics.responseTime < this.config.scaleDownThresholds.responseTime) {
      scaleDownReasons.push(`Response time ${metrics.responseTime}ms < ${this.config.scaleDownThresholds.responseTime}ms`);
    }

    // Decide scaling action
    if (scaleUpReasons.length >= 2 && this.currentInstances < this.config.scalingPolicies.maxInstances) {
      decision.action = 'scale_up';
      decision.reason = `Scale up: ${scaleUpReasons.join(', ')}`;
      decision.targetInstances = Math.min(
        Math.ceil(this.currentInstances * this.config.scalingPolicies.scaleUpFactor),
        this.config.scalingPolicies.maxInstances
      );
    } else if (scaleDownReasons.length >= 3 && this.currentInstances > this.config.scalingPolicies.minInstances) {
      decision.action = 'scale_down';
      decision.reason = `Scale down: ${scaleDownReasons.join(', ')}`;
      decision.targetInstances = Math.max(
        Math.floor(this.currentInstances * this.config.scalingPolicies.scaleDownFactor),
        this.config.scalingPolicies.minInstances
      );
    } else {
      decision.action = 'none';
      decision.reason = 'No scaling thresholds met or at capacity limits';
    }

    return decision;
  }

  /**
   * Make predictive scaling decision
   */
  async makePredictiveScalingDecision(metrics) {
    const decision = {
      strategy: this.scalingStrategies.PREDICTIVE,
      timestamp: Date.now(),
      metrics: { ...metrics },
      action: 'none',
      reason: '',
      confidence: 0.0,
      prediction: null
    };

    // Need sufficient history for prediction
    if (this.performanceHistory.length < 10) {
      decision.reason = 'Insufficient historical data for prediction';
      return decision;
    }

    // Generate prediction
    const prediction = await this.generateDemandPrediction();
    decision.prediction = prediction;
    
    this.counters.predictions_made++;
    this.predictionCounter?.add(1, { type: 'demand_forecast' });

    // Make decision based on prediction
    if (prediction.confidence > 0.7) {
      if (prediction.expectedLoad > this.config.scalingPolicies.targetUtilization) {
        const recommendedInstances = Math.ceil(
          prediction.expectedLoad / this.config.scalingPolicies.targetUtilization * this.currentInstances
        );
        
        if (recommendedInstances > this.currentInstances && recommendedInstances <= this.config.scalingPolicies.maxInstances) {
          decision.action = 'scale_up';
          decision.targetInstances = Math.min(recommendedInstances, this.config.scalingPolicies.maxInstances);
          decision.reason = `Predicted load increase to ${prediction.expectedLoad}% in ${prediction.timeHorizon}ms`;
          decision.confidence = prediction.confidence;
        }
      } else if (prediction.expectedLoad < this.config.scalingPolicies.targetUtilization * 0.6) {
        const recommendedInstances = Math.max(
          1,
          Math.ceil(prediction.expectedLoad / this.config.scalingPolicies.targetUtilization * this.currentInstances)
        );
        
        if (recommendedInstances < this.currentInstances && recommendedInstances >= this.config.scalingPolicies.minInstances) {
          decision.action = 'scale_down';
          decision.targetInstances = Math.max(recommendedInstances, this.config.scalingPolicies.minInstances);
          decision.reason = `Predicted load decrease to ${prediction.expectedLoad}% in ${prediction.timeHorizon}ms`;
          decision.confidence = prediction.confidence;
        }
      }
    } else {
      decision.reason = `Prediction confidence ${prediction.confidence} too low for action`;
    }

    return decision;
  }

  /**
   * Generate demand prediction
   */
  async generateDemandPrediction() {
    const recentHistory = this.performanceHistory.slice(-20);
    
    // Simple trend-based prediction
    const cpuTrend = this.calculateTrend(recentHistory.map(h => h.metrics.cpu));
    const memoryTrend = this.calculateTrend(recentHistory.map(h => h.metrics.memory));
    const responseTrend = this.calculateTrend(recentHistory.map(h => h.metrics.responseTime));
    
    // Current average
    const avgCpu = recentHistory.reduce((sum, h) => sum + h.metrics.cpu, 0) / recentHistory.length;
    const avgMemory = recentHistory.reduce((sum, h) => sum + h.metrics.memory, 0) / recentHistory.length;
    
    // Predict load in next prediction window
    const timeHorizon = this.config.predictionWindow;
    const trendFactor = timeHorizon / (this.config.scalingInterval * recentHistory.length);
    
    const predictedCpu = Math.max(0, Math.min(100, avgCpu + (cpuTrend * trendFactor)));
    const predictedMemory = Math.max(0, Math.min(100, avgMemory + (memoryTrend * trendFactor)));
    
    // Combine predictions (weighted average)
    const expectedLoad = (predictedCpu * 0.6) + (predictedMemory * 0.4);
    
    // Calculate confidence based on trend consistency
    const trendConsistency = 1 - Math.abs(cpuTrend - memoryTrend) / 100;
    const historicalVariance = this.calculateVariance(recentHistory.map(h => h.metrics.cpu));
    const confidence = Math.max(0.1, Math.min(0.95, trendConsistency * (1 - historicalVariance / 100)));

    return {
      expectedLoad,
      predictedCpu,
      predictedMemory,
      confidence,
      timeHorizon,
      trendFactor,
      basedOnSamples: recentHistory.length
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
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
  }

  /**
   * Calculate variance
   */
  calculateVariance(values) {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Make scheduled scaling decision
   */
  async makeScheduledScalingDecision(metrics) {
    const decision = {
      strategy: this.scalingStrategies.SCHEDULED,
      timestamp: Date.now(),
      metrics: { ...metrics },
      action: 'none',
      reason: 'No scheduled scaling rules defined',
      confidence: 1.0
    };

    // This would implement time-based scaling rules
    // For example, scale up during business hours, scale down at night
    
    return decision;
  }

  /**
   * Make hybrid scaling decision
   */
  async makeHybridScalingDecision(metrics) {
    // Combine reactive and predictive strategies
    const reactiveDecision = await this.makeReactiveScalingDecision(metrics);
    const predictiveDecision = await this.makePredictiveScalingDecision(metrics);

    const decision = {
      strategy: this.scalingStrategies.HYBRID,
      timestamp: Date.now(),
      metrics: { ...metrics },
      action: 'none',
      reason: '',
      confidence: 0.0,
      reactiveDecision,
      predictiveDecision
    };

    // Prioritize reactive decisions for immediate issues
    if (reactiveDecision.action !== 'none') {
      decision.action = reactiveDecision.action;
      decision.targetInstances = reactiveDecision.targetInstances;
      decision.reason = `Reactive: ${reactiveDecision.reason}`;
      decision.confidence = 0.9;
    } else if (predictiveDecision.action !== 'none' && predictiveDecision.confidence > 0.8) {
      decision.action = predictiveDecision.action;
      decision.targetInstances = predictiveDecision.targetInstances;
      decision.reason = `Predictive: ${predictiveDecision.reason}`;
      decision.confidence = predictiveDecision.confidence;
    } else {
      decision.reason = 'No scaling action needed by reactive or predictive strategies';
    }

    return decision;
  }

  /**
   * Execute scaling action
   */
  async executeScalingAction(decision) {
    const span = this.tracer?.startSpan('auto_scaler.execute_scaling_action');
    
    try {
      const previousInstances = this.currentInstances;
      const targetInstances = decision.targetInstances;
      
      // Validate scaling limits
      if (targetInstances < this.config.scalingPolicies.minInstances || 
          targetInstances > this.config.scalingPolicies.maxInstances) {
        throw new Error(`Target instances ${targetInstances} outside allowed range`);
      }

      // Record scaling action
      const scalingAction = {
        timestamp: Date.now(),
        action: decision.action,
        fromInstances: previousInstances,
        toInstances: targetInstances,
        reason: decision.reason,
        strategy: decision.strategy,
        confidence: decision.confidence,
        metrics: { ...decision.metrics }
      };

      // In a real implementation, this would trigger actual scaling
      // For now, we'll simulate the scaling
      const result = await this.simulateScaling(scalingAction);
      
      if (result.success) {
        this.currentInstances = targetInstances;
        this.lastScalingAction = Date.now();
        
        // Update counters
        if (decision.action === 'scale_up') {
          this.counters.scale_up_actions++;
        } else if (decision.action === 'scale_down') {
          this.counters.scale_down_actions++;
        }
        
        this.scalingCounter?.add(1, { 
          action: decision.action,
          from_instances: previousInstances,
          to_instances: targetInstances
        });

        // Store in history
        scalingAction.result = result;
        scalingAction.actualInstances = this.currentInstances;
        this.scalingHistory.push(scalingAction);

        // Emit events
        this.emit('scalingExecuted', scalingAction);
        
        if (decision.action === 'scale_up') {
          this.emit('scaledUp', {
            fromInstances: previousInstances,
            toInstances: this.currentInstances,
            reason: decision.reason
          });
        } else if (decision.action === 'scale_down') {
          this.emit('scaledDown', {
            fromInstances: previousInstances,
            toInstances: this.currentInstances,
            reason: decision.reason
          });
        }
      }

      span?.setAttributes({
        action: decision.action,
        from_instances: previousInstances,
        to_instances: targetInstances,
        success: result.success
      });

      return result;

    } catch (error) {
      span?.recordException(error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    } finally {
      span?.end();
    }
  }

  /**
   * Simulate scaling operation
   */
  async simulateScaling(scalingAction) {
    // Simulate scaling delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate occasional failures
    const failureRate = 0.05; // 5% chance of failure
    if (Math.random() < failureRate) {
      return {
        success: false,
        error: 'Simulated scaling failure',
        timestamp: Date.now()
      };
    }
    
    return {
      success: true,
      message: `Successfully ${scalingAction.action}d from ${scalingAction.fromInstances} to ${scalingAction.toInstances} instances`,
      timestamp: Date.now(),
      duration: 1000
    };
  }

  /**
   * Set scaling strategy
   */
  setScalingStrategy(strategy) {
    if (!Object.values(this.scalingStrategies).includes(strategy)) {
      throw new Error(`Invalid scaling strategy: ${strategy}`);
    }
    
    const previousStrategy = this.currentStrategy;
    this.currentStrategy = strategy;
    
    this.emit('strategyChanged', {
      from: previousStrategy,
      to: strategy,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      message: `Scaling strategy changed from ${previousStrategy} to ${strategy}`,
      strategy: this.currentStrategy
    };
  }

  /**
   * Update scaling policies
   */
  updateScalingPolicies(newPolicies) {
    const previousPolicies = { ...this.config.scalingPolicies };
    
    // Merge new policies with existing ones
    this.config.scalingPolicies = {
      ...this.config.scalingPolicies,
      ...newPolicies
    };
    
    // Update thresholds if provided
    if (newPolicies.scaleUpThresholds) {
      this.config.scaleUpThresholds = {
        ...this.config.scaleUpThresholds,
        ...newPolicies.scaleUpThresholds
      };
    }
    
    if (newPolicies.scaleDownThresholds) {
      this.config.scaleDownThresholds = {
        ...this.config.scaleDownThresholds,
        ...newPolicies.scaleDownThresholds
      };
    }
    
    this.emit('policiesUpdated', {
      previous: previousPolicies,
      current: this.config.scalingPolicies,
      timestamp: Date.now()
    });
    
    return {
      success: true,
      message: 'Scaling policies updated',
      policies: this.config.scalingPolicies
    };
  }

  /**
   * Get scaling recommendations
   */
  async getScalingRecommendations(performanceMetrics) {
    const metrics = performanceMetrics || await this.getCurrentMetrics();
    const recommendations = [];
    
    // Analyze current state
    const utilization = (metrics.cpu + metrics.memory) / 2;
    const targetUtilization = this.config.scalingPolicies.targetUtilization;
    
    if (utilization > targetUtilization * 1.2) {
      recommendations.push({
        type: 'scale_up',
        priority: 'high',
        reason: `Utilization ${utilization.toFixed(1)}% exceeds target by significant margin`,
        recommendedInstances: Math.ceil(utilization / targetUtilization * this.currentInstances),
        impact: 'Improved performance and reliability'
      });
    }
    
    if (utilization < targetUtilization * 0.5 && this.currentInstances > this.config.scalingPolicies.minInstances) {
      recommendations.push({
        type: 'scale_down',
        priority: 'medium',
        reason: `Utilization ${utilization.toFixed(1)}% is well below target`,
        recommendedInstances: Math.max(
          this.config.scalingPolicies.minInstances,
          Math.ceil(utilization / targetUtilization * this.currentInstances)
        ),
        impact: 'Cost savings without performance impact'
      });
    }
    
    if (metrics.errorRate > 5) {
      recommendations.push({
        type: 'scale_up',
        priority: 'critical',
        reason: `High error rate ${metrics.errorRate}% indicates overload`,
        recommendedInstances: Math.min(
          this.config.scalingPolicies.maxInstances,
          this.currentInstances * 2
        ),
        impact: 'Reduced error rate and improved user experience'
      });
    }
    
    return recommendations;
  }

  /**
   * Get scaling report
   */
  async getScalingReport(timeRange = '1h') {
    const endTime = Date.now();
    const startTime = endTime - this.parseTimeRange(timeRange);
    
    const relevantHistory = this.scalingHistory.filter(
      action => action.timestamp >= startTime && action.timestamp <= endTime
    );

    const decisions = Array.from(this.scalingDecisions.entries())
      .filter(([timestamp]) => timestamp >= startTime && timestamp <= endTime)
      .map(([timestamp, decision]) => ({ timestamp, ...decision }));

    return {
      timeRange,
      period: { start: startTime, end: endTime },
      currentInstances: this.currentInstances,
      strategy: this.currentStrategy,
      scalingActions: relevantHistory,
      scalingDecisions: decisions,
      summary: {
        totalActions: relevantHistory.length,
        scaleUpActions: relevantHistory.filter(a => a.action === 'scale_up').length,
        scaleDownActions: relevantHistory.filter(a => a.action === 'scale_down').length,
        averageInstances: this.calculateAverageInstances(relevantHistory),
        successRate: this.calculateSuccessRate(relevantHistory)
      },
      counters: { ...this.counters },
      recommendations: await this.getScalingRecommendations()
    };
  }

  /**
   * Calculate average instances over time period
   */
  calculateAverageInstances(history) {
    if (history.length === 0) return this.currentInstances;
    
    const instanceHours = history.reduce((sum, action) => {
      return sum + action.actualInstances || action.toInstances;
    }, this.currentInstances);
    
    return instanceHours / (history.length + 1);
  }

  /**
   * Calculate scaling success rate
   */
  calculateSuccessRate(history) {
    if (history.length === 0) return 100;
    
    const successfulActions = history.filter(action => 
      action.result && action.result.success
    ).length;
    
    return (successfulActions / history.length) * 100;
  }

  /**
   * Parse time range string
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
   * Get current status
   */
  getStatus() {
    return {
      isScaling: this.isScaling,
      currentInstances: this.currentInstances,
      strategy: this.currentStrategy,
      config: { ...this.config },
      counters: { ...this.counters },
      lastScalingAction: this.lastScalingAction,
      scalingHistorySize: this.scalingHistory.length,
      performanceHistorySize: this.performanceHistory.length,
      scalingDecisions: this.scalingDecisions.size
    };
  }

  /**
   * Shutdown the auto-scaler
   */
  async shutdown() {
    if (this.isScaling) {
      await this.stopScaling();
    }
    
    this.scalingHistory = [];
    this.performanceHistory = [];
    this.scalingDecisions.clear();
    this.removeAllListeners();
  }
}

export default AutoScaler;
