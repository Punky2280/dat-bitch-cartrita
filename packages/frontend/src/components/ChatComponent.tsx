import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import io, { Socket } from 'socket.io-client';
import { VoiceToTextButton } from './VoiceToTextButton';

interface ChatComponentProps {
  token: string;
}

interface Message {
  id: number;
  speaker: 'user' | 'cartrita';
  text: string;
  created_at: string;
  model?: string;
}

interface ConnectionStats {
  connected: boolean;
  reconnectAttempts: number;
  latency: number;
  lastPing: Date | null;
}

interface ChatStats {
  totalMessages: number;
  userMessages: number;
  cartritaMessages: number;
  conversationStarted: Date | null;
}

export const ChatComponent = ({ token }: ChatComponentProps) => {
  const { i18n } = useTranslation();
  // State hooks for managing chat data and UI
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    connected: false,
    reconnectAttempts: 0,
    latency: 0,
    lastPing: null,
  });
  const [chatStats, setChatStats] = useState<ChatStats>({
    totalMessages: 0,
    userMessages: 0,
    cartritaMessages: 0,
    conversationStarted: null,
  });
  const [isTyping, setIsTyping] = useState(false);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs for DOM elements and other non-state values
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // --- FIX: Using a more portable type for timer IDs ---
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scrolls the message container to the bottom smoothly
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest',
      });
    }
  }, []);

  // Effect to auto-scroll when new messages are added
  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  // Updates chat statistics when a new message is added
  const updateChatStats = useCallback((newMessage: Message) => {
    setChatStats(prev => {
      const isUser = newMessage.speaker === 'user';
      const isCartrita = newMessage.speaker === 'cartrita';

      return {
        totalMessages: prev.totalMessages + 1,
        userMessages: prev.userMessages + (isUser ? 1 : 0),
        cartritaMessages: prev.cartritaMessages + (isCartrita ? 1 : 0),
        conversationStarted: prev.conversationStarted || new Date(),
      };
    });
  }, []);

  // Sets up an interval to ping the server and measure latency
  const startPingMonitoring = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        const startTime = Date.now();
        socketRef.current.emit('ping', startTime);
      }
    }, 5000);
  }, []);

  // Fetches the initial chat history from the server
  const loadChatHistory = useCallback(async () => {
    if (!token) {
      console.log('[ChatComponent] ⚠️ No token available, skipping chat history load');
      return;
    }
    
    try {
      console.log('[ChatComponent] 🔍 Loading chat history with token:', token ? 'present' : 'missing');
      setIsLoading(true);
      const response = await fetch('/api/chat/history', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load chat history: ${response.statusText}`);
      }

      const data = await response.json();
      const conversations = data.conversations || [];

      setMessages(conversations);

      setChatStats({
        totalMessages: conversations.length,
        userMessages: conversations.filter((m: Message) => m.speaker === 'user')
          .length,
        cartritaMessages: conversations.filter(
          (m: Message) => m.speaker === 'cartrita'
        ).length,
        conversationStarted:
          conversations.length > 0
            ? new Date(conversations[0].created_at)
            : null,
      });
    } catch (error) {
      console.error('Error loading chat history:', error);
      setConnectionError(
        `Failed to load chat history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Main effect for setting up and managing the socket connection
  useEffect(() => {
    if (!token) {
      console.log('[ChatComponent] ⚠️ No token available, skipping socket connection');
      return;
    }

    loadChatHistory();

    const connectSocket = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      console.log('[ChatComponent] 🔗 Connecting to socket with token');
      // Corrected socket.io configuration
      const socket = io('http://localhost:8000', {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      // --- Socket Event Handlers ---
      socket.on('connect', () => {
        console.log('🔗 Connected to Cartrita server');
        setIsConnected(true);
        setConnectionError(null);
        setConnectionStats(prev => ({
          ...prev,
          connected: true,
          reconnectAttempts: 0,
        }));
        startPingMonitoring();
      });

      socket.on('disconnect', reason => {
        console.log('🔌 Disconnected from server:', reason);
        setIsConnected(false);
        setIsTyping(false);
        setConnectionStats(prev => ({ ...prev, connected: false }));
        if (reason === 'io server disconnect') {
          setConnectionError('Connection terminated by server');
        }
      });

      socket.on('connect_error', error => {
        console.error('❌ Connection error:', error);
        setConnectionError(`Connection failed: ${error.message}`);
        setConnectionStats(prev => ({
          ...prev,
          reconnectAttempts: prev.reconnectAttempts + 1,
        }));
      });

      const handleIncomingMessage = (data: {
        speaker?: 'user' | 'cartrita';
        text: string;
        timestamp?: string;
        model?: string;
      }) => {
        const newMessage: Message = {
          id: Date.now() + Math.random(),
          speaker: data.speaker || 'cartrita',
          text: data.text,
          created_at: data.timestamp || new Date().toISOString(),
          model: data.model,
        };
        setMessages(prev => [...prev, newMessage]);
        updateChatStats(newMessage);
        setIsLoading(false);
        setIsTyping(false);
      };

      socket.on('chat message', handleIncomingMessage);
      socket.on('message', handleIncomingMessage);
      socket.on('typing', () => setIsTyping(true));
      socket.on('stopTyping', () => setIsTyping(false));

      socket.on('pong', (startTime: number) => {
        const latency = Date.now() - startTime;
        setConnectionStats(prev => ({
          ...prev,
          latency,
          lastPing: new Date(),
        }));
      });

      socket.on('error', (error: any) => {
        console.error('🚨 Socket error:', error);
        setConnectionError(`Socket error: ${error.message || 'Unknown error'}`);
        setIsLoading(false);
        setIsTyping(false);
      });
    };

    connectSocket();

    // Cleanup function to disconnect socket on component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [token, loadChatHistory, updateChatStats, startPingMonitoring]);

  // Sends a message from the user to the server
  const sendMessage = useCallback(async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || !isConnected || isLoading) return;

    setMessageHistory(prev => [trimmedText, ...prev.slice(0, 49)]);
    setHistoryIndex(-1);

    const userMessage: Message = {
      id: Date.now(),
      speaker: 'user',
      text: trimmedText,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    updateChatStats(userMessage);
    setIsLoading(true);
    setInputText('');

    if (socketRef.current) {
      socketRef.current.emit('chat message', {
        text: trimmedText,
        timestamp: new Date().toISOString(),
        language: i18n.language || 'en',
      });
    }

    inputRef.current?.focus();
  }, [inputText, isConnected, isLoading, updateChatStats, i18n.language]);

  // Handles keyboard events in the textarea for sending messages and history navigation
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      } else if (e.key === 'ArrowUp' && e.ctrlKey) {
        e.preventDefault();
        if (historyIndex < messageHistory.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setInputText(messageHistory[newIndex]);
        }
      } else if (e.key === 'ArrowDown' && e.ctrlKey) {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInputText(messageHistory[newIndex]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInputText('');
        }
      }
    },
    [sendMessage, historyIndex, messageHistory]
  );

  // Handles input changes and auto-resizes the textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
      const textarea = e.target;
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    },
    []
  );

  // Handles voice-to-text transcript
  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      const newText = inputText ? `${inputText} ${transcript}` : transcript;
      setInputText(newText);

      // Auto-resize textarea after adding voice input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height =
            Math.min(inputRef.current.scrollHeight, 120) + 'px';
          inputRef.current.focus();
        }
      }, 0);
    },
    [inputText]
  );

  // Clears the chat history on the server and client
  const clearChat = useCallback(async () => {
    if (
      !window.confirm(
        'Are you sure you want to clear all chat history? This action cannot be undone.'
      )
    ) {
      return;
    }
    try {
      const response = await fetch('/api/chat/history', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        setMessages([]);
        setChatStats({
          totalMessages: 0,
          userMessages: 0,
          cartritaMessages: 0,
          conversationStarted: null,
        });
      }
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  }, [token]);

  // Formats message text to render basic markdown (bold, italics, code)
  const formatMessageText = useCallback((text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }, []);

  return (
    <div className="glass-card rounded-xl h-[700px] flex flex-col overflow-hidden">
      {/* Header Section */}
      <div className="p-4 border-b border-gray-600/50 bg-gradient-to-r from-gray-800/80 to-gray-700/80">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gradient">
              Chat with Cartrita
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {chatStats.totalMessages > 0
                ? `${chatStats.totalMessages} messages • Started ${chatStats.conversationStarted?.toLocaleDateString()}`
                : 'Start a new conversation'}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isConnected
                    ? 'bg-green-500 shadow-lg shadow-green-500/50 status-pulse'
                    : 'bg-red-500 shadow-lg shadow-red-500/50'
                }`}
              ></div>
              <div className="text-right">
                <span className="text-sm text-gray-300 block">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
                {connectionStats.latency > 0 && (
                  <span className="text-xs text-gray-500">
                    {connectionStats.latency}ms
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={clearChat}
              className="text-gray-400 hover:text-red-400 transition-colors p-1 rounded"
              title="Clear chat history"
            >
              🗑️
            </button>
          </div>
        </div>
        {connectionError && (
          <div className="mt-2 p-2 bg-red-900/50 border border-red-500/50 rounded text-red-200 text-sm">
            ⚠️ {connectionError}
          </div>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-16">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">Ready to Chat!</h3>
            <p className="text-gray-500">
              Start a conversation with Cartrita. She&apos;s sassy, smart, and ready
              to help.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 max-w-md mx-auto">
              <button
                onClick={() => setInputText('Hello Cartrita!')}
                className="text-left p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-sm"
              >
                💬 Say hello
              </button>
              <button
                onClick={() => setInputText('What can you help me with?')}
                className="text-left p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-sm"
              >
                ❓ Ask what she can do
              </button>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex message-appear ${
                message.speaker === 'user' ? 'justify-end' : 'justify-start'
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-lg ${
                  message.speaker === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md'
                    : 'bg-gradient-to-br from-gray-700 to-gray-800 text-gray-100 rounded-bl-md'
                }`}
              >
                <div
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: formatMessageText(message.text),
                  }}
                />
                <div
                  className={`flex justify-between items-center mt-2 text-xs opacity-70`}
                >
                  <span>
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {message.model && (
                    <span className="ml-2 px-1.5 py-0.5 bg-black/20 rounded text-[10px]">
                      {message.model}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {(isLoading || isTyping) && (
          <div className="flex justify-start message-appear">
            <div className="bg-gradient-to-br from-gray-700 to-gray-800 px-4 py-3 rounded-2xl rounded-bl-md shadow-lg">
              <div className="flex items-center space-x-1">
                <span className="text-sm text-gray-300">
                  Cartrita is thinking
                </span>
                <div className="typing-indicator ml-2">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-600/50 bg-gray-800/30">
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Type your message or use voice input... (Ctrl+↑/↓ for history)"
              className="w-full input-enhanced px-4 py-3 pr-12 rounded-xl resize-none min-h-[48px] max-h-[120px] text-sm leading-relaxed"
              disabled={!isConnected || isLoading}
              rows={1}
            />
            {/* Voice-to-Text Button */}
            <div className="absolute right-2 bottom-2">
              <VoiceToTextButton
                onTranscript={handleVoiceTranscript}
                disabled={!isConnected || isLoading}
                token={token}
              />
            </div>
            {inputText.length > 0 && (
              <div className="absolute bottom-1 right-14 text-xs text-gray-500">
                {inputText.length}/2000
              </div>
            )}
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || !isConnected || isLoading}
            className="btn-skittles px-6 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="spinner w-4 h-4"></div>
                <span>Sending</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <span>💫</span>
              </>
            )}
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500 flex justify-between">
          <span>Press Enter to send, Shift+Enter for new line</span>
          {messageHistory.length > 0 && (
            <span>Ctrl+↑/↓ to navigate message history</span>
          )}
        </div>
      </div>
    </div>
  );
};
