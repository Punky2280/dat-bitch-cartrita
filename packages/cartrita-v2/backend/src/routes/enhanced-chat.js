/**
 * Enhanced Chat API Routes
 * Modern ChatGPT/Claude-style chat system with MCP integration
 */

import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(path.dirname(path.dirname(__dirname)), 'uploads', 'chat-attachments');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow images, documents, code files
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'application/pdf', 'application/json',
      'text/javascript', 'text/typescript', 'text/python'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(txt|md|py|js|ts|json|pdf)$/)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  }
});

// Database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'dat-bitch-cartrita',
  user: process.env.POSTGRES_USER || 'robert',
  password: process.env.POSTGRES_PASSWORD || 'punky1',
});

// Python backend URL
const PYTHON_API_URL = process.env.PYTHON_SERVICE_URL || 'http://python-backend:8002';

/**
 * GET /api/v2/chat/sessions
 * Get all chat sessions for a user
 */
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.user?.id || 1; // Default user for now
    const { page = 1, limit = 20, status = 'active' } = req.query;
    
    const offset = (page - 1) * limit;
    
    const result = await pool.query(`
      SELECT 
        cs.*,
        COUNT(cm.id) as message_count,
        MAX(cm.created_at) as last_message_time
      FROM chat_sessions cs
      LEFT JOIN chat_messages cm ON cs.id = cm.session_id
      WHERE cs.user_id = $1 AND cs.status = $2
      GROUP BY cs.id
      ORDER BY cs.updated_at DESC
      LIMIT $3 OFFSET $4
    `, [userId, status, limit, offset]);
    
    // Get total count for pagination
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM chat_sessions WHERE user_id = $1 AND status = $2',
      [userId, status]
    );
    
    res.json({
      success: true,
      sessions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v2/chat/sessions
 * Create a new chat session
 */
router.post('/sessions', async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { 
      title = 'New Chat',
      agent_id = 'supervisor_cartrita_v2',
      session_type = 'chat',
      template_id = null,
      settings = {}
    } = req.body;
    
    let systemPrompt = null;
    let defaultSettings = settings;
    
    // If using a template, load its settings
    if (template_id) {
      const templateResult = await pool.query(
        'SELECT * FROM conversation_templates WHERE id = $1',
        [template_id]
      );
      
      if (templateResult.rows.length > 0) {
        const template = templateResult.rows[0];
        systemPrompt = template.system_prompt;
        defaultSettings = { ...template.default_settings, ...settings };
      }
    }
    
    const sessionId = uuidv4();
    
    // Create the session
    const result = await pool.query(`
      INSERT INTO chat_sessions (id, user_id, title, agent_id, session_type, settings)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [sessionId, userId, title, agent_id, session_type, JSON.stringify(defaultSettings)]);
    
    // Add system message if we have a template
    if (systemPrompt) {
      await pool.query(`
        INSERT INTO chat_messages (session_id, user_id, role, content, content_type, is_hidden)
        VALUES ($1, $2, 'system', $3, 'text', true)
      `, [sessionId, userId, systemPrompt]);
    }
    
    res.json({
      success: true,
      session: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2/chat/sessions/:sessionId/messages
 * Get messages for a specific chat session
 */
router.get('/sessions/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await pool.query(`
      SELECT 
        cm.*,
        array_agg(
          json_build_object(
            'id', cma.id,
            'file_name', cma.file_name,
            'file_type', cma.file_type,
            'file_size', cma.file_size,
            'width', cma.width,
            'height', cma.height
          )
        ) FILTER (WHERE cma.id IS NOT NULL) as attachments
      FROM chat_messages cm
      LEFT JOIN chat_message_attachments cma ON cm.id = cma.message_id
      WHERE cm.session_id = $1 AND cm.is_hidden = false
      GROUP BY cm.id
      ORDER BY cm.message_index ASC
      LIMIT $2 OFFSET $3
    `, [sessionId, limit, offset]);
    
    res.json({
      success: true,
      messages: result.rows,
      sessionId
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v2/chat/sessions/:sessionId/messages
 * Send a new message in a chat session
 */
router.post('/sessions/:sessionId/messages', upload.array('attachments', 5), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id || 1;
    const { content, regenerate = false, parent_message_id = null } = req.body;
    
    if (!content?.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }
    
    // Get session details
    const sessionResult = await pool.query(
      'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chat session not found' });
    }
    
    const session = sessionResult.rows[0];
    
    // Create user message
    const userMessageId = uuidv4();
    const userMessageResult = await pool.query(`
      INSERT INTO chat_messages (
        id, session_id, user_id, role, content, content_type,
        is_regenerated, parent_message_id
      )
      VALUES ($1, $2, $3, 'user', $4, 'text', $5, $6)
      RETURNING *
    `, [userMessageId, sessionId, userId, content, regenerate, parent_message_id]);
    
    const userMessage = userMessageResult.rows[0];
    
    // Handle file attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await pool.query(`
          INSERT INTO chat_message_attachments (
            message_id, file_name, file_path, file_type, file_size, mime_type
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          userMessageId,
          file.originalname,
          file.path,
          file.mimetype,
          file.size,
          file.mimetype
        ]);
      }
    }
    
    // Get conversation history for context
    const historyResult = await pool.query(`
      SELECT role, content, tools_used, tool_results
      FROM chat_messages 
      WHERE session_id = $1 AND is_hidden = false 
      ORDER BY message_index ASC
      LIMIT 20
    `, [sessionId]);
    
    // Prepare request for Python backend
    const pythonRequest = {
      message: content,
      user_id: userId.toString(),
      session_id: sessionId,
      priority: 'medium',
      preferred_agent: session.agent_id,
      context: {
        session_type: session.session_type,
        conversation_history: historyResult.rows.slice(-10), // Last 10 messages
        settings: session.settings || {},
        attachments: req.files ? req.files.map(f => ({
          name: f.originalname,
          type: f.mimetype,
          path: f.path
        })) : []
      }
    };
    
    // Start streaming response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    // Send user message immediately
    res.write(`data: ${JSON.stringify({
      type: 'user_message',
      message: userMessage,
      attachments: req.files ? req.files.map(f => ({
        name: f.originalname,
        type: f.mimetype,
        size: f.size
      })) : []
    })}\\n\\n`);
    
    const assistantMessageId = uuidv4();
    let fullResponse = '';
    let responseMetadata = {};
    
    try {
      // Call Python backend
      const response = await axios.post(`${PYTHON_API_URL}/api/v2/chat`, pythonRequest, {
        timeout: 60000 // 60 second timeout
      });
      
      if (response.data.success) {
        fullResponse = response.data.content;
        responseMetadata = {
          agent_id: response.data.agent_id,
          model_used: response.data.model_used || session.model_used,
          tools_used: response.data.tools_used || [],
          tool_calls: response.data.tool_calls || [],
          tool_results: response.data.tool_results || [],
          computer_actions: response.data.computer_actions || [],
          response_time_ms: response.data.execution_time_ms,
          iterations_completed: response.data.iterations_completed
        };
        
        // Send streaming response
        res.write(`data: ${JSON.stringify({
          type: 'assistant_message_start',
          messageId: assistantMessageId
        })}\\n\\n`);
        
        // Simulate streaming by sending chunks
        const words = fullResponse.split(' ');
        for (let i = 0; i < words.length; i += 3) {
          const chunk = words.slice(i, i + 3).join(' ');
          res.write(`data: ${JSON.stringify({
            type: 'assistant_message_chunk',
            messageId: assistantMessageId,
            chunk: chunk + ' '
          })}\\n\\n`);
          
          // Small delay to simulate real streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
      } else {
        fullResponse = `I apologize, but I encountered an error: ${response.data.error}`;
        responseMetadata = { error: response.data.error };
      }
      
    } catch (error) {
      console.error('Error calling Python backend:', error);
      fullResponse = 'I apologize, but I\'m having trouble processing your request right now. Please try again.';
      responseMetadata = { error: error.message };
    }
    
    // Save assistant message to database
    const assistantMessageResult = await pool.query(`
      INSERT INTO chat_messages (
        id, session_id, user_id, role, content, content_type,
        agent_id, model_used, tools_used, tool_calls, tool_results,
        computer_actions, response_time_ms, metadata, status
      )
      VALUES ($1, $2, $3, 'assistant', $4, 'markdown', $5, $6, $7, $8, $9, $10, $11, $12, 'completed')
      RETURNING *
    `, [
      assistantMessageId,
      sessionId,
      userId,
      fullResponse,
      responseMetadata.agent_id,
      responseMetadata.model_used,
      JSON.stringify(responseMetadata.tools_used || []),
      JSON.stringify(responseMetadata.tool_calls || []),
      JSON.stringify(responseMetadata.tool_results || []),
      JSON.stringify(responseMetadata.computer_actions || []),
      responseMetadata.response_time_ms,
      JSON.stringify(responseMetadata),
    ]);
    
    // Send final message
    res.write(`data: ${JSON.stringify({
      type: 'assistant_message_complete',
      message: assistantMessageResult.rows[0],
      metadata: responseMetadata
    })}\\n\\n`);
    
    res.write('data: [DONE]\\n\\n');
    res.end();
    
  } catch (error) {
    console.error('Error in chat message endpoint:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: error.message
    })}\\n\\n`);
    res.end();
  }
});

/**
 * PUT /api/v2/chat/sessions/:sessionId
 * Update chat session (title, settings, etc.)
 */
router.put('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id || 1;
    const { title, settings, status } = req.body;
    
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    if (title) {
      updateFields.push(`title = $${paramCount++}`);
      values.push(title);
    }
    
    if (settings) {
      updateFields.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(settings));
    }
    
    if (status) {
      updateFields.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(sessionId, userId);
    
    const result = await pool.query(`
      UPDATE chat_sessions 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND user_id = $${paramCount++}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chat session not found' });
    }
    
    res.json({
      success: true,
      session: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating chat session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v2/chat/sessions/:sessionId
 * Delete (archive) a chat session
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id || 1;
    
    const result = await pool.query(`
      UPDATE chat_sessions 
      SET status = 'deleted', updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [sessionId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chat session not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v2/chat/messages/:messageId/feedback
 * Provide feedback on a message
 */
router.post('/messages/:messageId/feedback', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id || 1;
    const { feedback_type, rating, comment } = req.body;
    
    const validFeedbackTypes = ['thumbs_up', 'thumbs_down', 'copy', 'regenerate', 'edit'];
    if (!validFeedbackTypes.includes(feedback_type)) {
      return res.status(400).json({ success: false, error: 'Invalid feedback type' });
    }
    
    const result = await pool.query(`
      INSERT INTO chat_message_feedback (message_id, user_id, feedback_type, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (message_id, user_id, feedback_type)
      DO UPDATE SET rating = $4, comment = $5, created_at = NOW()
      RETURNING *
    `, [messageId, userId, feedback_type, rating, comment]);
    
    res.json({
      success: true,
      feedback: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving message feedback:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2/chat/templates
 * Get conversation templates
 */
router.get('/templates', async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = 'SELECT * FROM conversation_templates WHERE is_public = true';
    const values = [];
    
    if (category) {
      query += ' AND category = $1';
      values.push(category);
    }
    
    query += ' ORDER BY usage_count DESC, name ASC';
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      templates: result.rows
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v2/chat/search
 * Search through chat messages
 */
router.get('/search', async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { q, session_id, limit = 20 } = req.query;
    
    if (!q?.trim()) {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }
    
    let query = `
      SELECT 
        cm.*,
        cs.title as session_title,
        ts_rank(to_tsvector('english', cm.content), plainto_tsquery('english', $1)) as rank
      FROM chat_messages cm
      JOIN chat_sessions cs ON cm.session_id = cs.id
      WHERE cm.user_id = $2 
      AND cs.status != 'deleted'
      AND to_tsvector('english', cm.content) @@ plainto_tsquery('english', $1)
    `;
    
    const values = [q, userId];
    let paramCount = 3;
    
    if (session_id) {
      query += ` AND cm.session_id = $${paramCount++}`;
      values.push(session_id);
    }
    
    query += ` ORDER BY rank DESC, cm.created_at DESC LIMIT $${paramCount}`;
    values.push(limit);
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      results: result.rows,
      query: q
    });
  } catch (error) {
    console.error('Error searching chat messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;