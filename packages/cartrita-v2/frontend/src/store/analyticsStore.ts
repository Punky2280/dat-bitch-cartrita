import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AnalyticsEvent {
  id: string;
  event: string;
  timestamp: Date;
  properties: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

interface AnalyticsMetrics {
  pageViews: number;
  sessions: number;
  users: number;
  avgSessionDuration: number;
  bounceRate: number;
}

interface AnalyticsStore {
  enabled: boolean;
  events: AnalyticsEvent[];
  metrics: AnalyticsMetrics;
  sessionId: string;
  userId?: string;
  
  toggleEnabled: () => void;
  trackEvent: (event: string, properties?: Record<string, any>) => void;
  trackPageView: (page: string) => void;
  setUserId: (userId: string) => void;
  clearEvents: () => void;
  getEventsByType: (eventType: string) => AnalyticsEvent[];
  updateMetrics: (metrics: Partial<AnalyticsMetrics>) => void;
}

const generateSessionId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const defaultMetrics: AnalyticsMetrics = {
  pageViews: 0,
  sessions: 0,
  users: 0,
  avgSessionDuration: 0,
  bounceRate: 0,
};

export const useAnalyticsStore = create<AnalyticsStore>()(
  persist(
    (set, get) => ({
      enabled: true,
      events: [],
      metrics: defaultMetrics,
      sessionId: generateSessionId(),
      
      toggleEnabled: () =>
        set((state) => ({ enabled: !state.enabled })),
      
      trackEvent: (event: string, properties = {}) => {
        const state = get();
        if (!state.enabled) return;
        
        const newEvent: AnalyticsEvent = {
          id: Date.now().toString() + Math.random().toString(),
          event,
          timestamp: new Date(),
          properties,
          userId: state.userId,
          sessionId: state.sessionId,
        };
        
        set((state) => ({
          events: [...state.events.slice(-999), newEvent],
        }));
      },
      
      trackPageView: (page: string) => {
        get().trackEvent('page_view', { page });
        set((state) => ({
          metrics: {
            ...state.metrics,
            pageViews: state.metrics.pageViews + 1,
          },
        }));
      },
      
      setUserId: (userId: string) =>
        set({ userId }),
      
      clearEvents: () =>
        set({ events: [] }),
      
      getEventsByType: (eventType: string) => {
        return get().events.filter(event => event.event === eventType);
      },
      
      updateMetrics: (newMetrics) =>
        set((state) => ({
          metrics: { ...state.metrics, ...newMetrics },
        })),
    }),
    {
      name: 'analytics-store',
    }
  )
);