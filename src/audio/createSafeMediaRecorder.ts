export function createSafeMediaRecorder(stream, options) {
  // MediaRecorder instantiation with MIME negotiation
  return new MediaRecorder(stream, options);
}
