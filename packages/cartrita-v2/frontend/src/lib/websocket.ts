import { toast } from 'react-hot-toast';

export interface WebSocketMessage {
  type: 'message' | 'typing' | 'tool_call' | 'tool_result' | 'error' | 'system';
  data: any;
  timestamp: string;
  id?: string;
  conversationId?: string;
  userId?: string;
}

export interface WebSocketConfig {
  url: string;
  token?: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private isConnecting = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionId: string | null = null;

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Connection already in progress'));
        return;
      }

      this.isConnecting = true;

      try {
        const url = this.config.token 
          ? `${this.config.url}?token=${this.config.token}`
          : this.config.url;

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('system', { type: 'connected', timestamp: new Date().toISOString() });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          
          if (event.code !== 1000 && this.reconnectAttempts < this.config.reconnectAttempts) {
            this.scheduleReconnect();
          }
          
          this.emit('system', { 
            type: 'disconnected', 
            code: event.code, 
            reason: event.reason,
            timestamp: new Date().toISOString() 
          });
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          this.emit('system', { type: 'error', error, timestamp: new Date().toISOString() });
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.connectionId = null;
  }

  send(message: Omit<WebSocketMessage, 'timestamp'>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, message not sent:', message);
      return false;
    }

    try {
      const fullMessage: WebSocketMessage = {
        ...message,
        timestamp: new Date().toISOString(),
        id: message.id || this.generateId(),
      };

      this.ws.send(JSON.stringify(fullMessage));
      return true;
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      return false;
    }
  }

  on(eventType: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    // Handle system messages
    if (message.type === 'system' && message.data?.connectionId) {
      this.connectionId = message.data.connectionId;
    }

    // Emit to all handlers for this message type
    this.emit(message.type, message.data);
    
    // Emit to general message handlers
    this.emit('message', message);
  }

  private emit(eventType: string, data: any): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.forEach(handler => {
      try {
        handler({ type: eventType as any, data, timestamp: new Date().toISOString() });
      } catch (error) {
        console.error('Error in WebSocket event handler:', error);
      }
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Scheduling WebSocket reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.config.reconnectAttempts) {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'system',
          data: { type: 'ping' }
        });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  get connectionInfo(): { id: string | null; connected: boolean; attempts: number } {
    return {
      id: this.connectionId,
      connected: this.isConnected,
      attempts: this.reconnectAttempts
    };
  }
}

// WebSocket hook for React components
export class WebSocketHook {
  private static instance: WebSocketManager | null = null;

  static getInstance(config?: WebSocketConfig): WebSocketManager {
    if (!WebSocketHook.instance && config) {
      WebSocketHook.instance = new WebSocketManager(config);
    } else if (!WebSocketHook.instance) {
      throw new Error('WebSocket not initialized. Provide config on first call.');
    }
    
    return WebSocketHook.instance;
  }

  static disconnect(): void {
    if (WebSocketHook.instance) {
      WebSocketHook.instance.disconnect();
      WebSocketHook.instance = null;
    }
  }
}

// Utility functions for common WebSocket operations
export const sendChatMessage = (ws: WebSocketManager, conversationId: string, content: string) => {
  return ws.send({
    type: 'message',
    data: {
      conversationId,
      content,
      role: 'user'
    }
  });
};

export const sendTypingIndicator = (ws: WebSocketManager, conversationId: string, isTyping: boolean) => {
  return ws.send({
    type: 'typing',
    data: {
      conversationId,
      isTyping,
      userId: 'current-user' // This should come from auth context
    }
  });
};

export const sendToolCall = (ws: WebSocketManager, conversationId: string, toolName: string, parameters: any) => {
  return ws.send({
    type: 'tool_call',
    data: {
      conversationId,
      toolName,
      parameters
    }
  });
};

// Connection status utilities - Updated for Cartrita V2 Backend
export const getWebSocketConfig = (): WebSocketConfig => ({
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8002/ws',
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  heartbeatInterval: 30000
});

export default WebSocketManager;