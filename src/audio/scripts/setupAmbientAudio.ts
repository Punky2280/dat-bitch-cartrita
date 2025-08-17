import { getSupportedMimeType } from './mimeUtils';
import { createSafeMediaRecorder } from './createSafeMediaRecorder';

// TODO: PHASE_A_WORKFLOW_IMPLEMENTATION - Integrate with workflow triggers
// This function will be enhanced to support workflow automation platform
export async function setupAmbientAudio(stream: MediaStream, onData: (data: any) => void) {
  try {
    console.log('[SETUP_AMBIENT_AUDIO] Setting up ambient audio processing...');
    
    // Get supported MIME type for recording
    const mimeType = getSupportedMimeType();
    console.log('[SETUP_AMBIENT_AUDIO] Using MIME type:', mimeType);
    
    // Create safe media recorder
    const mediaRecorder = createSafeMediaRecorder(stream, mimeType);
    
    // Set up data handling
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        console.log('[SETUP_AMBIENT_AUDIO] Audio data available:', event.data.size, 'bytes');
        onData(event.data);
      }
    };
    
    // Start recording
    mediaRecorder.start(1000); // Collect data every second
    console.log('[SETUP_AMBIENT_AUDIO] Ambient audio setup completed successfully');
    
    return mediaRecorder;
  } catch (error) {
    console.error('[SETUP_AMBIENT_AUDIO] Error setting up ambient audio:', error);
    throw error;
  }
}
