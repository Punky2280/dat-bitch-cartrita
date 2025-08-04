import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  const routeName = req.originalUrl.split('/')[2] || 'unknown';
  res.json({
    message: `${routeName} routes`,
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

export default router;
