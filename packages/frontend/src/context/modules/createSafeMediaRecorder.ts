export function createSafeMediaRecorder(
  stream: MediaStream,
  options: MediaRecorderOptions
): MediaRecorder | null {
  try {
    // Get audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.error('[MediaRecorder] No audio tracks found in stream');
      return null;
    }

    // Try different MIME types in order of preference
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];

    // First, find a supported MIME type
    let supportedMimeType = '';
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        supportedMimeType = mimeType;
        console.log(`[MediaRecorder] Found supported MIME type: ${mimeType}`);
        break;
      }
    }

    // If no specific MIME type is supported, let the browser choose
    const recorderOptions = supportedMimeType 
      ? { ...options, mimeType: supportedMimeType }
      : options;

    try {
      const recorder = new MediaRecorder(stream, recorderOptions);
      console.log(`[MediaRecorder] Created successfully with ${supportedMimeType || 'default MIME type'}`);
      return recorder;
    } catch (e) {
      console.error('[MediaRecorder] Failed to create:', e);
      
      // Try without any options as last resort
      try {
        const recorder = new MediaRecorder(stream);
        console.log('[MediaRecorder] Created with default settings');
        return recorder;
      } catch (e2) {
        console.error('[MediaRecorder] Failed with default settings:', e2);
        return null;
      }
    }
  } catch (error) {
    console.error('[MediaRecorder] Unexpected error:', error);
    return null;
  }
}
