import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ProductionWebSocketManager } from '../services/ProductionWebSocketManager';

interface WebSocketContextType {
  socket: ProductionWebSocketManager;
  isConnected: boolean;
  connectionHealth: any;
  latency: number;
  queueSize: number;
  send: (event: string, data: any, options?: any) => string;
  subscribe: (event: string, handler: (data: any) => void) => () => void;
  unsubscribe: (event: string, handler: (data: any) => void) => void;
  reconnect: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  token?: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children, token }) => {
  const [socket] = useState(() => new ProductionWebSocketManager());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<any>({});
  const [latency, setLatency] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const previousToken = useRef<string | undefined>(token);

  // Connection management
  const connect = useCallback(async () => {
    if (!token) return;
    try {
      await socket.connect(token);
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }, [socket, token]);

  const reconnect = useCallback(async () => {
    await socket.disconnect();
    await connect();
  }, [socket, connect]);

  // Initialize connection
  useEffect(() => {
    if (token && token !== previousToken.current) {
      previousToken.current = token;
      connect();
    }

    // Socket event listeners
    const handleConnected = () => {
      setIsConnected(true);
      console.log('✅ WebSocket connected via context');
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      console.log('🔌 WebSocket disconnected via context');
    };

    const handleStatusChange = (health: any) => {
      setConnectionHealth(health);
      setIsConnected(health.isConnected);
      setLatency(health.latency);
    };

    const handleQualityChange = (quality: string) => {
      console.log('📶 Connection quality:', quality);
    };

    const handleError = (error: Error) => {
      console.error('WebSocket error:', error);
    };

    // Subscribe to events
    socket.on('connected', handleConnected);
    socket.on('disconnected', handleDisconnected);
    socket.on('status_change', handleStatusChange);
    socket.on('quality_change', handleQualityChange);
    socket.on('error', handleError);

    // Queue size monitoring
    const queueMonitor = setInterval(() => {
      setQueueSize(socket.queueSize);
    }, 1000);

    return () => {
      clearInterval(queueMonitor);
      socket.off('connected', handleConnected);
      socket.off('disconnected', handleDisconnected);
      socket.off('status_change', handleStatusChange);
      socket.off('quality_change', handleQualityChange);
      socket.off('error', handleError);
    };
  }, [socket, token, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socket.destroy();
    };
  }, [socket]);

  const contextValue: WebSocketContextType = {
    socket,
    isConnected,
    connectionHealth,
    latency,
    queueSize,
    send: socket.send.bind(socket),
    subscribe: socket.subscribe.bind(socket),
    unsubscribe: socket.unsubscribe.bind(socket),
    reconnect
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// Hook for specific event subscription
export const useWebSocketSubscription = <T = any>(
  event: string,
  handler: (data: T) => void,
  deps: React.DependencyList = []
) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(event, handler);
    return unsubscribe;
  }, [subscribe, event, ...deps]);
};

// Hook for sending messages with response handling
export const useWebSocketMessage = () => {
  const { send, isConnected } = useWebSocket();

  return useCallback(<T = any>(
    event: string,
    data: any,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      timeout?: number;
      retries?: number;
    }
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      send(event, data, {
        ...options,
        callback: (error?: Error, response?: T) => {
          if (error) {
            reject(error);
          } else {
            resolve(response as T);
          }
        }
      });
    });
  }, [send, isConnected]);
};