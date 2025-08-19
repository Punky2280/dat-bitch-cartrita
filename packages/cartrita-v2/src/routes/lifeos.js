import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import LifeOSService from '../services/LifeOSService.js';
import pool from '../db.js';

const router = express.Router();

// Initialize Life OS Service
const lifeOS = new LifeOSService();
lifeOS.initialize().then(success => {
  if (success) {
    console.log('[LifeOS] ✅ Life Operating System ready');
  } else {
    console.error('[LifeOS] ❌ Life OS initialization failed');
  }
});

/**
 * @swagger
 * /api/lifeos/dashboard:
 *   get:
 *     summary: Get Life OS dashboard overview
 *     tags: [LifeOS]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const analytics = await lifeOS.getLifeAnalytics(userId, '7d');

    if (analytics.success) {
      res.json({
        success: true,
        dashboard: {
          life_score: analytics.analytics.life_score,
          quick_stats: {
            active_goals: analytics.analytics.goal_progress.total_goals,
            pending_tasks:
              analytics.analytics.task_productivity.total_tasks -
              analytics.analytics.task_productivity.completed_tasks,
            health_entries: analytics.analytics.health_wellness.total_entries,
            financial_health:
              analytics.analytics.financial_overview.total_income >
              analytics.analytics.financial_overview.total_expenses
                ? 'positive'
                : 'needs_attention',
          },
          insights: analytics.analytics.overall_insights,
          modules_status: lifeOS.getStatus().modules,
        },
      });
    } else {
      throw new Error(analytics.error);
    }
  } catch (error) {
    console.error('[LifeOS] Dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// GOALS MANAGEMENT
// ===========================================

/**
 * @swagger
 * /api/lifeos/goals:
 *   get:
 *     summary: Get user's life goals
 *     tags: [LifeOS]
 *     security:
 *       - bearerAuth: []
 */
router.get('/goals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, status = 'active' } = req.query;

    let query = `
      SELECT * FROM life_goals 
      WHERE user_id = $1 AND status = $2
    `;
    const params = [userId, status];

    if (category) {
      query += ` AND goal_category = $3`;
      params.push(category);
    }

    query += ` ORDER BY priority_level DESC, created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      goals: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[LifeOS] Goals fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/lifeos/goals:
 *   post:
 *     summary: Create a new life goal
 *     tags: [LifeOS]
 *     security:
 *       - bearerAuth: []
 */
router.post('/goals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const goalData = req.body;

    const result = await lifeOS.createGoal(userId, goalData);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Life goal created successfully',
        goal_id: result.goalId,
        ai_insights: result.aiInsights,
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[LifeOS] Goal creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// TASK MANAGEMENT
// ===========================================

/**
 * @swagger
 * /api/lifeos/tasks:
 *   get:
 *     summary: Get user's tasks
 *     tags: [LifeOS]
 */
router.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'pending', priority, goal_id } = req.query;

    let query = `
      SELECT pt.*, lg.goal_title 
      FROM personal_tasks pt
      LEFT JOIN life_goals lg ON pt.goal_id = lg.id
      WHERE pt.user_id = $1
    `;
    const params = [userId];
    let paramCount = 1;

    if (status !== 'all') {
      paramCount++;
      query += ` AND pt.status = $${paramCount}`;
      params.push(status);
    }

    if (priority) {
      paramCount++;
      query += ` AND pt.priority = $${paramCount}`;
      params.push(priority);
    }

    if (goal_id) {
      paramCount++;
      query += ` AND pt.goal_id = $${paramCount}`;
      params.push(goal_id);
    }

    query += ` ORDER BY 
      CASE pt.priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END, pt.created_at DESC
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      tasks: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[LifeOS] Tasks fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/lifeos/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [LifeOS]
 */
router.post('/tasks', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskData = req.body;

    const result = await lifeOS.createTask(userId, taskData);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        task_id: result.taskId,
        ai_recommendations: result.aiRecommendations,
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[LifeOS] Task creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// HEALTH & WELLNESS
// ===========================================

/**
 * @swagger
 * /api/lifeos/health:
 *   get:
 *     summary: Get health metrics
 *     tags: [LifeOS]
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { metric_type, days = 30 } = req.query;

    let query = `
      SELECT * FROM health_metrics 
      WHERE user_id = $1 
        AND measurement_date >= NOW() - INTERVAL '${days} days'
    `;
    const params = [userId];

    if (metric_type) {
      query += ` AND metric_type = $2`;
      params.push(metric_type);
    }

    query += ` ORDER BY measurement_date DESC`;

    const result = await pool.query(query, params);

    // Calculate trends
    const trends = {};
    if (result.rows.length > 1) {
      const metricTypes = [...new Set(result.rows.map(row => row.metric_type))];

      for (const type of metricTypes) {
        const typeRows = result.rows.filter(row => row.metric_type === type);
        if (typeRows.length > 1) {
          const latest = typeRows[0].metric_value;
          const previous = typeRows[1].metric_value;
          trends[type] = {
            direction:
              latest > previous ? 'up' : latest < previous ? 'down' : 'stable',
            change_percentage: (((latest - previous) / previous) * 100).toFixed(
              1
            ),
          };
        }
      }
    }

    res.json({
      success: true,
      health_data: result.rows,
      trends,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[LifeOS] Health fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/lifeos/health:
 *   post:
 *     summary: Record health metric
 *     tags: [LifeOS]
 */
router.post('/health', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const healthData = req.body;

    const result = await lifeOS.recordHealthMetric(userId, healthData);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'Health metric recorded successfully',
        metric_id: result.metricId,
        ai_analysis: result.aiAnalysis,
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[LifeOS] Health recording error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// FINANCIAL MANAGEMENT
// ===========================================

/**
 * @swagger
 * /api/lifeos/finance:
 *   get:
 *     summary: Get financial overview
 *     tags: [LifeOS]
 */
router.get('/finance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, days = 30, transaction_type } = req.query;

    let query = `
      SELECT * FROM financial_transactions 
      WHERE user_id = $1 
        AND transaction_date >= NOW() - INTERVAL '${days} days'
    `;
    const params = [userId];
    let paramCount = 1;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (transaction_type) {
      paramCount++;
      query += ` AND transaction_type = $${paramCount}`;
      params.push(transaction_type);
    }

    query += ` ORDER BY transaction_date DESC`;

    const result = await pool.query(query, params);

    // Calculate financial summary
    const summary = {
      total_income: 0,
      total_expenses: 0,
      transaction_count: result.rows.length,
      categories: {},
    };

    result.rows.forEach(transaction => {
      if (transaction.transaction_type === 'income') {
        summary.total_income += parseFloat(transaction.amount);
      } else {
        summary.total_expenses += parseFloat(transaction.amount);
      }

      if (!summary.categories[transaction.category]) {
        summary.categories[transaction.category] = 0;
      }
      summary.categories[transaction.category] += parseFloat(
        transaction.amount
      );
    });

    summary.net_income = summary.total_income - summary.total_expenses;

    res.json({
      success: true,
      transactions: result.rows,
      summary,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[LifeOS] Finance fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/lifeos/finance:
 *   post:
 *     summary: Add financial transaction
 *     tags: [LifeOS]
 */
router.post('/finance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      transaction_type,
      amount,
      currency = 'USD',
      category,
      subcategory,
      description,
      account_name,
      is_recurring = false,
    } = req.body;

    if (!transaction_type || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Transaction type and amount are required',
      });
    }

    // Basic AI categorization (simplified)
    let aiCategorization = { suggested_category: category };
    if (!category && description) {
      // Simple keyword-based categorization
      const keywords = description.toLowerCase();
      if (keywords.includes('food') || keywords.includes('restaurant')) {
        aiCategorization.suggested_category = 'food_dining';
      } else if (keywords.includes('gas') || keywords.includes('fuel')) {
        aiCategorization.suggested_category = 'transportation';
      } else if (keywords.includes('salary') || keywords.includes('wage')) {
        aiCategorization.suggested_category = 'salary';
      }
    }

    const result = await pool.query(
      `
      INSERT INTO financial_transactions (
        user_id, transaction_type, amount, currency, category, subcategory,
        description, account_name, is_recurring, ai_categorization
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, created_at
    `,
      [
        userId,
        transaction_type,
        amount,
        currency,
        aiCategorization.suggested_category || category,
        subcategory,
        description,
        account_name,
        is_recurring,
        JSON.stringify(aiCategorization),
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Financial transaction recorded successfully',
      transaction_id: result.rows[0].id,
      ai_categorization: aiCategorization,
    });
  } catch (error) {
    console.error('[LifeOS] Finance recording error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================
// ANALYTICS
// ===========================================

/**
 * @swagger
 * /api/lifeos/analytics:
 *   get:
 *     summary: Get comprehensive life analytics
 *     tags: [LifeOS]
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { time_range = '30d' } = req.query;

    const analytics = await lifeOS.getLifeAnalytics(userId, time_range);

    if (analytics.success) {
      res.json(analytics);
    } else {
      res.status(500).json(analytics);
    }
  } catch (error) {
    console.error('[LifeOS] Analytics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/lifeos/status:
 *   get:
 *     summary: Get Life OS status
 *     tags: [LifeOS]
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = lifeOS.getStatus();
    res.json({ success: true, status });
  } catch (error) {
    console.error('[LifeOS] Status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
