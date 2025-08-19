
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
