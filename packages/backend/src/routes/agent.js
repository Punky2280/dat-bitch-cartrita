const express = require('express');
const router = express.Router();
const EnhancedCoreAgent = require('../agi/consciousness/EnhancedCoreAgent');
const coreAgent = new EnhancedCoreAgent();

// Inject live Socket.IO instance
let io;
function injectIO(socketServer) {
  io = socketServer;
}

router.post('/message', async (req, res) => {
  const { user, message } = req.body;
  const lang = 'en';

  try {
    const agentRes = await coreAgent.generateResponse(message, lang, user);

    if (io) {
      const sockets = await io.of('/').fetchSockets();
      const userSocket = sockets.find(s => s.user?.userId === user); // ✅ Match on userId

      if (userSocket) {
        userSocket.emit('chat message', {
          text: agentRes.text,
          model: agentRes.model,
          timestamp: Date.now(),
        });
      }
    }

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
