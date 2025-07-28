export function setupVideoElements() {
  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.setAttribute('playsinline', 'true'); // Important for mobile
  // Use off-screen positioning instead of 'display: none' to ensure
  // the browser rendering engine processes the video frames. This prevents
  // capturing black frames.
  video.style.position = 'absolute';
  video.style.top = '-9999px';
  video.style.left = '-9999px';
  document.body.appendChild(video);

  const canvas = document.createElement('canvas');
  canvas.width = 640; // Increased resolution
  canvas.height = 480;
  canvas.style.display = 'none';
  document.body.appendChild(canvas);

  // Get context with willReadFrequently for better performance
  const context = canvas.getContext('2d', { 
    willReadFrequently: true,
    alpha: false 
  });

  return { video, canvas, context };
}

export function startVideoCapture(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  stream: MediaStream,
  onFrame: (blob: Blob) => void
): NodeJS.Timeout {
  video.srcObject = stream;

  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    const settings = videoTrack.getSettings();
    console.log(`[AmbientVideo] Video track: ${videoTrack.label}, readyState: ${videoTrack.readyState}`);
    console.log(`[AmbientVideo] Video settings:`, settings);
    
    // Apply constraints for better quality
    videoTrack.applyConstraints({
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    }).catch(e => console.warn('[AmbientVideo] Could not apply constraints:', e));
  }

  // Get context with willReadFrequently
  const ctx = canvas.getContext('2d', { 
    willReadFrequently: true,
    alpha: false 
  });
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  let frameCount = 0;
  
  return setInterval(() => {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Check if frame is not black (simple brightness check)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let brightness = 0;
      
      // Sample every 100th pixel for performance
      for (let i = 0; i < data.length; i += 400) {
        brightness += data[i] + data[i + 1] + data[i + 2];
      }
      
      const avgBrightness = brightness / (data.length / 400) / 3;
      
      if (avgBrightness < 5) {
        if (frameCount % 10 === 0) { // Log every 10th black frame
          console.warn('[AmbientVideo] Frame appears to be black. Check camera/lighting.');
        }
      }
      
      canvas.toBlob((blob) => {
        if (blob) {
          console.log(`[AmbientVideo] Sending video frame ${++frameCount} of size: ${blob.size}`);
          onFrame(blob);
        }
      }, 'image/jpeg', 0.9); // Increased quality
    }
  }, 5000); // Send frame every 5 seconds
}
