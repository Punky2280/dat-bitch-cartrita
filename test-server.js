import express from 'express';
import http from 'http';

console.log('Testing basic Express server setup...');

const app = express();
const server = http.createServer(app);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.json({ message: 'Test server is running' });
});

const PORT = 8003;

server.listen(PORT, () => {
    console.log(`✅ Test server is live on port ${PORT}`);
    console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
    console.error('❌ Server error:', err);
});

console.log('Starting test server...');