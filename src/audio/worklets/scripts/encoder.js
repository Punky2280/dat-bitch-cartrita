/* global AudioWorkletProcessor, registerProcessor */
class AudioEncoderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0][0];
    if (input) {
      const float32 = new Float32Array(input);
      this.port.postMessage(float32.buffer);
    }
    return true;
  }
}
registerProcessor('audio-encoder', AudioEncoderProcessor);
