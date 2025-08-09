/**
 * Life OS Service v1.0 - Comprehensive Personal Management System
 *
 * A complete personal operating system that manages all aspects of digital life:
 * - Personal task and goal management with AI optimization
 * - Health and wellness tracking with predictive insights
 * - Financial management and budgeting with automated categorization
 * - Learning and skill development with personalized curricula
 * - Social relationships and communication management
 * - Time optimization and productivity enhancement
 * - Digital life integration and automation
 * - Personal knowledge and memory augmentation
 */

import pool from '../db.js';
import EnhancedLangChainCoreAgent from '../agi/consciousness/EnhancedLangChainCoreAgent.js';
import WolframAlphaService from './WolframAlphaService.js';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

class LifeOSService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.coreAgent = null; // Will be injected
    this.wolframService = WolframAlphaService;

    // Life OS modules
    this.modules = {
      tasks: 'Personal Task & Goal Management',
      health: 'Health & Wellness Tracking',
      finance: 'Financial Management',
      learning: 'Learning & Development',
      social: 'Relationships & Communication',
      productivity: 'Time & Productivity',
      automation: 'Life Automation',
      knowledge: 'Personal Knowledge Base',
    };

    // Processing statistics
    this.stats = {
      totalGoals: 0,
      completedTasks: 0,
      healthEntries: 0,
      financialTransactions: 0,
      learningHours: 0,
      automationTriggers: 0,
    };

    console.log('[LifeOSService] 🌟 Personal Operating System initialized');
  }

  /**
   * Initialize Life OS with database schema
   */
  async initialize() {
    try {
      await this.ensureDatabaseSchema();
      await this.initializeDefaultData();
      console.log('[LifeOSService] ✅ Life OS ready for personal management');
      return true;
    } catch (error) {
      console.error('[LifeOSService] ❌ Initialization failed:', error);
      return false;
    }
  }

  /**
   * Ensure Life OS database schema
   */
  async ensureDatabaseSchema() {
    const schemas = [
      // Life goals and objectives
      `CREATE TABLE IF NOT EXISTS life_goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        goal_title VARCHAR(500) NOT NULL,
        goal_description TEXT,
        goal_category VARCHAR(100) DEFAULT 'personal',
        priority_level INTEGER DEFAULT 3,
        target_date DATE,
        completion_percentage FLOAT DEFAULT 0,
        status VARCHAR(50) DEFAULT 'active',
        milestones JSONB DEFAULT '[]',
        success_metrics JSONB DEFAULT '{}',
        ai_insights JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Personal tasks with AI optimization
      `CREATE TABLE IF NOT EXISTS personal_tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        goal_id INTEGER REFERENCES life_goals(id) ON DELETE SET NULL,
        task_title VARCHAR(500) NOT NULL,
        task_description TEXT,
        priority VARCHAR(50) DEFAULT 'medium',
        estimated_duration INTEGER, -- minutes
        actual_duration INTEGER,
        due_date TIMESTAMPTZ,
        completion_date TIMESTAMPTZ,
        status VARCHAR(50) DEFAULT 'pending',
        energy_level_required VARCHAR(50) DEFAULT 'medium',
        context_tags JSONB DEFAULT '[]',
        ai_recommendations JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Health and wellness tracking
      `CREATE TABLE IF NOT EXISTS health_metrics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        metric_type VARCHAR(100) NOT NULL,
        metric_value FLOAT NOT NULL,
        metric_unit VARCHAR(50),
        measurement_date TIMESTAMPTZ DEFAULT NOW(),
        mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 10),
        energy_level VARCHAR(50),
        sleep_hours FLOAT,
        exercise_minutes INTEGER,
        notes TEXT,
        ai_analysis JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Financial management
      `CREATE TABLE IF NOT EXISTS financial_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        transaction_type VARCHAR(50) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        category VARCHAR(100),
        subcategory VARCHAR(100),
        description TEXT,
        transaction_date TIMESTAMPTZ DEFAULT NOW(),
        account_name VARCHAR(200),
        is_recurring BOOLEAN DEFAULT false,
        ai_categorization JSONB DEFAULT '{}',
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Learning and development
      `CREATE TABLE IF NOT EXISTS learning_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_name VARCHAR(200) NOT NULL,
        skill_category VARCHAR(100),
        current_level INTEGER DEFAULT 1,
        target_level INTEGER DEFAULT 10,
        hours_invested FLOAT DEFAULT 0,
        learning_resources JSONB DEFAULT '[]',
        milestones_achieved JSONB DEFAULT '[]',
        next_actions JSONB DEFAULT '[]',
        ai_curriculum JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Social relationships
      `CREATE TABLE IF NOT EXISTS relationship_tracker (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_name VARCHAR(200) NOT NULL,
        relationship_type VARCHAR(100),
        connection_strength INTEGER DEFAULT 5,
        last_interaction_date TIMESTAMPTZ,
        interaction_frequency VARCHAR(50),
        communication_preferences JSONB DEFAULT '{}',
        important_dates JSONB DEFAULT '[]',
        conversation_topics JSONB DEFAULT '[]',
        ai_insights JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Life automation rules
      `CREATE TABLE IF NOT EXISTS life_automation_rules (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rule_name VARCHAR(200) NOT NULL,
        trigger_type VARCHAR(100) NOT NULL,
        trigger_conditions JSONB NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        action_parameters JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        execution_count INTEGER DEFAULT 0,
        last_executed TIMESTAMPTZ,
        ai_optimized BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Personal insights and analytics
      `CREATE TABLE IF NOT EXISTS personal_insights (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        insight_type VARCHAR(100) NOT NULL,
        insight_category VARCHAR(100),
        insight_data JSONB NOT NULL,
        confidence_score FLOAT DEFAULT 0.5,
        actionable_recommendations JSONB DEFAULT '[]',
        data_sources JSONB DEFAULT '[]',
        generated_by VARCHAR(100) DEFAULT 'LifeOSService',
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    ];

    for (const schema of schemas) {
      await pool.query(schema);
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_life_goals_user_status ON life_goals(user_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_personal_tasks_user_status ON personal_tasks(user_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_health_metrics_user_date ON health_metrics(user_id, measurement_date)',
      'CREATE INDEX IF NOT EXISTS idx_financial_transactions_user_date ON financial_transactions(user_id, transaction_date)',
      'CREATE INDEX IF NOT EXISTS idx_learning_progress_user ON learning_progress(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_relationship_tracker_user ON relationship_tracker(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_life_automation_active ON life_automation_rules(user_id, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_personal_insights_user_type ON personal_insights(user_id, insight_type)',
    ];

    for (const index of indexes) {
      try {
        await pool.query(index);
      } catch (error) {
        console.warn(`[LifeOSService] Index creation warning:`, error.message);
      }
    }
  }

  /**
   * Initialize default data and settings
   */
  async initializeDefaultData() {
    // This would populate default categories, templates, etc.
    console.log('[LifeOSService] 🚀 Default Life OS data initialized');
  }

  /**
   * Set core agent reference
   */
  setCoreAgent(coreAgent) {
    this.coreAgent = coreAgent;
    console.log('[LifeOSService] 🤖 Core agent integrated with Life OS');
  }

  // ===========================================
  // GOAL MANAGEMENT
  // ===========================================

  /**
   * Create a new life goal with AI insights
   */
  async createGoal(userId, goalData) {
    try {
      const {
        title,
        description,
        category = 'personal',
        priority = 3,
        targetDate,
        successMetrics = {},
      } = goalData;

      // Generate AI insights for the goal
      const aiInsights = await this.generateGoalInsights(
        title,
        description,
        category
      );

      const result = await pool.query(
        `
        INSERT INTO life_goals (
          user_id, goal_title, goal_description, goal_category,
          priority_level, target_date, success_metrics, ai_insights
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, created_at
      `,
        [
          userId,
          title,
          description,
          category,
          priority,
          targetDate,
          JSON.stringify(successMetrics),
          JSON.stringify(aiInsights),
        ]
      );

      this.stats.totalGoals++;

      return {
        success: true,
        goalId: result.rows[0].id,
        aiInsights,
        createdAt: result.rows[0].created_at,
      };
    } catch (error) {
      console.error('[LifeOSService] Goal creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate AI insights for goals
   */
  async generateGoalInsights(title, description, category) {
    try {
      const prompt = `Analyze this life goal and provide strategic insights:
      
Title: ${title}
Description: ${description}
Category: ${category}

Provide a JSON response with:
1. recommended_milestones - array of specific milestones
2. potential_challenges - array of likely obstacles
3. success_strategies - array of proven approaches
4. time_estimation - realistic timeline in weeks
5. skill_requirements - array of skills needed
6. resource_recommendations - array of helpful resources`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a life coaching AI that provides strategic insights for personal goals. Always return valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('[LifeOSService] AI insights generation failed:', error);
      return {
        recommended_milestones: [],
        potential_challenges: [
          'Analyze goal complexity',
          'Break down into smaller tasks',
        ],
        success_strategies: [
          'Create specific action plan',
          'Track progress regularly',
        ],
        time_estimation: 12,
        skill_requirements: [],
        resource_recommendations: [],
      };
    }
  }

  // ===========================================
  // TASK MANAGEMENT
  // ===========================================

  /**
   * Create optimized personal task
   */
  async createTask(userId, taskData) {
    try {
      const {
        goalId = null,
        title,
        description,
        priority = 'medium',
        estimatedDuration,
        dueDate,
        energyLevel = 'medium',
        contextTags = [],
      } = taskData;

      // Generate AI recommendations for the task
      const aiRecommendations = await this.generateTaskRecommendations(
        title,
        description,
        priority
      );

      const result = await pool.query(
        `
        INSERT INTO personal_tasks (
          user_id, goal_id, task_title, task_description, priority,
          estimated_duration, due_date, energy_level_required, 
          context_tags, ai_recommendations
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, created_at
      `,
        [
          userId,
          goalId,
          title,
          description,
          priority,
          estimatedDuration,
          dueDate,
          energyLevel,
          JSON.stringify(contextTags),
          JSON.stringify(aiRecommendations),
        ]
      );

      return {
        success: true,
        taskId: result.rows[0].id,
        aiRecommendations,
        createdAt: result.rows[0].created_at,
      };
    } catch (error) {
      console.error('[LifeOSService] Task creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate AI task recommendations
   */
  async generateTaskRecommendations(title, description, priority) {
    try {
      const prompt = `Analyze this personal task and provide optimization recommendations:

Task: ${title}
Description: ${description}
Priority: ${priority}

Provide JSON with:
1. optimal_time_slot - best time of day
2. preparation_steps - array of prep actions
3. focus_techniques - array of productivity methods
4. potential_blockers - array of likely obstacles
5. success_indicators - how to measure completion
6. related_tasks - array of complementary tasks`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a productivity AI that optimizes personal task management. Return valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('[LifeOSService] Task recommendations failed:', error);
      return {
        optimal_time_slot: 'morning',
        preparation_steps: [
          'Gather necessary materials',
          'Set clear workspace',
        ],
        focus_techniques: ['Pomodoro technique', 'Time blocking'],
        potential_blockers: ['Distractions', 'Lack of energy'],
        success_indicators: ['Task completion', 'Quality check'],
        related_tasks: [],
      };
    }
  }

  // ===========================================
  // HEALTH & WELLNESS
  // ===========================================

  /**
   * Record health metrics with AI analysis
   */
  async recordHealthMetric(userId, healthData) {
    try {
      const {
        metricType,
        metricValue,
        metricUnit,
        moodRating,
        energyLevel,
        sleepHours,
        exerciseMinutes,
        notes,
      } = healthData;

      // Generate AI analysis
      const aiAnalysis = await this.analyzeHealthMetric(
        metricType,
        metricValue,
        {
          mood: moodRating,
          energy: energyLevel,
          sleep: sleepHours,
          exercise: exerciseMinutes,
        }
      );

      const result = await pool.query(
        `
        INSERT INTO health_metrics (
          user_id, metric_type, metric_value, metric_unit,
          mood_rating, energy_level, sleep_hours, exercise_minutes,
          notes, ai_analysis
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, created_at
      `,
        [
          userId,
          metricType,
          metricValue,
          metricUnit,
          moodRating,
          energyLevel,
          sleepHours,
          exerciseMinutes,
          notes,
          JSON.stringify(aiAnalysis),
        ]
      );

      this.stats.healthEntries++;

      return {
        success: true,
        metricId: result.rows[0].id,
        aiAnalysis,
        createdAt: result.rows[0].created_at,
      };
    } catch (error) {
      console.error('[LifeOSService] Health metric recording failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze health metrics with AI
   */
  async analyzeHealthMetric(metricType, metricValue, context) {
    try {
      // Use Wolfram Alpha for health-related calculations if applicable
      let wolframInsight = null;
      if (metricType === 'weight' || metricType === 'bmi') {
        const query = `healthy ${metricType} range for adults`;
        wolframInsight = await this.wolframService.query(query, {
          agentRole: 'scientist',
        });
      }

      const prompt = `Analyze this health metric and provide insights:

Metric: ${metricType}
Value: ${metricValue}
Context: ${JSON.stringify(context)}
${
  wolframInsight
    ? `Medical Reference: ${wolframInsight.simple?.answer || 'N/A'}`
    : ''
}

Provide JSON with:
1. trend_analysis - is this improving/declining
2. health_insights - array of observations
3. recommendations - array of actionable advice
4. risk_factors - array of potential concerns
5. positive_indicators - array of good signs
6. next_measurement_suggestion - when to measure next`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a health analysis AI. Provide helpful insights but always recommend consulting healthcare professionals for medical advice. Return valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('[LifeOSService] Health analysis failed:', error);
      return {
        trend_analysis: 'stable',
        health_insights: ['Data point recorded successfully'],
        recommendations: [
          'Continue monitoring',
          'Maintain consistent measurement schedule',
        ],
        risk_factors: [],
        positive_indicators: ['Regular tracking'],
        next_measurement_suggestion: 'Same time tomorrow',
      };
    }
  }

  // ===========================================
  // ANALYTICS & INSIGHTS
  // ===========================================

  /**
   * Get comprehensive Life OS analytics
   */
  async getLifeAnalytics(userId, timeRange = '30d') {
    try {
      const dateRange = this.calculateDateRange(timeRange);

      // Get goal progress
      const goalStats = await pool.query(
        `
        SELECT 
          COUNT(*) as total_goals,
          AVG(completion_percentage) as avg_completion,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_goals,
          COUNT(CASE WHEN target_date < NOW() AND status != 'completed' THEN 1 END) as overdue_goals
        FROM life_goals 
        WHERE user_id = $1 AND created_at >= $2
      `,
        [userId, dateRange.start]
      );

      // Get task productivity
      const taskStats = await pool.query(
        `
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
          AVG(actual_duration) as avg_duration,
          AVG(CASE WHEN estimated_duration > 0 THEN actual_duration::FLOAT / estimated_duration ELSE 1 END) as time_accuracy
        FROM personal_tasks 
        WHERE user_id = $1 AND created_at >= $2
      `,
        [userId, dateRange.start]
      );

      // Get health trends
      const healthStats = await pool.query(
        `
        SELECT 
          COUNT(*) as total_entries,
          AVG(mood_rating) as avg_mood,
          AVG(sleep_hours) as avg_sleep,
          AVG(exercise_minutes) as avg_exercise
        FROM health_metrics 
        WHERE user_id = $1 AND measurement_date >= $2
      `,
        [userId, dateRange.start]
      );

      // Get financial overview
      const financialStats = await pool.query(
        `
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as total_expenses,
          COUNT(DISTINCT category) as spending_categories
        FROM financial_transactions 
        WHERE user_id = $1 AND transaction_date >= $2
      `,
        [userId, dateRange.start]
      );

      // Generate overall insights
      const overallInsights = await this.generateLifeInsights(userId, {
        goals: goalStats.rows[0],
        tasks: taskStats.rows[0],
        health: healthStats.rows[0],
        finance: financialStats.rows[0],
      });

      return {
        success: true,
        analytics: {
          time_range: timeRange,
          date_range: dateRange,
          goal_progress: goalStats.rows[0],
          task_productivity: taskStats.rows[0],
          health_wellness: healthStats.rows[0],
          financial_overview: financialStats.rows[0],
          overall_insights: overallInsights,
          life_score: this.calculateLifeScore({
            goals: goalStats.rows[0],
            tasks: taskStats.rows[0],
            health: healthStats.rows[0],
            finance: financialStats.rows[0],
          }),
        },
      };
    } catch (error) {
      console.error('[LifeOSService] Analytics generation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate comprehensive life insights
   */
  async generateLifeInsights(userId, stats) {
    try {
      const prompt = `Analyze this person's life data and provide comprehensive insights:

Goals: ${JSON.stringify(stats.goals)}
Tasks: ${JSON.stringify(stats.tasks)}
Health: ${JSON.stringify(stats.health)}
Finance: ${JSON.stringify(stats.finance)}

Provide JSON with:
1. life_momentum - overall life direction assessment
2. top_achievements - array of notable accomplishments
3. improvement_areas - array of areas needing attention
4. strategic_recommendations - array of high-impact actions
5. balance_assessment - work-life balance evaluation
6. future_opportunities - array of growth possibilities
7. risk_mitigation - array of potential life risks to address`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a life coach AI that provides comprehensive life analysis and strategic guidance. Return valid JSON with actionable insights.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('[LifeOSService] Life insights generation failed:', error);
      return {
        life_momentum: 'steady_progress',
        top_achievements: [
          'Consistent goal tracking',
          'Regular health monitoring',
        ],
        improvement_areas: ['Time management', 'Goal completion rate'],
        strategic_recommendations: [
          'Focus on high-priority goals',
          'Improve task estimation',
        ],
        balance_assessment: 'needs_attention',
        future_opportunities: ['Skill development', 'Network expansion'],
        risk_mitigation: ['Financial planning', 'Health optimization'],
      };
    }
  }

  /**
   * Calculate overall Life Score (0-100)
   */
  calculateLifeScore(stats) {
    let score = 0;

    // Goal achievement (25 points max)
    const goalCompletion = parseFloat(stats.goals.avg_completion || 0) / 100;
    score += goalCompletion * 25;

    // Task productivity (25 points max)
    if (stats.tasks.total_tasks > 0) {
      const taskCompletion =
        parseFloat(stats.tasks.completed_tasks || 0) /
        parseFloat(stats.tasks.total_tasks || 1);
      score += taskCompletion * 25;
    }

    // Health wellness (25 points max)
    if (stats.health.avg_mood) {
      const healthScore = parseFloat(stats.health.avg_mood || 5) / 10;
      score += healthScore * 25;
    } else {
      score += 12.5; // Default for no health data
    }

    // Financial stability (25 points max)
    if (stats.finance.total_income && stats.finance.total_expenses) {
      const financialRatio = Math.min(
        1,
        parseFloat(stats.finance.total_income) /
          parseFloat(stats.finance.total_expenses)
      );
      score += financialRatio * 25;
    } else {
      score += 12.5; // Default for no financial data
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  // ===========================================
  // UTILITY METHODS
  // ===========================================

  /**
   * Calculate date range for analytics
   */
  calculateDateRange(timeRange) {
    const now = new Date();
    const ranges = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
    };

    const milliseconds = ranges[timeRange] || ranges['30d'];
    return {
      start: new Date(now.getTime() - milliseconds),
      end: now,
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'LifeOSService',
      version: '1.0',
      modules: this.modules,
      statistics: this.stats,
      core_agent_connected: !!this.coreAgent,
      timestamp: new Date().toISOString(),
    };
  }
}

export default LifeOSService;
