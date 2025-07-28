export function createSafeMediaRecorder(
  stream: MediaStream,
  options: MediaRecorderOptions
): MediaRecorder | null {
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    console.error('[MediaRecorder] No audio tracks found in stream');
    return null;
  }

  // Try different MIME types in order of preference.
  // An empty string tells the browser to use its default.
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    '', // Try browser default as a fallback
  ];

  for (const mimeType of mimeTypes) {
    const currentOptions = { ...options };
    if (mimeType) {
      currentOptions.mimeType = mimeType;
    } else {
      delete currentOptions.mimeType;
    }

    if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
      continue; // Skip unsupported types
    }

    try {
      const recorder = new MediaRecorder(stream, currentOptions);
      console.log(`[MediaRecorder] Successfully created with options:`, currentOptions);
      return recorder;
    } catch (e) {
      console.warn(`[MediaRecorder] Failed to create with options:`, currentOptions, e);
    }
  }

  console.error('[MediaRecorder] Could not create a MediaRecorder with any supported configuration.');
  return null;
}
