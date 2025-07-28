import { createSafeMediaRecorder } from './createSafeMediaRecorder';

export function setupAmbientAudio(
  stream: MediaStream,
  onData: (buffer: ArrayBuffer) => void
): MediaRecorder | null {
  try {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.error('[AmbientAudio] No audio tracks found');
      return null;
    }

    console.log(`[AmbientAudio] Found ${audioTracks.length} audio track(s). Attempting to create recorder.`);

    // Let createSafeMediaRecorder handle finding the best mimeType.
    // We just pass the desired options and it will find a compatible format.
    const recorder = createSafeMediaRecorder(stream, {
      audioBitsPerSecond: 128000,
    });

    if (!recorder) {
      console.error('[AmbientAudio] Failed to create MediaRecorder');
      return null;
    }

    console.log(`[AmbientAudio] MediaRecorder created with mimeType: "${recorder.mimeType}"`);

    // This is the correct logic for streaming.
    // Send data as it becomes available from the timeslice.
    recorder.addEventListener('dataavailable', async (event: BlobEvent) => {
      if (event.data.size > 0) {
        try {
          const buffer = await event.data.arrayBuffer();
          onData(buffer);
        } catch (err) {
          console.error('[AmbientAudio] Failed to process data chunk:', err);
        }
      }
    });

    recorder.addEventListener('stop', () => {
      console.log('[AmbientAudio] Recording stopped.');
    });

    recorder.addEventListener('error', (event: Event) => {
      console.error('[AmbientAudio] MediaRecorder error:', (event as ErrorEvent).error);
    });

    try {
      // The timeslice here is what triggers the streaming 'dataavailable' event.
      recorder.start(1000);
      console.log('[AmbientAudio] Recording started with 1-second timeslice.');
    } catch (err) {
      console.error('[AmbientAudio] Failed to start recording:', err);
      return null;
    }

    return recorder;
  } catch (error) {
    console.error('[AmbientAudio] Setup error:', error);
    return null;
  }
}
