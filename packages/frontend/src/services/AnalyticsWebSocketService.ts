/**
 * Real-Time Analytics WebSocket Service
 * Manages live analytics data streaming from V2 backend
 */

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, SOCKET_CONFIG } from '../config/constants';

interface AnalyticsData {
  interactions: Array<{ name: string; value: number; change?: string }>;
  users: Array<{ name: string; value: number; change?: string }>;
  responseTime: Array<{ name: string; value: number; change?: string }>;
  successRate: Array<{ name: string; value: number; change?: string }>;
  currentTimeRange: string;
  lastUpdated: string;
  summary?: {
    totalInteractions: number;
    totalUsers: number;
    avgResponseTime: number;
    avgSuccessRate: number;
  };
}

interface AnalyticsUpdate {
  type: 'analytics_accessed' | 'event_tracked' | 'metrics_updated';
  timestamp: string;
  userId?: number;
  data?: any;
}

class AnalyticsWebSocketService {
  private socket: Socket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isSubscribed = false;
  private currentTimeRange: 'day' | 'week' | 'month' | 'year' = 'week';

  /**
   * Initialize WebSocket connection
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    try {
      this.socket = io(SOCKET_URL, {
        ...SOCKET_CONFIG,
        auth: {
          token: localStorage.getItem('token')
        }
      });

      await this.setupEventHandlers();
      console.log('📊 Analytics WebSocket service connected');
    } catch (error) {
      console.error('❌ Failed to connect analytics WebSocket:', error);
      throw error;
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  private async setupEventHandlers(): Promise<void> {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('🟢 Analytics WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('analytics:connected', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🟡 Analytics WebSocket disconnected:', reason);
      this.emit('analytics:disconnected', { reason });
      this.isSubscribed = false;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Analytics WebSocket reconnected after', attemptNumber, 'attempts');
      this.emit('analytics:reconnected', { attempts: attemptNumber });
      // Re-subscribe after reconnection
      if (!this.isSubscribed) {
        this.subscribeToAnalytics(this.currentTimeRange);
      }
    });

    // Authentication
    this.socket.on('authenticated', (data) => {
      console.log('✅ Analytics WebSocket authenticated:', data.user);
      this.emit('analytics:authenticated', data);
    });

    this.socket.on('auth_error', (error) => {
      console.error('❌ Analytics WebSocket auth error:', error);
      this.emit('analytics:auth_error', error);
    });

    // Analytics-specific events
    this.socket.on('analytics_data', (data: AnalyticsData) => {
      console.log('📈 Received analytics data:', data);
      this.emit('analytics:data', data);
    });

    this.socket.on('analytics_update', (update: AnalyticsUpdate) => {
      console.log('📊 Analytics update:', update);
      this.emit('analytics:update', update);
    });

    this.socket.on('analytics_error', (error) => {
      console.error('❌ Analytics error:', error);
      this.emit('analytics:error', error);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('❌ Analytics WebSocket error:', error);
      this.emit('analytics:error', error);
    });

    // Auto-authenticate
    this.authenticate();
  }

  /**
   * Authenticate with the WebSocket server
   */
  authenticate(): void {
    const token = localStorage.getItem('token');
    if (this.socket && token) {
      this.socket.emit('authenticate', { token });
    }
  }

  /**
   * Subscribe to real-time analytics updates
   */
  subscribeToAnalytics(timeRange: 'day' | 'week' | 'month' | 'year' = 'week'): void {
    if (!this.socket?.connected) {
      console.warn('Cannot subscribe to analytics - socket not connected');
      return;
    }

    this.currentTimeRange = timeRange;
    this.socket.emit('subscribe_analytics', { timeRange });
    this.isSubscribed = true;

    console.log('📊 Subscribed to analytics updates:', timeRange);
  }

  /**
   * Unsubscribe from analytics updates
   */
  unsubscribeFromAnalytics(): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe_analytics');
      this.isSubscribed = false;
      console.log('📊 Unsubscribed from analytics updates');
    }
  }

  /**
   * Track a custom analytics event
   */
  async trackEvent(eventType: string, eventData: any = {}, agentId?: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v2/analytics/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          eventType,
          eventData,
          agentId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📈 Event tracked:', result);
    } catch (error) {
      console.error('Failed to track event:', error);
      throw error;
    }
  }

  /**
   * Fetch analytics data via REST API (fallback)
   */
  async fetchAnalyticsData(timeRange: 'day' | 'week' | 'month' | 'year' = 'week'): Promise<AnalyticsData> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v2/analytics?range=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(eventType: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    
    this.subscribers.get(eventType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  /**
   * Emit events to subscribers
   */
  private emit(eventType: string, data: any): void {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.socket) {
      this.unsubscribeFromAnalytics();
      this.socket.disconnect();
      this.socket = null;
      this.isSubscribed = false;
      console.log('📊 Analytics WebSocket service disconnected');
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get subscription status
   */
  isSubscribedToAnalytics(): boolean {
    return this.isSubscribed;
  }
}

// Create singleton instance
export const analyticsWebSocketService = new AnalyticsWebSocketService();

// React hook for using real-time analytics
import { useEffect, useState, useCallback } from 'react';

export const useRealTimeAnalytics = (timeRange: 'day' | 'week' | 'month' | 'year' = 'week') => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Connect to analytics service
    analyticsWebSocketService.connect().catch(err => {
      setError(err.message);
      setIsLoading(false);
    });

    // Subscribe to connection status
    const unsubscribeConnection = analyticsWebSocketService.subscribe('analytics:connected', () => {
      setIsConnected(true);
      setError(null);
    });

    const unsubscribeDisconnection = analyticsWebSocketService.subscribe('analytics:disconnected', () => {
      setIsConnected(false);
    });

    const unsubscribeError = analyticsWebSocketService.subscribe('analytics:error', (errorData) => {
      setError(errorData.error || errorData.message);
      setIsLoading(false);
    });

    // Subscribe to analytics data
    const unsubscribeData = analyticsWebSocketService.subscribe('analytics:data', (analyticsData: AnalyticsData) => {
      setData(analyticsData);
      setIsLoading(false);
    });

    const unsubscribeUpdates = analyticsWebSocketService.subscribe('analytics:update', (update: AnalyticsUpdate) => {
      // Handle real-time updates
      console.log('Real-time analytics update:', update);
    });

    // Subscribe to analytics for the specified time range
    const subscribeWithDelay = setTimeout(() => {
      if (analyticsWebSocketService.isConnected()) {
        analyticsWebSocketService.subscribeToAnalytics(timeRange);
      }
    }, 1000); // Small delay to ensure connection is established

    return () => {
      clearTimeout(subscribeWithDelay);
      unsubscribeConnection();
      unsubscribeDisconnection();
      unsubscribeError();
      unsubscribeData();
      unsubscribeUpdates();
    };
  }, [timeRange]);

  const trackEvent = useCallback((eventType: string, eventData: any = {}, agentId?: string) => {
    return analyticsWebSocketService.trackEvent(eventType, eventData, agentId);
  }, []);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (analyticsWebSocketService.isConnected()) {
        analyticsWebSocketService.subscribeToAnalytics(timeRange);
      } else {
        // Fallback to REST API
        const fallbackData = await analyticsWebSocketService.fetchAnalyticsData(timeRange);
        setData(fallbackData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  return {
    data,
    isConnected,
    isLoading,
    error,
    trackEvent,
    refetch,
    service: analyticsWebSocketService
  };
};

export default AnalyticsWebSocketService;