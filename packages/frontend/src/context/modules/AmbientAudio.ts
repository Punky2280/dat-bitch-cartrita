export function setupAmbientAudio(
  stream: MediaStream,
  onData: (buffer: ArrayBuffer) => void
): MediaRecorder | null {
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    console.error('[AmbientAudio] No audio tracks found in the provided stream.');
    return null;
  }

  console.log(`[AmbientAudio] Found ${audioTracks.length} audio track(s). Testing recorder configurations...`);

  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    '', // Let the browser choose its default
  ];

  for (const mimeType of mimeTypes) {
    const options: MediaRecorderOptions = { audioBitsPerSecond: 128000 };
    if (mimeType) {
      options.mimeType = mimeType;
    } else {
      delete options.mimeType;
    }

    if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
      continue; // Skip unsupported types
    }

    let recorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      // This configuration is not supported for creation, try the next one.
      continue;
    }

    // The crucial part: attempt to START the recorder.
    // Creation can succeed while starting (with a timeslice) can fail.
    try {
      recorder.addEventListener('dataavailable', async (event: BlobEvent) => {
        if (event.data.size > 0) {
          onData(await event.data.arrayBuffer());
        }
      });

      recorder.addEventListener('error', (event: Event) => {
        console.error('[AmbientAudio] MediaRecorder error:', (event as ErrorEvent).error);
      });

      recorder.start(1000); // The timeslice is what can fail.

      console.log(`[AmbientAudio] Successfully started MediaRecorder with options:`, options);
      return recorder; // Success! Return the working recorder.
    } catch (e) {
      console.warn(`[AmbientAudio] Succeeded in creating but failed to start recorder with options:`, options, e);
      // This recorder is no good, continue to the next MIME type.
    }
  }

  console.error('[AmbientAudio] Could not create and start a MediaRecorder with any supported configuration.');
  return null;
}
