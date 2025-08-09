
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Project setup and formatting script
 */

const PACKAGES_DIR = path.join(__dirname, 'packages');
const FRONTEND_DIR = path.join(PACKAGES_DIR, 'frontend');
const BACKEND_DIR = path.join(PACKAGES_DIR, 'backend');

function executeCommand(command, cwd = __dirname) {
  try {
    console.log(`\n🔧 Running: ${command}`);
    execSync(command, { stdio: 'inherit', cwd });
    return true;
  } catch (error) {
    console.error(`❌ Error executing command: ${command}`);
    console.error(error.message);
    return false;
  }
}

function setupFrontend() {
  console.log('\n📦 Setting up frontend...');
  
  if (!fs.existsSync(FRONTEND_DIR)) {
    console.error('❌ Frontend directory not found');
    return false;
  }
  
  // Install dependencies
  if (!executeCommand('npm install', FRONTEND_DIR)) {
    return false;
  }
  
  console.log('✅ Frontend setup complete');
  return true;
}

function setupBackend() {
  console.log('\n🛠️ Setting up backend...');
  
  if (!fs.existsSync(BACKEND_DIR)) {
    console.log('⚠️ Backend directory not found, skipping...');
    return true;
  }
  
  // Install dependencies
  if (!executeCommand('npm install', BACKEND_DIR)) {
    return false;
  }
  
  console.log('✅ Backend setup complete');
  return true;
}

function formatCode() {
  console.log('\n🎨 Formatting code...');
  
  // Format frontend with Prettier
  if (fs.existsSync(FRONTEND_DIR)) {
    executeCommand('npx prettier --write "src/**/*.{js,ts,jsx,tsx,css,json}"', FRONTEND_DIR);
    executeCommand('npx eslint --fix "src/**/*.{js,ts,jsx,tsx}" --no-error-on-unmatched-pattern', FRONTEND_DIR);
  }
  
  console.log('✅ Code formatting complete');
}

function checkHealthAndStart() {
  console.log('\n🏥 Checking system health...');
  
  // Check if Docker is running (for backend services)
  try {
    execSync('docker --version', { stdio: 'pipe' });
    console.log('✅ Docker is available');
  } catch (error) {
    console.log('⚠️ Docker not available - backend services may not work');
  }
  
  // Check Node.js version
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Node.js version: ${nodeVersion}`);
  } catch (error) {
    console.error('❌ Node.js not found');
    return false;
  }
  
  return true;
}

async function main() {
  console.log('🚀 Starting project setup and formatting...');
  console.log('🌟 Dat Bitch Cartrita - Project Setup Script');

  // Health check
  if (!checkHealthAndStart()) {
    process.exit(1);
  }

  // Install root dependencies
  console.log('\n📦 Installing root dependencies...');
  if (!executeCommand('npm install')) {
    console.error('❌ Failed to install root dependencies');
    process.exit(1);
  }

  // Setup frontend
  if (!setupFrontend()) {
    console.error('❌ Frontend setup failed');
    process.exit(1);
  }

  // Setup backend
  if (!setupBackend()) {
    console.error('❌ Backend setup failed');
    process.exit(1);
  }

  // Format code
  formatCode();

  console.log('\n✨ Project setup complete!');
  console.log('\n🎯 Next steps:');
  console.log('   1. cd packages/frontend && npm run dev');
  console.log('   2. In another terminal: cd packages/backend && npm start');
  console.log('   3. Open http://localhost:3000 in your browser');
  console.log('\n🌈 Happy coding!');
}

main().catch(error => {
  console.error('❌ Error during setup:', error.message);
  process.exit(1);
});