'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { WebSocketManager, WebSocketHook, WebSocketMessage, getWebSocketConfig } from '@/lib/websocket';
import useAppStore from '@/store';
import { toast } from 'react-hot-toast';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

interface UseWebSocketReturn {
  ws: WebSocketManager | null;
  isConnected: boolean;
  connectionState: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  send: (message: Omit<WebSocketMessage, 'timestamp'>) => boolean;
  sendMessage: (conversationId: string, content: string) => boolean;
  sendTyping: (conversationId: string, isTyping: boolean) => boolean;
  sendToolCall: (conversationId: string, toolName: string, parameters: any) => boolean;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    autoConnect = true,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState(WebSocket.CLOSED);
  const wsRef = useRef<WebSocketManager | null>(null);
  const { user, token, addMessage, updateMessage, setTypingUsers } = useAppStore();

  // Initialize WebSocket manager
  const initializeWebSocket = useCallback(() => {
    if (!wsRef.current) {
      const config = getWebSocketConfig();
      if (token) {
        config.token = token;
      }
      wsRef.current = WebSocketHook.getInstance(config);
    }
    return wsRef.current;
  }, [token]);

  // Connect function
  const connect = useCallback(async () => {
    const ws = initializeWebSocket();
    
    try {
      await ws.connect();
      setIsConnected(true);
      setConnectionState(WebSocket.OPEN);
      onConnect?.();
      toast.success('Connected to Cartrita');
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
      setConnectionState(WebSocket.CLOSED);
      onError?.(error);
      toast.error('Failed to connect to Cartrita');
    }
  }, [initializeWebSocket, onConnect, onError]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
      setIsConnected(false);
      setConnectionState(WebSocket.CLOSED);
      onDisconnect?.();
    }
  }, [onDisconnect]);

  // Send generic message
  const send = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    if (!wsRef.current) {
      console.warn('WebSocket not initialized');
      return false;
    }
    return wsRef.current.send(message);
  }, []);

  // Send chat message
  const sendMessage = useCallback((conversationId: string, content: string) => {
    return send({
      type: 'message',
      data: {
        conversationId,
        content,
        role: 'user',
        userId: user?.id
      }
    });
  }, [send, user?.id]);

  // Send typing indicator
  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    return send({
      type: 'typing',
      data: {
        conversationId,
        isTyping,
        userId: user?.id
      }
    });
  }, [send, user?.id]);

  // Send tool call
  const sendToolCall = useCallback((conversationId: string, toolName: string, parameters: any) => {
    return send({
      type: 'tool_call',
      data: {
        conversationId,
        toolName,
        parameters,
        userId: user?.id
      }
    });
  }, [send, user?.id]);

  // Message handlers
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    // Handle incoming messages
    const handleMessage = (message: WebSocketMessage) => {
      onMessage?.(message);

      switch (message.type) {
        case 'message':
          // Add or update message in store
          if (message.data.id) {
            if (message.data.isStreaming) {
              updateMessage(message.data.id, {
                content: message.data.content,
                isStreaming: true
              });
            } else {
              addMessage(message.data);
            }
          }
          break;

        case 'typing':
          // Update typing indicators
          const { conversationId, userId, isTyping } = message.data;
          if (userId !== user?.id) {
            setTypingUsers(conversationId, userId, isTyping);
          }
          break;

        case 'tool_call':
          // Handle tool execution updates
          if (message.data.messageId) {
            updateMessage(message.data.messageId, {
              toolCalls: message.data.toolCalls
            });
          }
          break;

        case 'tool_result':
          // Handle tool results
          if (message.data.messageId && message.data.results) {
            updateMessage(message.data.messageId, {
              toolCalls: message.data.toolCalls
            });
          }
          break;

        case 'error':
          console.error('WebSocket error:', message.data);
          toast.error(message.data.message || 'An error occurred');
          break;

        case 'system':
          handleSystemMessage(message.data);
          break;
      }
    };

    // Handle system messages
    const handleSystemMessage = (data: any) => {
      switch (data.type) {
        case 'connected':
          setIsConnected(true);
          setConnectionState(WebSocket.OPEN);
          break;

        case 'disconnected':
          setIsConnected(false);
          setConnectionState(WebSocket.CLOSED);
          if (data.code !== 1000) {
            toast.error('Connection lost. Attempting to reconnect...');
          }
          break;

        case 'reconnected':
          setIsConnected(true);
          setConnectionState(WebSocket.OPEN);
          toast.success('Reconnected to Cartrita');
          break;

        case 'pong':
          // Heartbeat response - connection is healthy
          break;

        default:
          console.log('Unknown system message:', data);
      }
    };

    // Register event handlers
    ws.on('message', handleMessage);
    ws.on('system', (data) => handleSystemMessage(data.data));

    // Cleanup
    return () => {
      ws.off('message', handleMessage);
      ws.off('system', handleSystemMessage);
    };
  }, [onMessage, user?.id, addMessage, updateMessage, setTypingUsers]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && user && token) {
      connect();
    }

    return () => {
      if (wsRef.current) {
        disconnect();
      }
    };
  }, [autoConnect, user, token, connect, disconnect]);

  // Update connection state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current) {
        const newState = wsRef.current.readyState;
        setConnectionState(newState);
        setIsConnected(newState === WebSocket.OPEN);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    ws: wsRef.current,
    isConnected,
    connectionState,
    connect,
    disconnect,
    send,
    sendMessage,
    sendTyping,
    sendToolCall
  };
};

// Hook for WebSocket connection status
export const useWebSocketStatus = () => {
  const [status, setStatus] = useState({
    connected: false,
    connecting: false,
    reconnectAttempts: 0
  });

  useEffect(() => {
    const ws = WebSocketHook.getInstance();
    
    const updateStatus = () => {
      const info = ws.connectionInfo;
      setStatus({
        connected: info.connected,
        connecting: ws.readyState === WebSocket.CONNECTING,
        reconnectAttempts: info.attempts
      });
    };

    // Update status immediately
    updateStatus();

    // Set up periodic status updates
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  return status;
};

export default useWebSocket;