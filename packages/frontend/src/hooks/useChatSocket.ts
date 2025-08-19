import { useState, useEffect, useRef, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import { SOCKET_URL, SOCKET_CONFIG } from "../config/constants";
import type { Message, ConnectionStats } from "../types/chat";

interface UseChatSocketOptions {
  onMessage: (message: Message) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const useChatSocket = (token: string, options: UseChatSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    connected: false,
    reconnectAttempts: 0,
    latency: 0,
    lastPing: null,
  });
  const [isTyping, setIsTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stableHandlersRef = useRef(options);
  const lastTokenRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRetryAttempts = 5;

  const startPingMonitoring = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        const startTime = Date.now();
        socketRef.current.emit("ping", startTime);
      }
    }, 5000);
  }, []);

  const handleIncomingMessage = useCallback(
    (data: any) => {
      const newMessage: Message = {
        id: Date.now() + Math.random(),
        speaker: data.speaker || "cartrita",
        text: data.text,
        created_at: data.timestamp || new Date().toISOString(),
        model: data.model,
        tools_used: data.tools_used || [],
        response_time_ms: data.response_time_ms,
        intent_analysis: data.intent_analysis,
        performance_score: data.performance_score,
        request_id: data.request_id,
      };
      stableHandlersRef.current.onMessage(newMessage);
      setIsTyping(false);
    },
    []
  );

  useEffect(() => {
    stableHandlersRef.current = options; // always latest but ref identity stable
  }, [options]);

  useEffect(() => {
    if (!token) return;
    if (token.split('.').length !== 3) {
      console.warn('🔒 Skipping socket connect: malformed token');
      return;
    }
    
    // Skip if token hasn't actually changed or if socket is connecting/connected
    if (lastTokenRef.current === token && socketRef.current) {
      if (socketRef.current.connected || socketRef.current.connecting) {
        console.log('🔗 Token unchanged and socket active, skipping reconnection');
        return;
      }
    }
    
    lastTokenRef.current = token;
    
    // Properly cleanup existing socket before creating new one
    if (socketRef.current) {
      console.log('🔌 Cleaning up existing socket before reconnection...');
      socketRef.current.removeAllListeners();
      if (socketRef.current.connected) {
        socketRef.current.disconnect();
      }
      socketRef.current = null;
    }
    
    console.log('🔗 Creating new socket connection...');
    console.log('🔗 Socket URL:', SOCKET_URL);
    
    // Enhanced socket configuration with better error handling
    const socketConfig = {
      ...SOCKET_CONFIG,
      auth: { token },
      // Add query params for better debugging
      query: {
        version: '1.0.0',
        client: 'web'
      }
    };
    
    const socket = io(SOCKET_URL, socketConfig);
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🔗 Connected to Cartrita server");
      console.log("🔍 Socket ID:", socket.id);
      setIsConnected(true);
      setConnectionError(null);
      setConnectionStats((prev) => ({
        ...prev,
        connected: true,
        reconnectAttempts: 0,
      }));
      stableHandlersRef.current.onConnect();
      startPingMonitoring();
    });

    socket.on("disconnect", (reason: string) => {
      console.log("🔌 Disconnected:", reason);
      setIsConnected(false);
      setConnectionStats((prev) => ({ ...prev, connected: false, latency: 0 }));
      stableHandlersRef.current.onDisconnect();
      if (reason === "transport close" || reason === "transport error") {
        setConnectionError("Connection lost, retrying...");
      }
    });

    socket.on("connect_error", (error: any) => {
      console.error("🚨 Connect error:", error);
      
      // Enhanced error handling based on error type
      let errorMessage = "Connection failed";
      if (error.message?.includes('ECONNREFUSED')) {
        errorMessage = "Server is not available. Please check if the backend is running.";
      } else if (error.message?.includes('timeout')) {
        errorMessage = "Connection timed out. Please try again.";
      } else if (error.type === 'TransportError') {
        errorMessage = "Network connection failed. Please check your internet connection.";
      } else {
        errorMessage = `Connection failed: ${error.message || error.type || 'Unknown error'}`;
      }
      
      setConnectionError(errorMessage);
      setConnectionStats(prev => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));
    });

    socket.on("pong", (startTime: number) => {
      const latency = Date.now() - startTime;
      setConnectionStats((prev) => ({ ...prev, latency }));
    });

    socket.on("agent_response", handleIncomingMessage);
    socket.on("typing", () => setIsTyping(true));
    socket.on("stopTyping", () => setIsTyping(false));

    socket.on("error", (error: any) => {
      console.error("🚨 Socket error:", error);
      console.error("🚨 Socket error details:", JSON.stringify(error, null, 2));
      const errorMessage = error.message || error.type || error.description || "Unknown socket error";
      setConnectionError(`Socket error: ${errorMessage}`);
      setIsTyping(false);
    });

    return () => {
      console.log('🔌 Cleaning up socket connection...');
      try {
        if (socket) {
          socket.removeAllListeners();
          if (socket.connected) {
            socket.disconnect();
          }
        }
      } catch (error) {
        console.warn('Error during socket cleanup:', error);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [token, SOCKET_URL]);

  const sendMessage = useCallback((text: string, language = "en") => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit("user_message", {
      text,
      timestamp: new Date().toISOString(),
      language,
    });
  }, []);

  const clearConnectionError = useCallback(() => {
    setConnectionError(null);
  }, []);

  const retryConnection = useCallback(() => {
    if (!token || connectionStats.reconnectAttempts >= maxRetryAttempts) {
      console.log('🚫 Max retry attempts reached or no token available');
      return;
    }

    console.log(`🔄 Retrying connection (attempt ${connectionStats.reconnectAttempts + 1}/${maxRetryAttempts})`);
    setConnectionError(null);
    
    // Force cleanup of existing socket
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      if (socketRef.current.connected) {
        socketRef.current.disconnect();
      }
      socketRef.current = null;
    }
    
    // Reset token ref to force reconnection
    lastTokenRef.current = null;
    
    // Trigger reconnection with a small delay
    retryTimeoutRef.current = setTimeout(() => {
      // This will trigger the useEffect to create a new connection
      lastTokenRef.current = token;
    }, 1000);
  }, [token, connectionStats.reconnectAttempts, maxRetryAttempts]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    connectionStats,
    isTyping,
    sendMessage,
    clearConnectionError,
    retryConnection,
  };
};
