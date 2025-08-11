import { useCallback } from "react";
import { API_BASE_URL } from "../config/constants";
import type { Message } from "../types/chat";

interface UseChatHistoryOptions {
  onHistoryLoaded: (messages: Message[]) => void;
}

export const useChatHistory = (
  token: string,
  options: UseChatHistoryOptions,
) => {
  const malformed = !token || token.split(".").length !== 3;
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

      const response = await fetch(`${API_BASE_URL}/api/chat/history`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("📡 Chat history response status:", response.status);

      if (!response.ok) {
        const errText = await response.text();
        console.warn("❌ Chat history fetch blocked (non-ok)", response.status, errText);
        return; // Do not throw to avoid promise rejection spam
      }

      const data = await response.json();
      console.log("📨 Chat history data received:", data);

      const conversations = data.conversations || [];
      options.onHistoryLoaded(conversations);
    } catch (error) {
      console.warn("Error loading chat history (suppressed):", error);
    }
  }, [token, malformed, options.onHistoryLoaded]);

  const clearHistory = useCallback(async () => {
    if (!token) return;

    const response = await fetch(`${API_BASE_URL}/api/chat/history`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Failed to clear chat history");
    }
  }, [token]);

  return {
    loadHistory,
    clearHistory,
  };
};
