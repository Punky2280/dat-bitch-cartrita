const express = require('express');
const router = express.Router();
// Import the unified core agent
const coreAgent = require('../agi/consciousness/CoreAgent');

// Inject live Socket.IO instance
let io;
function injectIO(socketServer) {
  io = socketServer;
}

router.post('/message', async (req, res) => {
  const { user, message } = req.body;
  const lang = 'en';

  try {
    // Ensure agent is initialized
    if (!coreAgent.initialized) {
      await coreAgent.initialize();
    }
    const agentRes = await coreAgent.generateResponse(message, lang, user);

    // If a socket server is available, try to push the message directly
    if (io) {
      const sockets = await io.of('/').fetchSockets();
      const userSocket = sockets.find(s => s.user?.userId === user);

      if (userSocket) {
        userSocket.emit('chat message', {
          text: agentRes.text,
          model: agentRes.model,
          timestamp: Date.now(),
        });
      }
    }

    // Always return the HTTP response
    res.json({
      reply: agentRes.text,
      status: 'ok',
      model: agentRes.model,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.error(`[AgentRoute Error]`, e);
    res.status(500).json({
      reply: `Cartrita's having a moment... try again later.`,
      status: 'error',
      fallback: true,
      timestamp: Date.now(),
    });
  }
});

module.exports = { router, injectIO };