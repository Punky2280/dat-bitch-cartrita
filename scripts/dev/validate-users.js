#!/usr/bin/env node
/* Fetch users and validation tokens from dev auth endpoints */
import fetch from 'node-fetch';

const BASE = process.env.CARTRITA_API || 'http://localhost:8001/api/auth';

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  let data = {};
  try { data = await res.json(); } catch(_) {}
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${JSON.stringify(data)}`);
  return data;
}

(async () => {
  try {
    const usersData = await fetchJson(`${BASE}/users`);
    console.log(`Users: ${usersData.users.length}`);
    const valData = await fetchJson(`${BASE}/validate-users`, { method: 'POST' });
    const ok = valData.validations.filter(v => v.ok).length;
    console.log(`Validated tokens: ${ok}/${valData.count}`);
    // Print a sample token
    if (valData.validations[0]) {
      console.log('Sample token:', valData.validations[0].token.slice(0, 40) + '...');
    }
  } catch (e) {
    console.error('Validation script failed:', e.message);
    process.exit(1);
  }
})();
