/* eslint-env node */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as Client } from 'socket.io-client';
import http from 'http';

// Import server entry (it starts automatically). We'll wrap to allow closing.
import appServerModule from '../index.js';

// The index exports nothing; we need to access the created server.
// Refactor would export server/app; for now we spin a second minimal express? Placeholder skip if unavailable.

let token;
let socket;

// Skip test if no DATABASE_URL (CI safety)
const hasDb = !!process.env.DATABASE_URL;

// Helper to login or register a test user idempotently.
async function login() {
  const base = 'http://localhost:8001';
  const creds = { email: 'robert@example.com', password: 'password123', username: 'robert' };
  // Attempt login first
  let res = await request(base).post('/api/auth/login').send(creds);
  if (res.status === 200 && res.body?.token) return res.body.token;
  // If invalid credentials, try registration then login again
  if (res.status === 401) {
    await request(base).post('/api/auth/register').send(creds);
    res = await request(base).post('/api/auth/login').send(creds);
    if (res.status === 200 && res.body?.token) return res.body.token;
  }
  // Fallback: return undefined so test soft-skips
  return undefined;
}

describe('Auth + Socket integration', () => {
  beforeAll(async () => {
    if (!hasDb) return; // soft skip
    // Attempt login
    try {
      token = await login();
    } catch (e) {
      console.warn('Login failed, tests may be skipped:', e.message);
    }

    // Connect socket if token
    if (token) {
      socket = Client('http://localhost:8001', {
        auth: { token },
        autoConnect: true,
        timeout: 5000,
      });

      await new Promise(resolve => {
        socket.on('connect', resolve);
        setTimeout(resolve, 6000);
      });
    }
  }, 15000);

  afterAll(async () => {
    if (socket) socket.close();
  });

  it('logs in and receives token', () => {
    if (!hasDb) return; // soft skip
    expect(typeof token).toBe('string');
  });

  it('sends a chat message and receives an agent response', async () => {
    if (!hasDb || !socket || !token) return; // soft skip

    const responsePromise = new Promise(resolve => {
      socket.once('agent_response', payload => resolve(payload));
    });

    socket.emit('user_message', { text: 'Hello test agent' });

    const agentPayload = await responsePromise;
    expect(agentPayload).toBeTruthy();
  const content = agentPayload.text || agentPayload.message || '';
  expect(typeof content).toBe('string');
  expect(content.length).toBeGreaterThan(0);
  }, 20000);
});
