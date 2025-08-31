import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'apiKeys routes',
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

export default router;
