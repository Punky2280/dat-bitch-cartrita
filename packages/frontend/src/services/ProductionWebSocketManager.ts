import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';

interface WebSocketConfig {
  url: string;
  options: {
    auth?: { token: string };
    transports: string[];
    upgrade: boolean;
    rememberUpgrade: boolean;
    autoConnect: boolean;
    timeout: number;
    pingTimeout: number;
    pingInterval: number;
    maxReconnectionAttempts: number;
    reconnectionDelay: number;
    reconnectionDelayMax: number;
    forceNew: boolean;
  };
}

interface ConnectionHealth {
  isConnected: boolean;
  latency: number;
  reconnectAttempts: number;
  lastError?: string;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
}

interface MessageQueueItem {
  id: string;
  event: string;
  data: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  callback?: (error?: Error, response?: any) => void;
}

export class ProductionWebSocketManager extends EventEmitter {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private health: ConnectionHealth;
  private messageQueue: Map<string, MessageQueueItem> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 10;
  
  // Circuit breaker pattern
  private circuitBreaker = {
    isOpen: false,
    failureCount: 0,
    failureThreshold: 5,
    timeout: 30000,
    nextAttempt: 0
  };

  // Connection pooling for load balancing
  private connectionPool: Socket[] = [];
  private currentPoolIndex = 0;

  constructor(config: Partial<WebSocketConfig> = {}) {
    super();
    this.setMaxListeners(50); // Prevent memory leaks

    this.config = {
      url: config.url || import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000',
      options: {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        autoConnect: false,
        timeout: 20000,
        pingTimeout: 60000,
        pingInterval: 25000,
        maxReconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        forceNew: false,
        ...config.options
      }
    };

    this.health = {
      isConnected: false,
      latency: 0,
      reconnectAttempts: 0,
      connectionQuality: 'disconnected'
    };

    // Bind methods to preserve context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.send = this.send.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.unsubscribe = this.unsubscribe.bind(this);
  }

  // Enhanced connection with retry logic and circuit breaker
  async connect(token?: string): Promise<void> {
    if (this.circuitBreaker.isOpen && Date.now() < this.circuitBreaker.nextAttempt) {
      throw new Error('Circuit breaker is open. Connection attempts are temporarily disabled.');
    }

    if (this.socket?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.connectionAttempts++;
      
      if (token) {
        this.config.options.auth = { token };
      }

      this.socket = io(this.config.url, this.config.options);
      
      await this.setupEventHandlers();
      await this.waitForConnection();
      
      this.health.isConnected = true;
      this.health.reconnectAttempts = 0;
      this.connectionAttempts = 0;
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.isOpen = false;
      
      this.startHealthMonitoring();
      this.processMessageQueue();
      
      this.emit('connected', { health: this.health });
      console.log('✅ WebSocket connected successfully');
      
    } catch (error) {
      this.handleConnectionError(error as Error);
      throw error;
    }
  }

  private async setupEventHandlers(): Promise<void> {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔗 Socket connected with ID:', this.socket?.id);
      this.health.isConnected = true;
      this.health.connectionQuality = 'excellent';
      this.emit('status_change', this.health);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('🔌 Socket disconnected:', reason);
      this.health.isConnected = false;
      this.health.connectionQuality = 'disconnected';
      this.emit('status_change', this.health);
      this.handleDisconnection(reason);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ Connection error:', error.message);
      this.handleConnectionError(error);
    });

    // Ping/Pong for latency monitoring
    this.socket.on('ping', () => {
      const startTime = Date.now();
      this.socket?.emit('pong', { timestamp: startTime });
    });

    this.socket.on('pong', (data: { timestamp: number }) => {
      this.health.latency = Date.now() - data.timestamp;
      this.updateConnectionQuality();
    });

    // Message acknowledgment
    this.socket.on('message_ack', (data: { messageId: string, success: boolean, error?: string }) => {
      const queueItem = this.messageQueue.get(data.messageId);
      if (queueItem) {
        this.messageQueue.delete(data.messageId);
        queueItem.callback?.(data.error ? new Error(data.error) : undefined, data);
      }
    });

    // Server-sent events
    this.socket.on('server_message', (data: any) => {
      this.emit('message', data);
    });

    this.socket.on('system_notification', (data: any) => {
      this.emit('notification', data);
    });

    // Health check response
    this.socket.on('health_response', (data: any) => {
      this.emit('health_update', data);
    });
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.options.timeout);

      this.socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.once('connect_error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private handleConnectionError(error: Error): void {
    this.circuitBreaker.failureCount++;
    
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
      this.circuitBreaker.isOpen = true;
      this.circuitBreaker.nextAttempt = Date.now() + this.circuitBreaker.timeout;
      console.warn('Circuit breaker opened due to repeated failures');
    }

    this.health.lastError = error.message;
    this.emit('error', error);
  }

  private handleDisconnection(reason: string): void {
    this.stopHealthMonitoring();
    
    if (reason === 'io server disconnect') {
      // Server intentionally disconnected, don't reconnect
      console.log('Server disconnected intentionally');
      return;
    }

    if (this.connectionAttempts < this.maxConnectionAttempts && !this.isReconnecting) {
      this.attemptReconnection();
    }
  }

  private attemptReconnection(): void {
    if (this.isReconnecting || this.circuitBreaker.isOpen) return;

    this.isReconnecting = true;
    this.health.reconnectAttempts++;

    const delay = Math.min(
      this.config.options.reconnectionDelay * Math.pow(2, this.health.reconnectAttempts - 1),
      this.config.options.reconnectionDelayMax
    );

    console.log(`🔄 Attempting reconnection in ${delay}ms (attempt ${this.health.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        this.isReconnecting = false;
        await this.connect();
      } catch (error) {
        this.isReconnecting = false;
        if (this.health.reconnectAttempts < this.config.options.maxReconnectionAttempts) {
          this.attemptReconnection();
        } else {
          console.error('Max reconnection attempts reached');
          this.emit('max_reconnect_failed');
        }
      }
    }, delay);
  }

  // Enhanced message sending with queue and reliability
  send<T = any>(
    event: string, 
    data: any, 
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      timeout?: number;
      retries?: number;
      callback?: (error?: Error, response?: T) => void;
    } = {}
  ): string {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queueItem: MessageQueueItem = {
      id: messageId,
      event,
      data,
      priority: options.priority || 'normal',
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options.retries || 3,
      callback: options.callback
    };

    this.messageQueue.set(messageId, queueItem);

    if (this.socket?.connected) {
      this.sendMessage(queueItem);
    } else {
      console.log(`Queued message ${messageId} for later delivery`);
    }

    // Set timeout for callback
    if (options.timeout && options.callback) {
      setTimeout(() => {
        const item = this.messageQueue.get(messageId);
        if (item) {
          this.messageQueue.delete(messageId);
          options.callback?.(new Error('Message timeout'));
        }
      }, options.timeout);
    }

    return messageId;
  }

  private sendMessage(item: MessageQueueItem): void {
    if (!this.socket?.connected) return;

    try {
      this.socket.emit(item.event, {
        ...item.data,
        _messageId: item.id,
        _priority: item.priority,
        _timestamp: item.timestamp
      });
      
      console.log(`📤 Sent message: ${item.event} (${item.id})`);
    } catch (error) {
      console.error(`Failed to send message ${item.id}:`, error);
      this.retryMessage(item);
    }
  }

  private retryMessage(item: MessageQueueItem): void {
    if (item.retryCount >= item.maxRetries) {
      this.messageQueue.delete(item.id);
      item.callback?.(new Error('Max retries exceeded'));
      return;
    }

    item.retryCount++;
    const delay = Math.pow(2, item.retryCount) * 1000; // Exponential backoff

    setTimeout(() => {
      if (this.messageQueue.has(item.id)) {
        this.sendMessage(item);
      }
    }, delay);
  }

  private processMessageQueue(): void {
    if (!this.socket?.connected) return;

    // Sort by priority and timestamp
    const sortedMessages = Array.from(this.messageQueue.values()).sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
    });

    sortedMessages.forEach(item => {
      this.sendMessage(item);
    });
  }

  // Subscription management
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map();

  subscribe<T = any>(event: string, handler: (data: T) => void): () => void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
      this.socket?.on(event, (data: T) => {
        this.subscriptions.get(event)?.forEach(h => h(data));
      });
    }

    this.subscriptions.get(event)!.add(handler);

    return () => this.unsubscribe(event, handler);
  }

  unsubscribe<T = any>(event: string, handler: (data: T) => void): void {
    const handlers = this.subscriptions.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.socket?.off(event);
        this.subscriptions.delete(event);
      }
    }
  }

  // Health monitoring
  private startHealthMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.send('health_check', { timestamp: Date.now() }, { priority: 'low' });
      }
    }, 30000);
  }

  private stopHealthMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private updateConnectionQuality(): void {
    const { latency } = this.health;
    
    if (latency < 100) {
      this.health.connectionQuality = 'excellent';
    } else if (latency < 300) {
      this.health.connectionQuality = 'good';
    } else {
      this.health.connectionQuality = 'poor';
    }
    
    this.emit('quality_change', this.health.connectionQuality);
  }

  // Connection management
  async disconnect(): Promise<void> {
    this.stopHealthMonitoring();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.health.isConnected = false;
    this.health.connectionQuality = 'disconnected';
    this.connectionAttempts = 0;
    this.isReconnecting = false;

    // Clear message queue
    this.messageQueue.forEach(item => {
      item.callback?.(new Error('Connection closed'));
    });
    this.messageQueue.clear();

    this.emit('disconnected');
    console.log('🔌 WebSocket disconnected');
  }

  // Getters
  get isConnected(): boolean {
    return this.health.isConnected && this.socket?.connected === true;
  }

  get connectionHealth(): ConnectionHealth {
    return { ...this.health };
  }

  get queueSize(): number {
    return this.messageQueue.size;
  }

  // Cleanup
  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
    this.subscriptions.clear();
  }
}