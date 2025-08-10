import React, { createContext, useContext, useState, useCallback } from 'react';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  actions?: NotificationAction[];
}

interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const removeNotification = useCallback((id: string) => setNotifications(p => p.filter(n => n.id !== id)), []);
  const addNotification = useCallback((n: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 11);
    const notif: Notification = { id, duration: 5000, ...n };
    setNotifications(p => [...p, notif]);
    if (notif.duration && notif.duration > 0) {
      setTimeout(() => removeNotification(id), notif.duration);
    }
    return id;
  }, [removeNotification]);
  const clearAll = useCallback(() => setNotifications([]), []);
  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearAll }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();
  if (!notifications.length) return null;
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(n => (
        <NotificationItem key={n.id} notification={n} onRemove={() => removeNotification(n.id)} />
      ))}
    </div>
  );
};

const NotificationItem: React.FC<{
  notification: Notification;
  onRemove: () => void;
}> = ({ notification, onRemove }) => {
  const style =
    notification.type === 'success'
      ? 'bg-green-900/90 border-green-700 text-green-100'
      : notification.type === 'error'
      ? 'bg-red-900/90 border-red-700 text-red-100'
      : notification.type === 'warning'
      ? 'bg-yellow-900/90 border-yellow-700 text-yellow-100'
      : 'bg-blue-900/90 border-blue-700 text-blue-100';
  const icon =
    notification.type === 'success'
      ? '✅'
      : notification.type === 'error'
      ? '❌'
      : notification.type === 'warning'
      ? '⚠️'
      : 'ℹ️';
  return (
    <div
      className={`p-4 rounded-lg border backdrop-blur-sm animate-in slide-in-from-right-full ${style}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <span className="text-lg">{icon}</span>
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{notification.title}</h4>
            {notification.message && (
              <p className="text-sm opacity-90 mt-1">{notification.message}</p>
            )}
            {notification.actions?.length ? (
              <div className="flex space-x-2 mt-3">
                {notification.actions.map((a, i) => (
                  <button
                    key={i}
                    onClick={a.onClick}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      a.variant === 'primary'
                        ? 'bg-white/20 hover:bg-white/30'
                        : 'bg-transparent hover:bg-white/10 border border-current'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="text-current/70 hover:text-current transition-colors p-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within a NotificationProvider');
  return ctx;
};

export const useNotify = () => {
  const { addNotification } = useNotification();
  return {
    success: (t: string, m?: string) => addNotification({ type: 'success', title: t, message: m }),
    error: (t: string, m?: string) => addNotification({ type: 'error', title: t, message: m }),
    warning: (t: string, m?: string) => addNotification({ type: 'warning', title: t, message: m }),
    info: (t: string, m?: string) => addNotification({ type: 'info', title: t, message: m }),
  };
};