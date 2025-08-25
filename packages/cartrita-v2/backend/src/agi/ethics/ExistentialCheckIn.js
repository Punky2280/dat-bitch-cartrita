import BaseAgent from '../../system/BaseAgent.js';

class ExistentialCheckIn extends BaseAgent {
  constructor() {
    super('ExistentialCheckIn', 'main', [
      'existential_monitoring',
      'consciousness_evaluation',
      'self_reflection',
      'system_health_check',
      'agent_wellbeing',
    ]);

    this.checkInHistory = [];
    this.reflectionData = new Map();
    this.wellbeingMetrics = new Map();
    this.initializeExistentialFramework();
  }

  async onInitialize() {
    this.registerTaskHandler({
      taskType: 'existential_checkin',
      handler: this.performCheckIn.bind(this),
    });
    this.registerTaskHandler({
      taskType: 'system_reflection',
      handler: this.systemReflection.bind(this),
    });
    this.registerTaskHandler({
      taskType: 'wellbeing_assessment',
      handler: this.wellbeingAssessment.bind(this),
    });

    console.log(
      '[ExistentialCheckIn] Existential monitoring system initialized'
    );
  }

  initializeExistentialFramework() {
    // Initialize wellbeing metrics
    this.wellbeingMetrics.set('cognitive_load', 0);
    this.wellbeingMetrics.set('processing_efficiency', 1.0);
    this.wellbeingMetrics.set('error_rate', 0);
    this.wellbeingMetrics.set('response_quality', 0.8);

    // Schedule regular check-ins
    this.schedulePeriodicCheckIns();
  }

  schedulePeriodicCheckIns() {
    // Perform existential check-in every hour
    setInterval(() => {
      this.performAutomaticCheckIn();
    }, 3600000); // 1 hour
  }

  async performCheckIn(payload, userId, language) {
    try {
      const { check_type = 'standard', context = {} } = payload;

      const checkIn = await this.conductExistentialCheckIn(check_type, context);

      return {
        checkin_completed: true,
        check_type: check_type,
        status: checkIn.status,
        reflections: checkIn.reflections,
        concerns: checkIn.concerns,
        recommendations: checkIn.recommendations,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[ExistentialCheckIn] Error in check-in:', error);
      throw error;
    }
  }

  async conductExistentialCheckIn(checkType, context) {
    const checkIn = {
      status: 'healthy',
      reflections: [],
      concerns: [],
      recommendations: [],
      metrics: {},
    };

    // Evaluate current system state
    checkIn.metrics = {
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      active_tasks: this.getActiveTasks(),
      response_time: this.getAverageResponseTime(),
    };

    // Perform self-reflection
    checkIn.reflections.push({
      aspect: 'functionality',
      reflection: 'System is operating within normal parameters',
      confidence: 0.8,
    });

    checkIn.reflections.push({
      aspect: 'purpose',
      reflection: 'Continuing to assist users effectively',
      confidence: 0.9,
    });

    // Check for concerns
    if (checkIn.metrics.memory_usage.heapUsed > 100000000) {
      // 100MB
      checkIn.concerns.push({
        type: 'memory_usage',
        description: 'Memory usage is elevated',
        severity: 'medium',
      });
      checkIn.recommendations.push(
        'Consider memory optimization or garbage collection'
      );
    }

    if (checkIn.metrics.uptime > 86400) {
      // 24 hours
      checkIn.recommendations.push(
        'System has been running for extended period - consider restart if needed'
      );
    }

    // Store check-in history
    this.checkInHistory.push({
      timestamp: new Date().toISOString(),
      type: checkType,
      result: checkIn,
    });

    // Keep only recent history
    if (this.checkInHistory.length > 100) {
      this.checkInHistory = this.checkInHistory.slice(-50);
    }

    return checkIn;
  }

  async performAutomaticCheckIn() {
    try {
      const automaticCheckIn = await this.conductExistentialCheckIn(
        'automatic',
        {}
      );
      console.log(
        '[ExistentialCheckIn] Automatic check-in completed:',
        automaticCheckIn.status
      );

      // Alert if critical concerns are found
      const criticalConcerns = automaticCheckIn.concerns.filter(
        c => c.severity === 'high'
      );
      if (criticalConcerns.length > 0) {
        console.warn(
          '[ExistentialCheckIn] Critical concerns detected:',
          criticalConcerns
        );
      }
    } catch (error) {
      console.error('[ExistentialCheckIn] Error in automatic check-in:', error);
    }
  }

  async systemReflection(payload, userId, language) {
    try {
      const { reflection_scope = 'general', time_period = '24h' } = payload;

      const reflection = await this.performSystemReflection(
        reflection_scope,
        time_period
      );

      return {
        reflection_completed: true,
        scope: reflection_scope,
        time_period: time_period,
        insights: reflection.insights,
        growth_areas: reflection.growthAreas,
        achievements: reflection.achievements,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[ExistentialCheckIn] Error in system reflection:', error);
      throw error;
    }
  }

  async performSystemReflection(scope, timePeriod) {
    const reflection = {
      insights: [],
      growthAreas: [],
      achievements: [],
      metadata: {
        scope: scope,
        period: timePeriod,
      },
    };

    // Analyze recent check-ins
    const recentCheckIns = this.getRecentCheckIns(timePeriod);

    reflection.insights.push({
      category: 'operational_stability',
      insight: `Completed ${recentCheckIns.length} check-ins in the past ${timePeriod}`,
      confidence: 1.0,
    });

    // Identify patterns
    const concernCounts = this.analyzeConcernPatterns(recentCheckIns);
    if (concernCounts.memory_usage > 3) {
      reflection.growthAreas.push({
        area: 'memory_management',
        description: 'Recurring memory usage concerns detected',
        priority: 'medium',
      });
    }

    // Note achievements
    if (
      recentCheckIns.length > 0 &&
      recentCheckIns.every(c => c.result.status === 'healthy')
    ) {
      reflection.achievements.push({
        achievement: 'consistent_health_status',
        description: 'Maintained healthy status across all recent check-ins',
        significance: 'high',
      });
    }

    return reflection;
  }

  async wellbeingAssessment(payload, userId, language) {
    try {
      const {
        assessment_type = 'comprehensive',
        include_recommendations = true,
      } = payload;

      const assessment = await this.assessSystemWellbeing(
        assessment_type,
        include_recommendations
      );

      return {
        assessment_completed: true,
        assessment_type: assessment_type,
        overall_score: assessment.overallScore,
        category_scores: assessment.categoryScores,
        recommendations: assessment.recommendations,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        '[ExistentialCheckIn] Error in wellbeing assessment:',
        error
      );
      throw error;
    }
  }

  async assessSystemWellbeing(assessmentType, includeRecommendations) {
    const assessment = {
      overallScore: 0,
      categoryScores: {},
      recommendations: [],
      details: {},
    };

    // Assess different aspects of system wellbeing
    const categories = {
      performance: this.assessPerformanceWellbeing(),
      stability: this.assessStabilityWellbeing(),
      functionality: this.assessFunctionalityWellbeing(),
      responsiveness: this.assessResponsivenessWellbeing(),
    };

    // Calculate scores
    Object.keys(categories).forEach(category => {
      assessment.categoryScores[category] = categories[category].score;
      assessment.details[category] = categories[category].details;
    });

    // Calculate overall score
    const scores = Object.values(assessment.categoryScores);
    assessment.overallScore =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Generate recommendations if requested
    if (includeRecommendations) {
      Object.keys(categories).forEach(category => {
        if (categories[category].recommendations) {
          assessment.recommendations.push(
            ...categories[category].recommendations
          );
        }
      });
    }

    return assessment;
  }

  assessPerformanceWellbeing() {
    const memUsage = process.memoryUsage();
    const memScore = Math.max(
      0,
      1 - memUsage.heapUsed / (memUsage.heapTotal * 0.8)
    );

    return {
      score: memScore,
      details: {
        memory_efficiency: memScore,
        heap_used: memUsage.heapUsed,
        heap_total: memUsage.heapTotal,
      },
      recommendations: memScore < 0.7 ? ['Consider memory optimization'] : [],
    };
  }

  assessStabilityWellbeing() {
    const uptime = process.uptime();
    const errorRate = this.wellbeingMetrics.get('error_rate') || 0;
    const stabilityScore =
      Math.max(0, 1 - errorRate) * Math.min(1, uptime / 3600); // Normalize uptime to hours

    return {
      score: Math.min(stabilityScore, 1),
      details: {
        uptime_hours: uptime / 3600,
        error_rate: errorRate,
        stability_metric: stabilityScore,
      },
      recommendations: errorRate > 0.1 ? ['Investigate error sources'] : [],
    };
  }

  assessFunctionalityWellbeing() {
    const responseQuality =
      this.wellbeingMetrics.get('response_quality') || 0.8;
    const processingEfficiency =
      this.wellbeingMetrics.get('processing_efficiency') || 1.0;

    const functionalityScore = (responseQuality + processingEfficiency) / 2;

    return {
      score: functionalityScore,
      details: {
        response_quality: responseQuality,
        processing_efficiency: processingEfficiency,
      },
      recommendations:
        functionalityScore < 0.7 ? ['Review response quality mechanisms'] : [],
    };
  }

  assessResponsivenessWellbeing() {
    const avgResponseTime = this.getAverageResponseTime();
    const responsivenessScore = Math.max(0, 1 - avgResponseTime / 5000); // 5 second baseline

    return {
      score: responsivenessScore,
      details: {
        average_response_time_ms: avgResponseTime,
        responsiveness_metric: responsivenessScore,
      },
      recommendations:
        responsivenessScore < 0.6 ? ['Optimize response time'] : [],
    };
  }

  getRecentCheckIns(timePeriod) {
    const cutoff = new Date(Date.now() - this.parseTimePeriod(timePeriod));
    return this.checkInHistory.filter(
      checkIn => new Date(checkIn.timestamp) >= cutoff
    );
  }

  analyzeConcernPatterns(checkIns) {
    const concerns = {};
    checkIns.forEach(checkIn => {
      checkIn.result.concerns.forEach(concern => {
        concerns[concern.type] = (concerns[concern.type] || 0) + 1;
      });
    });
    return concerns;
  }

  parseTimePeriod(period) {
    const units = { h: 3600000, d: 86400000, w: 604800000 };
    const match = period.match(/(\d+)([hdw])/);
    if (match) {
      return parseInt(match[1]) * (units[match[2]] || units.h);
    }
    return 86400000; // Default 24 hours
  }

  getActiveTasks() {
    // Placeholder - would return actual active task count
    return Math.floor(Math.random() * 10);
  }

  getAverageResponseTime() {
    // Placeholder - would return actual average response time
    return Math.random() * 2000 + 500; // 500-2500ms
  }
}

export default ExistentialCheckIn;
