#!/usr/bin/env node
/* Dev helper: register (if needed) and login to retrieve a JWT token.
 * Writes token to project root .dev-token and prints it to stdout.
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const API_BASE = process.env.CARTRITA_API || 'http://localhost:8001/api/auth';
const EMAIL = process.env.CARTRITA_DEV_EMAIL || 'robbinosebest@gmail.com';
const PASSWORD = process.env.CARTRITA_DEV_PASSWORD || 'Punky2025!';
const NAME = process.env.CARTRITA_DEV_NAME || 'Robert Allen';

async function ensureUser() {
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: NAME, email: EMAIL, password: PASSWORD })
    });
    if (res.ok) {
      console.log('[auth-dev] Registered new user');
      return true;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      console.log('[auth-dev] User already exists, proceeding to login');
      return true;
    }
    console.warn('[auth-dev] Registration not successful:', res.status, data.error || data);
  } catch (e) {
    console.error('[auth-dev] Registration request failed:', e.message);
  }
  return false;
}

async function login() {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${data.error || JSON.stringify(data)}`);
  }
  if (!data.token) throw new Error('No token in response');
  return data.token;
}

(async () => {
  const ready = await ensureUser();
  if (!ready) process.exit(1);
  const token = await login();
  const tokenPath = path.resolve(process.cwd(), '.dev-token');
  fs.writeFileSync(tokenPath, token + '\n', { mode: 0o600 });
  console.log('\n=== Cartrita Dev JWT ===');
  console.log(token);
  console.log('\nStored at .dev-token (chmod 600). To load in browser console:');
  console.log("localStorage.setItem('token', '" + token + "')");
})();
