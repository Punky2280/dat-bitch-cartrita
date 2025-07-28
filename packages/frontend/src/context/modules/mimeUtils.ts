export function getSupportedMimeType(): string | undefined {
  const types = [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus'
  ];
  return types.find(MediaRecorder.isTypeSupported);
}
