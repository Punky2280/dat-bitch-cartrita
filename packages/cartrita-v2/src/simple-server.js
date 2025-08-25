/**
 * Simple Cartrita V2 Server for Testing
 */

const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8001;

// Basic middleware
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Cartrita V2 - Simple Test Server',
        version: '2.0.0',
        status: 'active',
        timestamp: new Date().toISOString()
    });
});

// Health endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: '2.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Simple chat endpoint that simulates computer use
app.post('/api/chat', (req, res) => {
    const { message, user_id } = req.body;
    
    console.log(`💬 Chat request: ${message}`);
    
    // Simulate computer use response
    if (message && message.toLowerCase().includes('screenshot')) {
        res.json({
            success: true,
            content: 'I would take a screenshot now if OpenAI API was configured.',
            agent_id: 'computer_use_agent_v2',
            task_id: 'test_' + Date.now(),
            computer_actions: [
                {
                    action: 'screenshot',
                    success: true,
                    timestamp: new Date().toISOString()
                }
            ],
            timestamp: new Date().toISOString()
        });
    } else if (message && message.toLowerCase().includes('web search')) {
        res.json({
            success: true,
            content: 'I would perform a web search now if OpenAI API was configured.',
            agent_id: 'research_agent_v2',
            task_id: 'test_' + Date.now(),
            tools_used: ['web_search'],
            timestamp: new Date().toISOString()
        });
    } else {
        res.json({
            success: true,
            content: 'Simple test response. To enable full AI capabilities, configure OpenAI API key.',
            agent_id: 'supervisor_cartrita_v2',
            task_id: 'test_' + Date.now(),
            timestamp: new Date().toISOString()
        });
    }
});

// Computer use endpoint
app.post('/api/computer', (req, res) => {
    const { task_description } = req.body;
    
    console.log(`🖥️ Computer use request: ${task_description}`);
    
    res.json({
        success: true,
        content: 'Computer use simulation - would control desktop if OpenAI API was configured.',
        task_description,
        session_id: 'test_session_' + Date.now(),
        computer_actions: [
            {
                action: 'screenshot',
                success: true,
                timestamp: new Date().toISOString()
            }
        ],
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        available_endpoints: [
            'GET /',
            'GET /health',
            'POST /api/chat',
            'POST /api/computer'
        ]
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Cartrita V2 Simple Server running on port ${port}`);
    console.log(`🌐 Test endpoints:`);
    console.log(`   GET  http://localhost:${port}/`);
    console.log(`   GET  http://localhost:${port}/health`);
    console.log(`   POST http://localhost:${port}/api/chat`);
    console.log(`   POST http://localhost:${port}/api/computer`);
    console.log(`✅ Server ready for testing`);
});

module.exports = app;