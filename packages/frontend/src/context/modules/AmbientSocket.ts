import { io, Socket } from 'socket.io-client';

export function connectAmbientSocket(token: string): Socket {
  const socket = io('/ambient', {
    auth: { token },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('[AmbientSocket] Connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('[AmbientSocket] Disconnected.');
  });

  socket.on('proactive_response', (data) => {
    console.log('[AmbientSocket] Response:', data.response.text);
    if (data.response.audio) {
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.response.audio), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play().catch(console.error);
      audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl));
    }
  });

  socket.on('visual_analysis', (data) => {
    console.log('[AmbientSocket] Visual analysis:', data.analysis);
  });

  return socket;
}
