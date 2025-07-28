export type AgentStatus = 'idle' | 'thinking' | 'speaking';

// Helper to manage a queue of audio buffers and play them sequentially
export const createAudioPlayer = (onStatusChange: (status: AgentStatus) => void) => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioQueue: ArrayBuffer[] = [];
  let isPlaying = false;

  const playNextInQueue = async () => {
    if (audioQueue.length === 0) {
      if (isPlaying) {
        isPlaying = false;
        onStatusChange('idle'); // Signal that playback has finished
      }
      return;
    }

    if (!isPlaying) {
      isPlaying = true;
      onStatusChange('speaking'); // Signal that playback is starting
    }

    const audioData = audioQueue.shift();
    if (!audioData) return;

    try {
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = playNextInQueue; // Play next when this one finishes
      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
      playNextInQueue(); // Try the next item in the queue
    }
  };

  const addToQueue = (base64Audio: string) => {
    const binaryString = window.atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    audioQueue.push(bytes.buffer);

    if (!isPlaying) {
      playNextInQueue();
    }
  };

  return { addToQueue };
};