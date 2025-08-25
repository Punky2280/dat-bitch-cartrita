import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// This file's only job is to load the environment variables before any other module.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const possiblePaths = [
  path.resolve(__dirname, '..', '.env'), // package root (e.g., /packages/backend/.env)
  path.resolve(__dirname, '..', '..', '.env'), // monorepo root
  '/usr/src/app/.env', // Common Docker environment path
];

let envLoaded = false;
for (const envPath of possiblePaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (result.parsed && Object.keys(result.parsed).length > 0) {
      console.log(`[loadEnv] ✅ Environment loaded from: ${envPath}`);
      envLoaded = true;
      break; // Stop after the first successful load
    }
  } catch (error) {
    // Ignore errors (e.g., file not found) and try the next path
  }
}

if (!envLoaded) {
  console.warn(
    '[loadEnv] ⚠️ No .env file found or file is empty. Relying on system environment variables.'
  );
}
