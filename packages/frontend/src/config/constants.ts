// Unified backend base URL resolution.
// In development, use the Vite proxy to avoid CORS issues
// In production, use explicit backend URL
export const API_BASE_URL = import.meta.env.DEV 
  ? "" // Use relative URLs in dev mode to leverage Vite proxy
  : import.meta.env.VITE_BACKEND_URL || "http://localhost:8001";

export const SOCKET_URL = import.meta.env.DEV
  ? "" // Use relative URLs in dev mode to leverage Vite proxy  
  : import.meta.env.VITE_BACKEND_WS_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    "http://localhost:8001";

export const SOCKET_CONFIG = {
  transports: ["websocket", "polling"],
  withCredentials: true,
  timeout: 20000,
  forceNew: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  reconnectionAttempts: 10,
  // Add upgrade options for better WebSocket handling
  upgrade: true,
  rememberUpgrade: true,
  // Add autoConnect to prevent immediate connection
  autoConnect: true,
  // Add additional error handling options
  closeOnBeforeunload: false,
};

// Fallback configuration for problematic connections
export const SOCKET_CONFIG_FALLBACK = {
  ...SOCKET_CONFIG,
  transports: ["polling"], // Force polling if WebSocket fails
  upgrade: false,
  reconnectionDelay: 2000,
  reconnectionAttempts: 5,
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
