import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useReducer,
} from "react";
import { useTranslation } from "react-i18next";
import { VoiceToTextButton } from "./VoiceToTextButton";
import { useChatSocket } from "../hooks/useChatSocket";
import { useChatHistory } from "../hooks/useChatHistory";
import { useAgentMetrics } from "../hooks/useAgentMetrics";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessages } from "./chat/ChatMessages";
import { ChatInput } from "./chat/ChatInput";
import { MessageHistory } from "./chat/MessageHistory";
import { chatReducer, initialChatState } from "../reducers/chatReducer";
import { API_BASE_URL } from "../config/constants";
import type { Message, ChatComponentProps } from "../types/chat";

export const ChatComponent = ({ token }: ChatComponentProps) => {
  const { i18n } = useTranslation();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [inputText, setInputText] = useState("");
  const [showMetrics, setShowMetrics] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Custom hooks
  const {
    socket,
    isConnected,
    connectionError,
    connectionStats,
    isTyping,
    sendMessage: socketSendMessage,
    clearConnectionError,
  } = useChatSocket(token, {
    onMessage: (message: Message) =>
      dispatch({ type: "ADD_MESSAGE", payload: message }),
    onConnect: () => dispatch({ type: "SET_CONNECTED", payload: true }),
    onDisconnect: () => dispatch({ type: "SET_CONNECTED", payload: false }),
  });

  const { loadHistory, clearHistory } = useChatHistory(token, {
    onHistoryLoaded: (messages: Message[]) =>
      dispatch({ type: "SET_MESSAGES", payload: messages }),
  });

  const { agentMetrics, agentHealth } = useAgentMetrics(token, isConnected);

  // Message history for input navigation
  const messageHistory = new MessageHistory();

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [state.messages, scrollToBottom]);

  // Load initial data
  useEffect(() => {
    if (token) {
      loadHistory();
    }
  }, [token, loadHistory]);

  // Message sending
  const handleSendMessage = useCallback(() => {
    const trimmedText = inputText.trim();
    if (!trimmedText || !isConnected || state.isLoading) return;

    messageHistory.add(trimmedText);

    const userMessage: Message = {
      id: Date.now(),
      speaker: "user",
      text: trimmedText,
      created_at: new Date().toISOString(),
    };

    dispatch({ type: "ADD_MESSAGE", payload: userMessage });
    dispatch({ type: "SET_LOADING", payload: true });
    setInputText("");

    socketSendMessage(trimmedText, i18n.language || "en");
    inputRef.current?.focus();
  }, [
    inputText,
    isConnected,
    state.isLoading,
    socketSendMessage,
    i18n.language,
  ]);

  // Input handlers
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      } else if (e.key === "ArrowUp" && e.ctrlKey) {
        e.preventDefault();
        const prevMessage = messageHistory.getPrevious();
        if (prevMessage) setInputText(prevMessage);
      } else if (e.key === "ArrowDown" && e.ctrlKey) {
        e.preventDefault();
        const nextMessage = messageHistory.getNext();
        setInputText(nextMessage || "");
      }
    },
    [handleSendMessage],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
    },
    [],
  );

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setInputText((prev) => `${prev} ${transcript}`.trim());
  }, []);

  // Chat management
  const handleClearChat = useCallback(async () => {
    if (!window.confirm("Are you sure you want to clear all chat history?"))
      return;

    try {
      await clearHistory();
      dispatch({ type: "CLEAR_MESSAGES" });
    } catch (error) {
      console.error("Error clearing chat:", error);
    }
  }, [clearHistory]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputText(suggestion);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="backdrop-blur-xl bg-white/10 dark:bg-black/20 border border-white/20 rounded-xl h-[700px] flex flex-col overflow-hidden">
      <ChatHeader
        chatStats={state.chatStats}
        isConnected={isConnected}
        connectionStats={connectionStats}
        connectionError={connectionError}
        agentMetrics={agentMetrics}
        agentHealth={agentHealth}
        showMetrics={showMetrics}
        onToggleMetrics={() => setShowMetrics(!showMetrics)}
        onClearChat={handleClearChat}
        onClearError={clearConnectionError}
      />

      <ChatMessages
        messages={state.messages}
        isLoading={state.isLoading}
        isTyping={isTyping}
        messagesEndRef={messagesEndRef}
        onSuggestionClick={handleSuggestionClick}
      />

      <ChatInput
        inputText={inputText}
        isConnected={isConnected}
        isLoading={state.isLoading}
        messageHistoryCount={messageHistory.getCount()}
        inputRef={inputRef}
        onInputChange={handleInputChange}
        onKeyPress={handleKeyPress}
        onSendMessage={handleSendMessage}
        onVoiceTranscript={handleVoiceTranscript}
        token={token}
      />
    </div>
  );
};

export default ChatComponent;
