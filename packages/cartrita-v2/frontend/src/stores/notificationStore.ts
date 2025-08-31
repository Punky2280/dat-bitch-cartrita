import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionText?: string;
  category: 'system' | 'agent' | 'user' | 'security' | 'update';
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  settings: {
    enablePush: boolean;
    enableSound: boolean;
    enableDesktop: boolean;
    categories: Record<string, boolean>;
  };
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  updateSettings: (settings: Partial<NotificationState['settings']>) => void;
  
  // Business logic methods
  getNotificationsByCategory: (category: string) => Notification[];
  getUnreadNotifications: () => Notification[];
  getPriorityNotifications: () => Notification[];
}

// Safe storage wrapper with error handling
const safeStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.warn('[Storage] Unable to read from localStorage:', error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.warn('[Storage] Unable to write to localStorage:', error);
    }
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.warn('[Storage] Unable to remove from localStorage:', error);
    }
  },
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isOpen: false,
      settings: {
        enablePush: true,
        enableSound: true,
        enableDesktop: true,
        categories: {
          system: true,
          agent: true,
          user: true,
          security: true,
          update: true,
        },
      },

      addNotification: (notificationData) => {
        const notification: Notification = {
          ...notificationData,
          id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        };

        set((state) => {
          const newNotifications = [notification, ...state.notifications];
          const unreadCount = newNotifications.filter(n => !n.read).length;
          
          // Limit to 100 notifications to prevent memory bloat
          if (newNotifications.length > 100) {
            newNotifications.splice(100);
          }

          return {
            notifications: newNotifications,
            unreadCount,
          };
        });

        // Trigger desktop notification if enabled
        const { settings } = get();
        if (settings.enableDesktop && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
          });
        }

        // Play sound if enabled
        if (settings.enableSound) {
          try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {
              // Ignore audio play errors (user interaction required)
            });
          } catch (error) {
            // Ignore audio errors
          }
        }
      },

      markAsRead: (id) => {
        set((state) => {
          const notifications = state.notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
          );
          const unreadCount = notifications.filter(n => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      deleteNotification: (id) => {
        set((state) => {
          const notifications = state.notifications.filter(n => n.id !== id);
          const unreadCount = notifications.filter(n => !n.read).length;
          return { notifications, unreadCount };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      toggleOpen: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },

      setOpen: (open) => {
        set({ isOpen: open });
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      // Business logic methods
      getNotificationsByCategory: (category) => {
        return get().notifications.filter(n => n.category === category);
      },

      getUnreadNotifications: () => {
        return get().notifications.filter(n => !n.read);
      },

      getPriorityNotifications: () => {
        return get().notifications.filter(n => n.priority === 'high' || n.priority === 'critical');
      },
    }),
    {
      name: 'cartrita-notifications',
      storage: safeStorage,
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        settings: state.settings,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Recalculate unread count on rehydration
          const unreadCount = state.notifications.filter(n => !n.read).length;
          state.unreadCount = unreadCount;
        }
      },
    }
  )
);

// Notification service for business logic
export class NotificationService {
  private static instance: NotificationService;
  
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private constructor() {
    this.initializeDefaultNotifications();
    this.requestPermissions();
  }

  private initializeDefaultNotifications() {
    // Add some initial system notifications
    const store = useNotificationStore.getState();
    
    if (store.notifications.length === 0) {
      store.addNotification({
        title: 'Welcome to Cartrita V2',
        message: 'Your advanced AI orchestration platform is ready!',
        type: 'success',
        category: 'system',
        priority: 'medium',
        read: false,
      });

      store.addNotification({
        title: 'System Status',
        message: 'All 15 AI agents are online and operational',
        type: 'info',
        category: 'system',
        priority: 'low',
        read: false,
      });

      store.addNotification({
        title: 'Security Alert',
        message: 'New login detected from unknown device',
        type: 'warning',
        category: 'security',
        priority: 'high',
        read: false,
        actionUrl: '/settings/security',
        actionText: 'Review Security',
      });
    }
  }

  private async requestPermissions() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  // Business methods for different notification types
  systemNotification(title: string, message: string, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
    useNotificationStore.getState().addNotification({
      title,
      message,
      type: 'info',
      category: 'system',
      priority,
      read: false,
    });
  }

  agentNotification(agentName: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    useNotificationStore.getState().addNotification({
      title: `Agent: ${agentName}`,
      message,
      type,
      category: 'agent',
      priority: type === 'error' ? 'high' : 'medium',
      read: false,
      metadata: { agentName },
    });
  }

  securityAlert(title: string, message: string, actionUrl?: string) {
    useNotificationStore.getState().addNotification({
      title,
      message,
      type: 'warning',
      category: 'security',
      priority: 'critical',
      read: false,
      actionUrl,
      actionText: actionUrl ? 'Review' : undefined,
    });
  }

  updateNotification(title: string, message: string, actionUrl?: string) {
    useNotificationStore.getState().addNotification({
      title,
      message,
      type: 'info',
      category: 'update',
      priority: 'medium',
      read: false,
      actionUrl,
      actionText: actionUrl ? 'Learn More' : undefined,
    });
  }
}