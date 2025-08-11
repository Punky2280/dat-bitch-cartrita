// Unified backend base URL resolution.
// Prefer explicit websocket URL if provided, else fall back to HTTP backend URL.
// Keep final fallback to localhost:8001 (backend default PORT).
export const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8001";
export const SOCKET_URL =
  import.meta.env.VITE_BACKEND_WS_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:8001";

export const SOCKET_CONFIG = {
  transports: ["websocket", "polling"],
  withCredentials: true,
  timeout: 20000,
  forceNew: false,
  reconnection: true,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 8000,
  randomizationFactor: 0.4,
  reconnectionAttempts: 6,
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
