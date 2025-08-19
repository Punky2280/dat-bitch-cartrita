
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
            
            console.log(`[Video] Stream assigned successfully on attempt ${attempt}`);
            return true;
            
        } catch (error) {
            console.warn(`[Video] Stream assignment attempt ${attempt} failed:, error.message`);
            
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
