import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionData {
  id: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  duration: number;
  pageViews: number;
  interactions: number;
  referrer?: string;
  userAgent: string;
  ip?: string;
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
  metadata: Record<string, any>;
}

interface SessionStore {
  currentSession: SessionData | null;
  sessions: SessionData[];
  isActive: boolean;
  maxSessions: number;
  
  startSession: (userId?: string) => void;
  endSession: () => void;
  updateActivity: () => void;
  incrementPageViews: () => void;
  incrementInteractions: () => void;
  setSessionMetadata: (key: string, value: any) => void;
  getSessionById: (id: string) => SessionData | undefined;
  getActiveSessions: () => SessionData[];
  clearOldSessions: (olderThanDays?: number) => void;
  getTotalDuration: () => number;
  getAverageSessionDuration: () => number;
}

const generateSessionId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const createSession = (userId?: string): SessionData => {
  const now = new Date();
  return {
    id: generateSessionId(),
    userId,
    startTime: now,
    lastActivity: now,
    duration: 0,
    pageViews: 1,
    interactions: 0,
    referrer: document.referrer || undefined,
    userAgent: navigator.userAgent,
    metadata: {},
  };
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      currentSession: null,
      sessions: [],
      isActive: false,
      maxSessions: 50,
      
      startSession: (userId?: string) => {
        const existingSession = get().currentSession;
        if (existingSession) {
          get().endSession();
        }
        
        const newSession = createSession(userId);
        set((state) => ({
          currentSession: newSession,
          sessions: [...state.sessions.slice(-(state.maxSessions - 1)), newSession],
          isActive: true,
        }));
        
        // Auto-update activity every 30 seconds
        const activityInterval = setInterval(() => {
          const currentState = get();
          if (currentState.isActive && currentState.currentSession) {
            get().updateActivity();
          } else {
            clearInterval(activityInterval);
          }
        }, 30000);
      },
      
      endSession: () => {
        const session = get().currentSession;
        if (!session) return;
        
        const endTime = new Date();
        const duration = endTime.getTime() - session.startTime.getTime();
        
        const updatedSession: SessionData = {
          ...session,
          lastActivity: endTime,
          duration,
        };
        
        set((state) => ({
          currentSession: null,
          isActive: false,
          sessions: state.sessions.map(s => 
            s.id === session.id ? updatedSession : s
          ),
        }));
      },
      
      updateActivity: () => {
        const session = get().currentSession;
        if (!session) return;
        
        const now = new Date();
        const duration = now.getTime() - session.startTime.getTime();
        
        set((state) => ({
          currentSession: state.currentSession ? {
            ...state.currentSession,
            lastActivity: now,
            duration,
          } : null,
        }));
      },
      
      incrementPageViews: () => {
        set((state) => ({
          currentSession: state.currentSession ? {
            ...state.currentSession,
            pageViews: state.currentSession.pageViews + 1,
          } : null,
        }));
        get().updateActivity();
      },
      
      incrementInteractions: () => {
        set((state) => ({
          currentSession: state.currentSession ? {
            ...state.currentSession,
            interactions: state.currentSession.interactions + 1,
          } : null,
        }));
        get().updateActivity();
      },
      
      setSessionMetadata: (key: string, value: any) => {
        set((state) => ({
          currentSession: state.currentSession ? {
            ...state.currentSession,
            metadata: {
              ...state.currentSession.metadata,
              [key]: value,
            },
          } : null,
        }));
      },
      
      getSessionById: (id: string) => {
        return get().sessions.find(session => session.id === id);
      },
      
      getActiveSessions: () => {
        const now = new Date();
        const activeThreshold = 30 * 60 * 1000; // 30 minutes
        
        return get().sessions.filter(session => {
          const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
          return timeSinceActivity < activeThreshold;
        });
      },
      
      clearOldSessions: (olderThanDays = 30) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);
        
        set((state) => ({
          sessions: state.sessions.filter(session => 
            session.startTime >= cutoff
          ),
        }));
      },
      
      getTotalDuration: () => {
        return get().sessions.reduce((total, session) => total + session.duration, 0);
      },
      
      getAverageSessionDuration: () => {
        const sessions = get().sessions;
        if (sessions.length === 0) return 0;
        
        const totalDuration = get().getTotalDuration();
        return totalDuration / sessions.length;
      },
    }),
    {
      name: 'session-store',
    }
  )
);