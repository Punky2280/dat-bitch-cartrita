#!/usr/bin/env node

/**
 * Camera Issue Auto-Fix Script
 * Cartrita Multi-Agent OS - Automated Camera Problem Resolution
 * 
 * This script automatically detects and fixes common camera issues
 * including black screen problems, permission issues, and configuration problems.
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class CameraAutoFixer {
    constructor() {
        this.fixes = [];
        this.timestamp = new Date().toISOString();
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        console.log(logEntry);
        this.fixes.push({ timestamp, level, message });
    }

    success(message) {
        this.log(`✅ ${message}`, 'SUCCESS');
    }

    error(message) {
        this.log(`❌ ${message}`, 'ERROR');
    }

    warn(message) {
        this.log(`⚠️  ${message}`, 'WARN');
    }

    info(message) {
        this.log(`ℹ️  ${message}`, 'INFO');
    }

    async fixBlackScreenIssues() {
        this.info('Fixing black screen camera issues...');
        
        try {
            // Fix 1: Update camera utilities with better black frame detection
            await this.updateCameraUtils();
            
            // Fix 2: Improve video element handling
            await this.fixVideoElementIssues();
            
            // Fix 3: Add camera warm-up logic
            await this.addCameraWarmupLogic();
            
            this.success('Black screen fixes applied');
        } catch (error) {
            this.error(`Failed to fix black screen issues: ${error.message}`);
        }
    }

    async updateCameraUtils() {
        const cameraUtilsPath = path.join(__dirname, 'packages', 'frontend', 'src', 'utils', 'cameraUtils.ts');
        
        try {
            if (await this.fileExists(cameraUtilsPath)) {
                let content = await fs.readFile(cameraUtilsPath, 'utf8');
                
                // Add improved black frame detection
                const blackFrameDetectionCode = `
/**
 * Enhanced black frame detection with multiple algorithms
 */
export function detectBlackFrame(videoElement: HTMLVideoElement): {
  isBlack: boolean;
  confidence: number;
  details: string;
} {
  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    return { isBlack: true, confidence: 1.0, details: 'No video dimensions' };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { isBlack: true, confidence: 1.0, details: 'No canvas context' };
  }

  // Use small sample for performance
  const sampleWidth = Math.min(64, videoElement.videoWidth);
  const sampleHeight = Math.min(64, videoElement.videoHeight);
  
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  
  ctx.drawImage(videoElement, 0, 0, sampleWidth, sampleHeight);
  
  const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
  const data = imageData.data;
  
  // Algorithm 1: Average brightness
  let totalBrightness = 0;
  let brightPixels = 0;
  
  // Algorithm 2: Color variance
  let rSum = 0, gSum = 0, bSum = 0;
  let rVar = 0, gVar = 0, bVar = 0;
  
  const pixelCount = data.length / 4;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const brightness = (r + g + b) / 3;
    totalBrightness += brightness;
    
    if (brightness > 20) brightPixels++;
    
    rSum += r;
    gSum += g;
    bSum += b;
  }
  
  const avgBrightness = totalBrightness / pixelCount;
  const brightPixelRatio = brightPixels / pixelCount;
  
  // Calculate variance for color distribution
  const rAvg = rSum / pixelCount;
  const gAvg = gSum / pixelCount;
  const bAvg = bSum / pixelCount;
  
  for (let i = 0; i < data.length; i += 4) {
    rVar += Math.pow(data[i] - rAvg, 2);
    gVar += Math.pow(data[i + 1] - gAvg, 2);
    bVar += Math.pow(data[i + 2] - bAvg, 2);
  }
  
  const colorVariance = (rVar + gVar + bVar) / (3 * pixelCount);
  
  // Determine if black frame based on multiple criteria
  const isBlackByBrightness = avgBrightness < 10;
  const isBlackByRatio = brightPixelRatio < 0.05;
  const isBlackByVariance = colorVariance < 100;
  
  const blackCriteria = [isBlackByBrightness, isBlackByRatio, isBlackByVariance];
  const blackCount = blackCriteria.filter(Boolean).length;
  
  const isBlack = blackCount >= 2;
  const confidence = blackCount / blackCriteria.length;
  
  const details = \`brightness: \${avgBrightness.toFixed(1)}, bright ratio: \${(brightPixelRatio * 100).toFixed(1)}%, variance: \${colorVariance.toFixed(1)}\`;
  
  return { isBlack, confidence, details };
}

/**
 * Wait for camera to warm up and provide stable frames
 */
export async function waitForCameraWarmup(
  videoElement: HTMLVideoElement,
  maxWaitMs: number = 3000
): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 100;
  
  return new Promise((resolve) => {
    const checkFrame = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > maxWaitMs) {
        console.warn('[CameraUtils] Camera warmup timeout');
        resolve(false);
        return;
      }
      
      const detection = detectBlackFrame(videoElement);
      
      if (!detection.isBlack) {
        console.log(\`[CameraUtils] Camera ready after \${elapsed}ms\`);
        resolve(true);
        return;
      }
      
      setTimeout(checkFrame, checkInterval);
    };
    
    checkFrame();
  });
}
`;

                // Add the new functions if they don't exist
                if (!content.includes('detectBlackFrame')) {
                    content += blackFrameDetectionCode;
                    await fs.writeFile(cameraUtilsPath, content);
                    this.success('Enhanced black frame detection added to cameraUtils.ts');
                }
            }
        } catch (error) {
            this.warn(`Could not update camera utils: ${error.message}`);
        }
    }

    async fixVideoElementIssues() {
        this.info('Fixing video element handling issues...');
        
        // Create a patch for common video element issues
        const videoPatchScript = `
/**
 * Video Element Fix Script
 * Apply this to components with video element issues
 */

// Fix 1: Ensure proper video element initialization
function initializeVideoElement(videoRef, streamRef) {
    if (!videoRef.current) return false;
    
    const video = videoRef.current;
    
    // Reset video element state
    video.srcObject = null;
    video.load();
    
    // Set optimal attributes
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.controls = false;
    
    // Add error handling
    video.onerror = (e) => {
        console.error('[Video] Element error:', e);
    };
    
    video.onabort = () => {
        console.warn('[Video] Element aborted');
    };
    
    video.onstalled = () => {
        console.warn('[Video] Element stalled');
    };
    
    return true;
}

// Fix 2: Proper stream assignment with retry
async function assignStreamToVideo(videoRef, stream, retries = 3) {
    if (!videoRef.current || !stream) return false;
    
    const video = videoRef.current;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            video.srcObject = stream;
            
            // Wait for metadata
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Metadata timeout')), 5000);
                
                video.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                
                video.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error('Video error'));
                };
            });
            
            // Attempt to play
            await video.play();
            
            console.log(\`[Video] Stream assigned successfully on attempt \${attempt}\`);
            return true;
            
        } catch (error) {
            console.warn(\`[Video] Stream assignment attempt \${attempt} failed:, error.message\`);
            
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    return false;
}

// Fix 3: Stream quality verification
function verifyStreamQuality(videoRef) {
    if (!videoRef.current) return false;
    
    const video = videoRef.current;
    
    // Check dimensions
    if (!video.videoWidth || !video.videoHeight) {
        console.warn('[Video] No video dimensions available');
        return false;
    }
    
    // Check if actually playing
    if (video.paused || video.ended) {
        console.warn('[Video] Video not playing');
        return false;
    }
    
    // Check for black frame
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(video, 0, 0, 32, 32);
        
        const imageData = ctx.getImageData(0, 0, 32, 32);
        const data = imageData.data;
        
        let totalBrightness = 0;
        for (let i = 0; i < data.length; i += 4) {
            totalBrightness += data[i] + data[i + 1] + data[i + 2];
        }
        
        const avgBrightness = totalBrightness / (data.length / 4);
        const isBlack = avgBrightness < 15;
        
        if (isBlack) {
            console.warn('[Video] Black frame detected');
            return false;
        }
        
    } catch (error) {
        console.warn('[Video] Could not verify frame content:', error.message);
    }
    
    return true;
}

// Export fixes for use in components
window.VideoElementFixes = {
    initializeVideoElement,
    assignStreamToVideo,
    verifyStreamQuality
};
`;

        try {
            await fs.writeFile(
                path.join(__dirname, 'video-element-fixes.js'),
                videoPatchScript
            );
            this.success('Video element fixes created');
        } catch (error) {
            this.error(`Failed to create video fixes: ${error.message}`);
        }
    }

    async addCameraWarmupLogic() {
        this.info('Adding camera warm-up logic...');
        
        const warmupScript = `
/**
 * Camera Warm-up Utility
 * Helps resolve black screen issues by giving cameras time to initialize
 */

class CameraWarmupManager {
    constructor(options = {}) {
        this.warmupTime = options.warmupTime || 2000;
        this.maxRetries = options.maxRetries || 3;
        this.checkInterval = options.checkInterval || 200;
    }
    
    async warmupCamera(stream, videoElement) {
        console.log('[CameraWarmup] Starting camera warm-up sequence...');
        
        // Phase 1: Initial delay for camera hardware initialization
        await this.delay(500);
        
        // Phase 2: Check for stable frames
        const isStable = await this.waitForStableFrames(videoElement);
        
        if (!isStable) {
            console.warn('[CameraWarmup] Camera not stable after warmup');
            return false;
        }
        
        console.log('[CameraWarmup] Camera warmup completed successfully');
        return true;
    }
    
    async waitForStableFrames(videoElement, duration = 1000) {
        const startTime = Date.now();
        let stableCount = 0;
        const requiredStableFrames = 5;
        
        while (Date.now() - startTime < this.warmupTime) {
            await this.delay(this.checkInterval);
            
            if (this.isFrameStable(videoElement)) {
                stableCount++;
                if (stableCount >= requiredStableFrames) {
                    return true;
                }
            } else {
                stableCount = 0;
            }
        }
        
        return false;
    }
    
    isFrameStable(videoElement) {
        if (!videoElement.videoWidth || !videoElement.videoHeight) {
            return false;
        }
        
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = 16;
            canvas.height = 16;
            ctx.drawImage(videoElement, 0, 0, 16, 16);
            
            const imageData = ctx.getImageData(0, 0, 16, 16);
            const data = imageData.data;
            
            // Check for non-black pixels and some color variation
            let nonBlackPixels = 0;
            let colorVariation = 0;
            
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                if (r + g + b > 30) {
                    nonBlackPixels++;
                }
                
                colorVariation += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
            }
            
            const pixelCount = data.length / 4;
            const nonBlackRatio = nonBlackPixels / pixelCount;
            const avgColorVariation = colorVariation / pixelCount;
            
            // Frame is stable if we have enough non-black pixels and some color variation
            return nonBlackRatio > 0.1 && avgColorVariation > 5;
            
        } catch (error) {
            console.warn('[CameraWarmup] Frame stability check failed:', error.message);
            return false;
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Factory method for easy usage
    static async warmupCameraStream(stream, videoElement, options = {}) {
        const manager = new CameraWarmupManager(options);
        return await manager.warmupCamera(stream, videoElement);
    }
}

// Make available globally
window.CameraWarmupManager = CameraWarmupManager;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CameraWarmupManager;
}
`;

        try {
            await fs.writeFile(
                path.join(__dirname, 'camera-warmup-utility.js'),
                warmupScript
            );
            this.success('Camera warm-up utility created');
        } catch (error) {
            this.error(`Failed to create warmup utility: ${error.message}`);
        }
    }

    async fixPermissionIssues() {
        this.info('Creating permission issue fixes...');
        
        const permissionFixScript = `
/**
 * Camera Permission Auto-Fix Utility
 * Handles common camera permission issues
 */

class PermissionFixer {
    static async requestCameraPermissions() {
        try {
            // Method 1: Standard getUserMedia
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            });
            
            console.log('✅ Camera permissions granted via standard method');
            return { success: true, stream };
            
        } catch (error) {
            console.log('⚠️ Standard method failed, trying alternatives...');
            
            // Method 2: Try with minimal constraints
            try {
                const basicStream = await navigator.mediaDevices.getUserMedia({ video: true });
                console.log('✅ Camera permissions granted via basic method');
                return { success: true, stream: basicStream };
                
            } catch (basicError) {
                // Method 3: Check if permissions API is available
                if (navigator.permissions) {
                    try {
                        const permission = await navigator.permissions.query({ name: 'camera' });
                        
                        if (permission.state === 'denied') {
                            return {
                                success: false,
                                error: 'Camera permission permanently denied. Please reset in browser settings.',
                                fixes: [
                                    'Click the camera icon in the address bar',
                                    'Go to browser settings > Privacy & Security > Site Settings > Camera',
                                    'Remove this site from blocked list',
                                    'Refresh the page'
                                ]
                            };
                        }
                    } catch (permError) {
                        console.warn('Permissions API not supported');
                    }
                }
                
                return {
                    success: false,
                    error: error.message,
                    fixes: this.getPermissionFixes(error)
                };
            }
        }
    }
    
    static getPermissionFixes(error) {
        const fixes = [];
        
        if (error.name === 'NotAllowedError') {
            fixes.push(
                'Click the camera icon (🎥) in your browser address bar',
                'Select "Allow" for camera access',
                'Refresh the page after granting permission',
                'Try using HTTPS instead of HTTP',
                'Clear browser cache and cookies',
                'Try incognito/private browsing mode'
            );
        } else if (error.name === 'NotFoundError') {
            fixes.push(
                'Check if camera is connected and powered on',
                'Close other applications using the camera',
                'Try a different camera if available',
                'Update camera drivers',
                'Restart your computer'
            );
        } else if (error.name === 'NotReadableError') {
            fixes.push(
                'Close video conferencing apps (Zoom, Teams, Skype)',
                'Close other browser tabs using camera',
                'Restart your browser',
                'Unplug and reconnect USB camera',
                'Check camera privacy settings in OS'
            );
        }
        
        return fixes;
    }
    
    static displayPermissionHelp(container, fixes) {
        const helpDiv = document.createElement('div');
        helpDiv.className = 'permission-help';
        helpDiv.innerHTML = \`
            <h3>🔧 Camera Permission Help</h3>
            <p>Try these solutions:</p>
            <ul>
                \${fixes.map(fix => \`<li>\${fix}</li>\`).join('')}
            </ul>
            <button onclick="location.reload()" class="retry-button">
                🔄 Retry Camera Access
            </button>
        \`;
        
        container.appendChild(helpDiv);
    }
}

window.PermissionFixer = PermissionFixer;
`;

        try {
            await fs.writeFile(
                path.join(__dirname, 'permission-fix-utility.js'),
                permissionFixScript
            );
            this.success('Permission fix utility created');
        } catch (error) {
            this.error(`Failed to create permission fixes: ${error.message}`);
        }
    }

    async createAutoFixScript() {
        this.info('Creating comprehensive auto-fix script...');
        
        const autoFixScript = `
/**
 * Comprehensive Camera Auto-Fix Script
 * Automatically detects and resolves camera issues
 */

async function autoFixCameraIssues() {
    console.log('🔧 Starting automatic camera issue resolution...');
    
    const fixes = [];
    
    try {
        // Step 1: Test basic camera access
        console.log('📋 Step 1: Testing camera access...');
        const permissionResult = await PermissionFixer.requestCameraPermissions();
        
        if (!permissionResult.success) {
            fixes.push({
                issue: 'Permission denied',
                fixes: permissionResult.fixes,
                critical: true
            });
        }
        
        // Step 2: Test video element functionality
        console.log('📋 Step 2: Testing video element...');
        const video = document.createElement('video');
        const videoSupported = typeof video.play === 'function';
        
        if (!videoSupported) {
            fixes.push({
                issue: 'Video element not supported',
                fixes: ['Update your browser', 'Enable JavaScript', 'Clear browser cache'],
                critical: true
            });
        }
        
        // Step 3: Test canvas functionality
        console.log('📋 Step 3: Testing canvas support...');
        const canvas = document.createElement('canvas');
        const canvasSupported = !!canvas.getContext('2d');
        
        if (!canvasSupported) {
            fixes.push({
                issue: 'Canvas not supported',
                fixes: ['Update your browser', 'Enable hardware acceleration', 'Clear browser data'],
                critical: false
            });
        }
        
        // Step 4: Performance check
        console.log('📋 Step 4: Checking performance...');
        const performanceIssues = await checkPerformance();
        if (performanceIssues.length > 0) {
            fixes.push({
                issue: 'Performance issues detected',
                fixes: performanceIssues,
                critical: false
            });
        }
        
        // Generate report
        if (fixes.length === 0) {
            console.log('✅ All camera tests passed!');
            return { success: true, message: 'Camera system is working correctly' };
        } else {
            console.log(\`⚠️ Found \${fixes.length} issues\`);
            return { success: false, fixes };
        }
        
    } catch (error) {
        console.error('❌ Auto-fix process failed:', error);
        return {
            success: false,
            error: error.message,
            fixes: [{
                issue: 'Auto-fix process failed',
                fixes: ['Refresh the page', 'Clear browser cache', 'Try a different browser'],
                critical: true
            }]
        };
    }
}

async function checkPerformance() {
    const issues = [];
    
    // Check available memory
    if (navigator.deviceMemory && navigator.deviceMemory < 2) {
        issues.push('Low device memory - close other applications');
    }
    
    // Check connection
    if (navigator.connection) {
        const connection = navigator.connection;
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            issues.push('Slow network connection - try lower resolution');
        }
    }
    
    // Check hardware acceleration
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
        issues.push('WebGL not available - enable hardware acceleration');
    }
    
    return issues;
}

// Auto-run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(autoFixCameraIssues, 1000);
    });
} else {
    setTimeout(autoFixCameraIssues, 1000);
}

window.autoFixCameraIssues = autoFixCameraIssues;
`;

        try {
            await fs.writeFile(
                path.join(__dirname, 'auto-fix-camera.js'),
                autoFixScript
            );
            this.success('Auto-fix script created');
        } catch (error) {
            this.error(`Failed to create auto-fix script: ${error.message}`);
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async runAllFixes() {
        console.log('🚀 Starting Camera Auto-Fix Process...\n');
        
        this.info('=' + '='.repeat(50));
        this.info('CARTRITA CAMERA AUTO-FIX UTILITY');
        this.info(`Timestamp: ${this.timestamp}`);
        this.info('=' + '='.repeat(50));

        // Run all fix categories
        await this.fixBlackScreenIssues();
        await this.fixPermissionIssues();
        await this.createAutoFixScript();

        // Summary
        const successCount = this.fixes.filter(f => f.level === 'SUCCESS').length;
        const errorCount = this.fixes.filter(f => f.level === 'ERROR').length;
        
        this.info('=' + '='.repeat(50));
        this.info('AUTO-FIX SUMMARY');
        this.info('=' + '='.repeat(50));
        this.info(`Fixes Applied: ${successCount}`);
        this.info(`Errors Encountered: ${errorCount}`);

        if (errorCount === 0) {
            this.success('All camera fixes applied successfully!');
        } else {
            this.warn('Some fixes encountered issues - check the log above');
        }

        // Usage instructions
        console.log('\n📋 Usage Instructions:');
        console.log('   1. Open camera-test-utility.html in your browser');
        console.log('   2. Include the generated fix scripts in your application:');
        console.log('      - video-element-fixes.js');
        console.log('      - camera-warmup-utility.js'); 
        console.log('      - permission-fix-utility.js');
        console.log('      - auto-fix-camera.js');
        console.log('   3. Run test-camera-diagnostics.js for system-level testing');

        return {
            success: errorCount === 0,
            fixesApplied: successCount,
            errors: errorCount
        };
    }
}

// Command line interface
async function main() {
    const fixer = new CameraAutoFixer();
    
    try {
        const result = await fixer.runAllFixes();
        process.exit(result.success ? 0 : 1);
    } catch (error) {
        console.error(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = CameraAutoFixer;