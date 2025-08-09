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
      options.onMessage(newMessage);
      setIsTyping(false);
    },
    [options],
  );

  useEffect(() => {
    if (!token) return;

    console.log("🔌 Establishing socket connection...");

    const socket = io(SOCKET_URL, {
      ...SOCKET_CONFIG,
      auth: { token },
    });

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
      options.onConnect();
      startPingMonitoring();
    });

    socket.on("disconnect", (reason: string) => {
      console.log("🔌 Disconnected:", reason);
      setIsConnected(false);
      setConnectionStats((prev) => ({ ...prev, connected: false, latency: 0 }));
      options.onDisconnect();

      if (reason === "transport close" || reason === "transport error") {
        console.log("🔄 Transport issue detected, will retry with polling");
        setConnectionError("Connection lost, retrying...");
      }
    });

    socket.on("connect_error", (error: any) => {
      console.error("❌ Connection error:", error);
      const errorMessage =
        error.message || error.type || "Unknown connection error";
      setConnectionError(`Connection failed: ${errorMessage}`);
      setConnectionStats((prev) => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1,
      }));
    });

    socket.on("pong", (startTime: number) => {
      const latency = Date.now() - startTime;
      setConnectionStats((prev) => ({
        ...prev,
        latency,
        lastPing: new Date(),
      }));
    });

    socket.on("agent_response", handleIncomingMessage);
    socket.on("typing", () => setIsTyping(true));
    socket.on("stopTyping", () => setIsTyping(false));

    socket.on("error", (error: any) => {
      console.error("🚨 Socket error:", error);
      const errorMessage = error.message || error.type || "Socket error";
      setConnectionError(`Socket error: ${errorMessage}`);
      setIsTyping(false);
    });

    return () => {
      socket.disconnect();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [token, options, handleIncomingMessage, startPingMonitoring]);

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

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    connectionStats,
    isTyping,
    sendMessage,
    clearConnectionError,
  };
};
