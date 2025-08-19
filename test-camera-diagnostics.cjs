#!/usr/bin/env node

/**
 * Camera Testing & Troubleshooting Script
 * Cartrita Multi-Agent OS - Camera Diagnostics Utility
 * 
 * This script tests camera functionality, diagnoses black screen issues,
 * and provides comprehensive troubleshooting for vision systems.
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class CameraDiagnostics {
    constructor() {
        this.results = [];
        this.timestamp = new Date().toISOString();
        this.logFile = `camera-diagnostics-${this.timestamp.slice(0, 19).replace(/[:.]/g, '-')}.log`;
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        
        console.log(logEntry);
        this.results.push({ timestamp, level, message });
    }

    error(message) {
        this.log(message, 'ERROR');
    }

    warn(message) {
        this.log(message, 'WARN');
    }

    success(message) {
        this.log(message, 'SUCCESS');
    }

    async saveReport() {
        try {
            const report = {
                timestamp: this.timestamp,
                diagnostics: this.results,
                summary: this.generateSummary()
            };

            await fs.writeFile(
                path.join(__dirname, this.logFile),
                JSON.stringify(report, null, 2)
            );

            this.success(`Diagnostics report saved to: ${this.logFile}`);
        } catch (error) {
            this.error(`Failed to save report: ${error.message}`);
        }
    }

    generateSummary() {
        const errors = this.results.filter(r => r.level === 'ERROR').length;
        const warnings = this.results.filter(r => r.level === 'WARN').length;
        const successes = this.results.filter(r => r.level === 'SUCCESS').length;

        return {
            total_checks: this.results.length,
            errors,
            warnings,
            successes,
            status: errors === 0 ? 'HEALTHY' : 'ISSUES_DETECTED'
        };
    }

    async testSystemCameras() {
        this.log('🔍 Testing system camera availability...');
        
        try {
            // Test on Linux
            if (process.platform === 'linux') {
                await this.testLinuxCameras();
            }
            // Test on macOS
            else if (process.platform === 'darwin') {
                await this.testMacOSCameras();
            }
            // Test on Windows
            else if (process.platform === 'win32') {
                await this.testWindowsCameras();
            }
            else {
                this.warn(`Unsupported platform: ${process.platform}`);
            }
        } catch (error) {
            this.error(`System camera test failed: ${error.message}`);
        }
    }

    async testLinuxCameras() {
        try {
            // Check for video devices
            const devices = await fs.readdir('/dev').catch(() => []);
            const videoDevices = devices.filter(device => device.startsWith('video'));
            
            this.log(`Found ${videoDevices.length} video device(s): ${videoDevices.join(', ')}`);
            
            if (videoDevices.length === 0) {
                this.error('No video devices found in /dev');
                return;
            }

            // Test v4l2 capabilities
            try {
                const { stdout } = await execAsync('which v4l2-ctl');
                if (stdout.trim()) {
                    for (const device of videoDevices.slice(0, 3)) { // Test first 3 devices
                        try {
                            const { stdout: deviceInfo } = await execAsync(`v4l2-ctl --device=/dev/${device} --info`);
                            this.success(`/dev/${device}: ${deviceInfo.split('\n')[0]}`);
                        } catch (error) {
                            this.warn(`Cannot query /dev/${device}: ${error.message}`);
                        }
                    }
                }
            } catch (error) {
                this.warn('v4l2-ctl not available - install v4l-utils for detailed camera info');
            }

            // Test basic camera access
            await this.testBasicCameraAccess();

        } catch (error) {
            this.error(`Linux camera test failed: ${error.message}`);
        }
    }

    async testMacOSCameras() {
        try {
            // Use system_profiler to get camera info
            const { stdout } = await execAsync('system_profiler SPCameraDataType');
            
            if (stdout.includes('No cameras were found')) {
                this.error('No cameras found by system_profiler');
            } else {
                this.success('Camera detected by system_profiler');
                this.log(`Camera info: ${stdout.split('\n')[0]}`);
            }

            await this.testBasicCameraAccess();

        } catch (error) {
            this.error(`macOS camera test failed: ${error.message}`);
        }
    }

    async testWindowsCameras() {
        try {
            // Use PowerShell to list cameras
            const { stdout } = await execAsync('powershell "Get-PnpDevice -Class Camera | Select-Object FriendlyName, Status"');
            
            if (stdout.trim()) {
                this.success('Camera devices found via PowerShell');
                this.log(`Camera info: ${stdout}`);
            } else {
                this.error('No camera devices found via PowerShell');
            }

            await this.testBasicCameraAccess();

        } catch (error) {
            this.error(`Windows camera test failed: ${error.message}`);
        }
    }

    async testBasicCameraAccess() {
        // This would require a more sophisticated test using a headless browser
        // For now, we'll check if the camera testing utility can be served
        this.log('📋 Basic camera access test requires browser environment');
        this.log('ℹ️  Use the HTML camera testing utility for interactive tests');
    }

    async testCartritaVisionServices() {
        this.log('🔍 Testing Cartrita vision services...');

        try {
            // Check if vision services are running
            const backendPath = path.join(__dirname, 'packages', 'backend');
            
            // Check ComputerVisionService
            const cvServicePath = path.join(backendPath, 'src', 'services', 'ComputerVisionService.js');
            if (await this.fileExists(cvServicePath)) {
                this.success('ComputerVisionService found');
                await this.analyzeServiceFile(cvServicePath);
            } else {
                this.error('ComputerVisionService not found');
            }

            // Check VisionAnalysisService
            const vaServicePath = path.join(backendPath, 'src', 'services', 'VisionAnalysisService.js');
            if (await this.fileExists(vaServicePath)) {
                this.success('VisionAnalysisService found');
                await this.analyzeServiceFile(vaServicePath);
            } else {
                this.warn('VisionAnalysisService not found');
            }

            // Check vision routes
            const visionRoutesPath = path.join(backendPath, 'src', 'routes', 'vision.js');
            if (await this.fileExists(visionRoutesPath)) {
                this.success('Vision routes found');
            } else {
                this.error('Vision routes not found');
            }

            // Check frontend camera utilities
            const cameraUtilsPath = path.join(__dirname, 'packages', 'frontend', 'src', 'utils', 'cameraUtils.ts');
            if (await this.fileExists(cameraUtilsPath)) {
                this.success('Camera utilities found');
            } else {
                this.error('Camera utilities not found');
            }

        } catch (error) {
            this.error(`Cartrita vision services test failed: ${error.message}`);
        }
    }

    async analyzeServiceFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            
            // Check for key methods
            const keyMethods = [
                'classifyImage',
                'detectObjects', 
                'generateEmbedding',
                'performOCR',
                'analyzeImage'
            ];

            let foundMethods = 0;
            for (const method of keyMethods) {
                if (content.includes(method)) {
                    foundMethods++;
                }
            }

            if (foundMethods === keyMethods.length) {
                this.success(`All ${keyMethods.length} key vision methods found in ${path.basename(filePath)}`);
            } else {
                this.warn(`Only ${foundMethods}/${keyMethods.length} key methods found in ${path.basename(filePath)}`);
            }

            // Check for error handling
            if (content.includes('try {') && content.includes('catch')) {
                this.success(`Error handling present in ${path.basename(filePath)}`);
            } else {
                this.warn(`Limited error handling in ${path.basename(filePath)}`);
            }

        } catch (error) {
            this.error(`Failed to analyze ${filePath}: ${error.message}`);
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

    async testDependencies() {
        this.log('🔍 Testing vision-related dependencies...');

        const packageJsonPath = path.join(__dirname, 'packages', 'backend', 'package.json');
        
        try {
            if (await this.fileExists(packageJsonPath)) {
                const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
                const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

                // Check critical vision dependencies
                const visionDeps = {
                    'sharp': 'Image processing',
                    '@tensorflow/tfjs-node': 'TensorFlow.js for Node',
                    'jimp': 'JavaScript image manipulation',
                    'canvas': 'Node.js canvas implementation'
                };

                for (const [dep, description] of Object.entries(visionDeps)) {
                    if (dependencies[dep]) {
                        this.success(`${dep} (${description}): v${dependencies[dep]}`);
                    } else {
                        this.warn(`${dep} (${description}): Not installed`);
                    }
                }

                // Check for optional vision dependencies
                const optionalDeps = {
                    'opencv4nodejs': 'OpenCV bindings',
                    'node-webrtc': 'WebRTC support',
                    '@google-cloud/vision': 'Google Cloud Vision'
                };

                for (const [dep, description] of Object.entries(optionalDeps)) {
                    if (dependencies[dep]) {
                        this.success(`${dep} (${description}): v${dependencies[dep]}`);
                    }
                }

            } else {
                this.error('Backend package.json not found');
            }
        } catch (error) {
            this.error(`Dependency test failed: ${error.message}`);
        }
    }

    async testConfiguration() {
        this.log('🔍 Testing vision configuration...');

        try {
            // Check environment variables
            const visionEnvVars = [
                'OPENAI_API_KEY',
                'GOOGLE_CLOUD_PROJECT',
                'AZURE_COMPUTER_VISION_KEY'
            ];

            for (const envVar of visionEnvVars) {
                if (process.env[envVar]) {
                    this.success(`${envVar}: Configured`);
                } else {
                    this.log(`${envVar}: Not configured (optional)`);
                }
            }

            // Check for config files
            const configPaths = [
                path.join(__dirname, 'config', 'vision.json'),
                path.join(__dirname, 'packages', 'backend', 'config', 'vision.js'),
                path.join(__dirname, '.env')
            ];

            for (const configPath of configPaths) {
                if (await this.fileExists(configPath)) {
                    this.success(`Config file found: ${path.basename(configPath)}`);
                }
            }

        } catch (error) {
            this.error(`Configuration test failed: ${error.message}`);
        }
    }

    generateTroubleshootingGuide() {
        this.log('📋 Generating troubleshooting recommendations...');

        const guide = [
            '🔧 CAMERA TROUBLESHOOTING GUIDE',
            '',
            '1. BLACK SCREEN ISSUES:',
            '   - Check camera permissions in browser',
            '   - Ensure adequate lighting',
            '   - Try different camera resolution settings',
            '   - Close other applications using the camera',
            '   - Clear browser cache and cookies',
            '',
            '2. PERMISSION DENIED:',
            '   - Click camera icon in browser address bar',
            '   - Check browser camera settings',
            '   - Use HTTPS instead of HTTP',
            '   - Try incognito/private browsing mode',
            '',
            '3. NO CAMERA FOUND:',
            '   - Verify camera is connected and powered',
            '   - Check device manager (Windows) or system info',
            '   - Update camera drivers',
            '   - Try different USB port',
            '',
            '4. PERFORMANCE ISSUES:',
            '   - Lower camera resolution',
            '   - Reduce frame rate',
            '   - Close unnecessary browser tabs',
            '   - Restart browser',
            '',
            '5. CARTRITA-SPECIFIC:',
            '   - Check vision service logs',
            '   - Verify OpenAI API key is configured',
            '   - Test vision endpoints directly',
            '   - Review OpenTelemetry metrics',
            '',
            '6. SYSTEM-LEVEL:',
            '   - Linux: Install v4l-utils, check /dev/video*',
            '   - macOS: Check Privacy & Security settings',
            '   - Windows: Check Device Manager for camera',
            ''
        ];

        for (const line of guide) {
            this.log(line);
        }
    }

    async runFullDiagnostics() {
        console.log('🚀 Starting Cartrita Camera Diagnostics...\n');
        
        // Header
        this.log('=' * 60);
        this.log('CARTRITA CAMERA DIAGNOSTICS UTILITY');
        this.log(`Timestamp: ${this.timestamp}`);
        this.log(`Platform: ${process.platform} ${process.arch}`);
        this.log(`Node.js: ${process.version}`);
        this.log('=' * 60);

        // Run all tests
        await this.testSystemCameras();
        await this.testDependencies();
        await this.testCartritaVisionServices();
        await this.testConfiguration();
        
        // Generate guides
        this.generateTroubleshootingGuide();

        // Summary
        const summary = this.generateSummary();
        this.log('=' * 60);
        this.log('DIAGNOSTIC SUMMARY');
        this.log('=' * 60);
        this.log(`Total Checks: ${summary.total_checks}`);
        this.log(`Successes: ${summary.successes}`);
        this.log(`Warnings: ${summary.warnings}`);
        this.log(`Errors: ${summary.errors}`);
        this.log(`Overall Status: ${summary.status}`);

        if (summary.errors > 0) {
            this.error('Issues detected - review the log above for details');
        } else {
            this.success('All diagnostics passed successfully!');
        }

        // Save report
        await this.saveReport();

        return summary;
    }
}

// Command line interface
async function main() {
    const diagnostics = new CameraDiagnostics();
    
    try {
        const summary = await diagnostics.runFullDiagnostics();
        
        console.log('\n🔍 Camera Testing Utility Available:');
        console.log(`   Open: ${path.join(__dirname, 'camera-test-utility.html')}`);
        console.log('   This provides interactive browser-based camera testing');
        
        process.exit(summary.errors > 0 ? 1 : 0);
        
    } catch (error) {
        console.error(`Fatal error: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = CameraDiagnostics;