import { getSupportedMimeType } from './mimeUtils';
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

    console.log(`[AmbientAudio] Found ${audioTracks.length} audio track(s)`);

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      console.error('[AmbientAudio] No supported MIME type found');
      return null;
    }

    console.log(`[AmbientAudio] Using MIME type: ${mimeType}`);
    const recorder = createSafeMediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 128000,
    });

    if (!recorder) {
      console.error('[AmbientAudio] Failed to create MediaRecorder');
      return null;
    }

    const chunks: Blob[] = [];

    recorder.addEventListener('dataavailable', (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener('stop', async () => {
      if (chunks.length > 0) {
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const buffer = await blob.arrayBuffer();
          onData(buffer);
          chunks.length = 0;
        } catch (err) {
          console.error('[AmbientAudio] Failed to convert blob to ArrayBuffer:', err);
        }
      }
    });

    recorder.addEventListener('error', (event: Event) => {
      console.error('[AmbientAudio] MediaRecorder error:', (event as ErrorEvent).error);
    });

    try {
      recorder.start(1000);
      console.log('[AmbientAudio] Recording started');
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
