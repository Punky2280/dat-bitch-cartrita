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
  tools_used?: string[];
  response_time_ms?: number;
  intent_analysis?: {
    primary_intent: string;
    primary_confidence: number;
    prompt_complexity: number;
  };
  performance_score?: number;
  request_id?: string;
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
  averageResponseTime: number;
  toolsUsed: number;
  totalPerformanceScore: number;
}

interface AgentMetrics {
  requests_processed: number;
  successful_responses: number;
  failed_responses: number;
  tools_used_total: number;
  average_response_time: number;
  user_interactions: number;
  personality_adaptations: number;
  streaming_sessions: number;
  cache_hits: number;
  cache_misses: number;
  intent_accuracy: number;
  tool_selection_accuracy: number;
  uptime: number;
}

interface AgentHealth {
  healthy: boolean;
  issues: string[];
  uptime: number;
  success_rate: string;
  cache_hit_rate: string;
}

export const ChatComponent = ({ token }: ChatComponentProps) => {
  const { i18n } = useTranslation();
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
    averageResponseTime: 0,
    toolsUsed: 0,
    totalPerformanceScore: 0,
  });
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics | null>(null);
  const [agentHealth, setAgentHealth] = useState<AgentHealth | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  const updateChatStats = useCallback((newMessage: Message) => {
    setChatStats(prev => {
      const newStats = {
        totalMessages: prev.totalMessages + 1,
        userMessages:
          prev.userMessages + (newMessage.speaker === 'user' ? 1 : 0),
        cartritaMessages:
          prev.cartritaMessages + (newMessage.speaker === 'cartrita' ? 1 : 0),
        conversationStarted: prev.conversationStarted || new Date(),
        toolsUsed: prev.toolsUsed + (newMessage.tools_used?.length || 0),
        totalPerformanceScore:
          prev.totalPerformanceScore + (newMessage.performance_score || 0),
        averageResponseTime: 0,
      };

      // Calculate average response time for Cartrita messages
      if (newMessage.speaker === 'cartrita' && newMessage.response_time_ms) {
        const totalResponseTime =
          prev.averageResponseTime * (prev.cartritaMessages - 1) +
          newMessage.response_time_ms;
        newStats.averageResponseTime =
          totalResponseTime / newStats.cartritaMessages;
      } else {
        newStats.averageResponseTime = prev.averageResponseTime;
      }

      return newStats;
    });
  }, []);

  const fetchAgentMetrics = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('http://localhost:8000/api/agent/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAgentMetrics(data.metrics);
        setAgentHealth(data.health);
      }
    } catch (error) {
      console.error('Error fetching agent metrics:', error);
    }
  }, [token]);

  const startPingMonitoring = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        const startTime = Date.now();
        socketRef.current.emit('ping', startTime);
      }
    }, 5000);
  }, []);

  const startMetricsMonitoring = useCallback(() => {
    if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
    metricsIntervalRef.current = setInterval(() => {
      fetchAgentMetrics();
    }, 10000); // Update every 10 seconds
  }, [fetchAgentMetrics]);

  const loadChatHistory = useCallback(async () => {
    if (!token) {
      console.warn('📭 No token available for chat history request');
      return;
    }
    
    try {
      setIsLoading(true);
      console.log('🔍 Loading chat history with token:', token.substring(0, 20) + '...');
      
      const response = await fetch('http://localhost:8000/api/chat/history', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 Chat history response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Chat history error response:', errorText);
        throw new Error(`Failed to load history: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📨 Chat history data received:', data);
      
      const conversations = data.conversations || [];
      setMessages(conversations);

      // Calculate enhanced chat stats
      const userMsgs = conversations.filter(
        (m: Message) => m.speaker === 'user'
      ).length;
      const cartritaMsgs = conversations.filter(
        (m: Message) => m.speaker === 'cartrita'
      ).length;
      const totalTools = conversations.reduce(
        (sum: number, m: Message) => sum + (m.tools_used?.length || 0),
        0
      );
      const totalPerformance = conversations.reduce(
        (sum: number, m: Message) => sum + (m.performance_score || 0),
        0
      );
      const responseTimes = conversations
        .filter((m: Message) => m.response_time_ms)
        .map((m: Message) => m.response_time_ms! as number);
      const avgResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((a: number, b: number) => a + b, 0) /
            responseTimes.length
          : 0;

      setChatStats({
        totalMessages: conversations.length,
        userMessages: userMsgs,
        cartritaMessages: cartritaMsgs,
        conversationStarted:
          conversations.length > 0
            ? new Date(conversations[0].created_at)
            : null,
        averageResponseTime: avgResponseTime,
        toolsUsed: totalTools,
        totalPerformanceScore: totalPerformance,
      });
    } catch (error) {
      console.error('Error loading chat history:', error);
      setConnectionError(
        `Failed to load history: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    loadChatHistory();
    fetchAgentMetrics();

    const socket = io('http://localhost:8000', {
      auth: { token },
      transports: ['polling', 'websocket'],
      withCredentials: true,
      timeout: 30000,
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    const handleIncomingMessage = (data: any) => {
      const newMessage: Message = {
        id: Date.now() + Math.random(),
        speaker: data.speaker || 'cartrita',
        text: data.text,
        created_at: data.timestamp || new Date().toISOString(),
        model: data.model,
        tools_used: data.tools_used || [],
        response_time_ms: data.response_time_ms,
        intent_analysis: data.intent_analysis,
        performance_score: data.performance_score,
        request_id: data.request_id,
      };
      setMessages(prev => [...prev, newMessage]);
      updateChatStats(newMessage);
      setIsLoading(false);
      setIsTyping(false);
    };

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
      startMetricsMonitoring();
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
      setIsConnected(false);
      setConnectionStats(prev => ({ ...prev, connected: false, latency: 0 }));
    });

    socket.on('connect_error', (error: any) => {
      console.error('❌ Connection error:', error);
      setConnectionError(
        `Connection failed: ${error.message || error.type || 'Unknown error'}`
      );
      setConnectionStats(prev => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1,
      }));
    });

    socket.on('disconnect', (reason: string) => {
      console.log('🔌 Disconnected:', reason);
      setIsConnected(false);
      setConnectionStats(prev => ({ ...prev, connected: false, latency: 0 }));

      if (reason === 'transport close' || reason === 'transport error') {
        console.log('🔄 Transport issue detected, will retry with polling');
        setConnectionError('Connection lost, retrying...');
      }
    });

    socket.on('pong', (startTime: number) => {
      const latency = Date.now() - startTime;
      setConnectionStats(prev => ({ ...prev, latency, lastPing: new Date() }));
    });

    socket.on('agent_response', handleIncomingMessage);
    socket.on('typing', () => setIsTyping(true));
    socket.on('stopTyping', () => setIsTyping(false));
    socket.on('error', (error: any) => {
      console.error('🚨 Socket error:', error);
      setConnectionError(`Socket error: ${error.message || 'Unknown error'}`);
      setIsLoading(false);
      setIsTyping(false);
    });

    return () => {
      socket.disconnect();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
    };
  }, [
    token,
    loadChatHistory,
    updateChatStats,
    startPingMonitoring,
    startMetricsMonitoring,
    fetchAgentMetrics,
  ]);

  const sendMessage = useCallback(() => {
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

    socketRef.current?.emit('user_message', {
      text: trimmedText,
      timestamp: new Date().toISOString(),
      language: i18n.language || 'en',
    });

    inputRef.current?.focus();
  }, [inputText, isConnected, isLoading, updateChatStats, i18n.language]);

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

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
    },
    []
  );

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setInputText(prev => `${prev} ${transcript}`.trim());
  }, []);

  const clearChat = useCallback(async () => {
    if (!window.confirm('Are you sure you want to clear all chat history?'))
      return;
    try {
      const response = await fetch('http://localhost:8000/api/chat/history', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setMessages([]);
        setChatStats({
          totalMessages: 0,
          userMessages: 0,
          cartritaMessages: 0,
          conversationStarted: null,
          averageResponseTime: 0,
          toolsUsed: 0,
          totalPerformanceScore: 0,
        });
      }
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  }, [token]);

  const formatMessageText = useCallback((text: string) => {
    if (typeof text !== 'string') return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }, []);

  const formatUptime = useCallback((uptimeMs: number) => {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }, []);

  const getIntentIcon = useCallback((intent: string) => {
    const icons: { [key: string]: string } = {
      time_query: '⏰',
      image_generation: '🎨',
      coding: '💻',
      research: '🔍',
      conversation: '💬',
      general: '🤖',
    };
    return icons[intent] || '🤖';
  }, []);

  const getPerformanceColor = useCallback((score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-red-400';
  }, []);

  return (
    <div className="glass-card rounded-xl h-[700px] flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-600/50 bg-gradient-to-r from-gray-800/80 to-gray-700/80">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gradient">
              Chat with Cartrita
            </h2>
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-xs text-gray-400">
                {chatStats.totalMessages > 0
                  ? `${chatStats.totalMessages} messages`
                  : 'Start a new conversation'}
              </p>
              {chatStats.averageResponseTime > 0 && (
                <span className="text-xs text-blue-400">
                  ⚡ {Math.round(chatStats.averageResponseTime)}ms avg
                </span>
              )}
              {chatStats.toolsUsed > 0 && (
                <span className="text-xs text-purple-400">
                  🔧 {chatStats.toolsUsed} tools used
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${isConnected ? 'bg-green-500 shadow-lg shadow-green-500/50 status-pulse' : 'bg-red-500 shadow-lg shadow-red-500/50'}`}
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
              onClick={() => setShowMetrics(!showMetrics)}
              className={`text-gray-400 hover:text-blue-400 transition-colors p-1 rounded ${showMetrics ? 'text-blue-400' : ''}`}
              title="Toggle metrics"
            >
              📊
            </button>
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
        {showMetrics && (agentMetrics || agentHealth) && (
          <div className="mt-3 p-3 bg-gray-900/50 border border-gray-600/50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {agentMetrics && (
                <>
                  <div>
                    <span className="text-gray-400">Requests</span>
                    <div className="text-sm font-semibold text-blue-400">
                      {agentMetrics.requests_processed}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Success Rate</span>
                    <div className="text-sm font-semibold text-green-400">
                      {agentMetrics.requests_processed > 0
                        ? `${((agentMetrics.successful_responses / agentMetrics.requests_processed) * 100).toFixed(1)}%`
                        : '100%'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Avg Response</span>
                    <div className="text-sm font-semibold text-yellow-400">
                      {Math.round(agentMetrics.average_response_time)}ms
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Cache Hit Rate</span>
                    <div className="text-sm font-semibold text-purple-400">
                      {agentMetrics.cache_hits + agentMetrics.cache_misses > 0
                        ? `${((agentMetrics.cache_hits / (agentMetrics.cache_hits + agentMetrics.cache_misses)) * 100).toFixed(1)}%`
                        : '0%'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Intent Accuracy</span>
                    <div className="text-sm font-semibold text-cyan-400">
                      {(agentMetrics.intent_accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Tool Accuracy</span>
                    <div className="text-sm font-semibold text-orange-400">
                      {(agentMetrics.tool_selection_accuracy * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Uptime</span>
                    <div className="text-sm font-semibold text-gray-300">
                      {formatUptime(agentMetrics.uptime)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Health</span>
                    <div
                      className={`text-sm font-semibold ${agentHealth?.healthy ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {agentHealth?.healthy ? '✅ Healthy' : '⚠️ Issues'}
                    </div>
                  </div>
                </>
              )}
            </div>
            {agentHealth &&
              !agentHealth.healthy &&
              agentHealth.issues.length > 0 && (
                <div className="mt-2 text-xs text-red-300">
                  Issues: {agentHealth.issues.join(', ')}
                </div>
              )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-16">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">Ready to Chat!</h3>
            <p className="text-gray-500">
              Start a conversation with Cartrita. She&apos;s sassy, smart, and
              ready to help.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 max-w-md mx-auto">
              <button
                onClick={() => setInputText('Hello Cartrita!')}
                className="text-left p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-sm"
              >
                💬 Say hello
              </button>
              <button
                onClick={() => setInputText('What time is it?')}
                className="text-left p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-sm"
              >
                ⏰ Ask for the time
              </button>
              <button
                onClick={() => setInputText('Create an image of a sunset')}
                className="text-left p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 transition-colors text-sm"
              >
                🎨 Generate an image
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
              className={`flex message-appear ${message.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-lg ${message.speaker === 'user' ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md' : 'bg-gradient-to-br from-gray-700 to-gray-800 text-gray-100 rounded-bl-md'}`}
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
                  <div className="flex items-center space-x-2">
                    <span>
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {message.response_time_ms && (
                      <span className="text-blue-300">
                        ⚡{message.response_time_ms}ms
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    {message.intent_analysis && (
                      <span
                        title={`Intent: ${message.intent_analysis.primary_intent} (${(message.intent_analysis.primary_confidence * 100).toFixed(0)}%)`}
                      >
                        {getIntentIcon(message.intent_analysis.primary_intent)}
                      </span>
                    )}
                    {message.tools_used && message.tools_used.length > 0 && (
                      <span
                        title={`Tools: ${message.tools_used.join(', ')}`}
                        className="text-purple-300"
                      >
                        🔧{message.tools_used.length}
                      </span>
                    )}
                    {message.performance_score && (
                      <span
                        className={getPerformanceColor(
                          message.performance_score
                        )}
                        title={`Performance: ${message.performance_score}/100`}
                      >
                        📊{message.performance_score}
                      </span>
                    )}
                    {message.model && (
                      <span className="ml-2 px-1.5 py-0.5 bg-black/20 rounded text-[10px]">
                        {message.model}
                      </span>
                    )}
                  </div>
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
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
        {messageHistory.length > 0 && (
          <div className="mt-2 text-xs text-gray-500 text-center">
            Use Ctrl+↑/↓ to navigate message history ({messageHistory.length}{' '}
            saved)
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatComponent;
