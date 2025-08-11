/* Backend bootstrap server: mounts all API routes and middleware */
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import './db.js';

// Route imports
import chatHistoryRoutes from './routes/chatHistory.js';
import workflowsRoutes from './routes/workflows.js';
import personalLifeOSRoutes from './routes/personalLifeOS.js';
import voiceToTextRoutes from './routes/voiceToText.js';
import registryStatusRoutes from './routes/registryStatus.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(morgan('dev'));

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Mount routes under /api
app.use('/api/chat', chatHistoryRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/personal-life-os', personalLifeOSRoutes);
app.use('/api/voice', voiceToTextRoutes);
app.use('/api/internal/registry', registryStatusRoutes);

// Models catalog stub
app.get('/api/models/catalog', (req, res) => {
  res.json({ success: true, models: [], timestamp: new Date().toISOString() });
});

// Knowledge stubs
app.get('/api/knowledge/entries', (req, res) => {
  res.json({ success: true, entries: [], pagination: { total: 0 } });
});
app.get('/api/knowledge/graph', (req, res) => {
  res.json({ success: true, nodes: [], edges: [] });
});
app.get('/api/knowledge/clusters', (req, res) => {
  res.json({ success: true, clusters: [] });
});

// Ambient voice stubs
app.post('/api/voice/ambient/start', (req, res) => {
  res.json({ success: true, session_id: 'ambient-mock', status: 'started' });
});
app.post('/api/voice/ambient/stop', (req, res) => {
  res.json({ success: true, session_id: 'ambient-mock', status: 'stopped' });
});
app.get('/api/voice/ambient/status', (req, res) => {
  res.json({ success: true, session_id: 'ambient-mock', status: 'idle' });
});

// Vision analyze stub
app.post('/api/vision/analyze', (req, res) => {
  res.json({ success: true, analyses: [] });
});

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found', path: req.originalUrl });
});

let server = null;
let io = null;
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  const port = process.env.PORT || 8001;
  server = http.createServer(app);
  io = new SocketIOServer(server, { cors: { origin: '*'} });
  io.on('connection', socket => {
    socket.emit('connected', { socketId: socket.id });
    socket.on('disconnect', () => {});
  });
  server.listen(port, () => {
    console.log(`[server] Listening on port ${port}`);
  });
}

export default app;
