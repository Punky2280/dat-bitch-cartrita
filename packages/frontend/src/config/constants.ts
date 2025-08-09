export const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8001";
export const SOCKET_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8001";

export const SOCKET_CONFIG = {
  transports: ["polling", "websocket"],
  withCredentials: true,
  timeout: 30000,
  forceNew: true,
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.5,
  reconnectionAttempts: 10,
};

export const CHAT_SUGGESTIONS = [
  { text: "Hello Cartrita!", icon: "💬", label: "Say hello" },
  { text: "What time is it?", icon: "⏰", label: "Ask for the time" },
  {
    text: "Create an image of a sunset",
    icon: "🎨",
    label: "Generate an image",
  },
  {
    text: "What can you help me with?",
    icon: "❓",
    label: "Ask what she can do",
  },
];
