/*
  Wait for backend health before building. Provides gentle idling using retries/sleep.
*/

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8002';
const HEALTH_URL = `${API_BASE.replace(/\/$/, '')}/health`;
const MAX_RETRIES = Number(process.env.BUILD_HEALTH_MAX_RETRIES || 20);
const BASE_DELAY_MS = Number(process.env.BUILD_HEALTH_BASE_DELAY_MS || 1500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkHealth() {
  try {
    const res = await fetch(HEALTH_URL, { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return Boolean(data?.status) || true;
  } catch {
    return false;
  }
}

(async () => {
  console.log(`[wait-for-backend] Checking ${HEALTH_URL}`);
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const ok = await checkHealth();
    if (ok) {
      console.log(`[wait-for-backend] Backend healthy on attempt ${attempt}.`);
      process.exit(0);
    }
    const delay = BASE_DELAY_MS * Math.pow(1.3, attempt - 1);
    console.log(`[wait-for-backend] Not ready (attempt ${attempt}/${MAX_RETRIES}). Sleeping ${Math.round(delay)}ms...`);
    await sleep(delay);
  }
  console.error('[wait-for-backend] Backend not healthy after max retries. Proceeding anyway.');
  process.exit(0);
})();
