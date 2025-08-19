import { useCallback, useRef, useEffect } from "react";
import api from "../services/apiService";
import type { Message } from "../types/chat";

interface UseChatHistoryOptions {
  onHistoryLoaded: (messages: Message[]) => void;
}

export const useChatHistory = (
  token: string,
  options: UseChatHistoryOptions,
) => {
  const malformed = !token || token.split(".").length !== 3;
  const stableOptionsRef = useRef(options);
  
  useEffect(() => {
    stableOptionsRef.current = options;
  }, [options]);
  const loadHistory = useCallback(async () => {
    if (!token) {
      console.warn("📭 No token available for chat history request");
      return;
    }
    if (malformed) {
      console.warn("📭 Skipping chat history; token malformed");
      return;
    }

    try {
      console.log("🔍 Loading chat history...");

      const response = await api.get("/api/chat/history");

      console.log("📡 Chat history response status:", response.status);

      if (!response.success) {
        console.warn("❌ Chat history fetch blocked (non-ok)", response.status, response.error);
        return; // Do not throw to avoid promise rejection spam
      }

      console.log("📨 Chat history data received:", response.data);

      const conversations = response.data?.conversations || [];
      stableOptionsRef.current.onHistoryLoaded(conversations);
    } catch (error) {
      console.warn("Error loading chat history (suppressed):", error);
    }
  }, [token, malformed]); // Remove options.onHistoryLoaded from dependencies to prevent excessive reruns

  const clearHistory = useCallback(async () => {
    if (!token) return;

    const response = await api.delete("/api/chat/history");

    if (!response.success) {
      throw new Error("Failed to clear chat history");
    }
  }, [token]);

  return {
    loadHistory,
    clearHistory,
  };
};
