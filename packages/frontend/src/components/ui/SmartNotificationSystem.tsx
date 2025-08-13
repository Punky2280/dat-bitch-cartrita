/**
 * @fileoverview Smart Notification System
 * @description Advanced notification system with contextual awareness,
 * priority management, and adaptive behavior
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'ai' | 'system';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  duration?: number;
  timestamp: Date;
  context?: {
    userId?: string;
    feature?: string;
    action?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    requiresAction?: boolean;
    relatedData?: any;
  };
  actions?: NotificationAction[];
  persistent?: boolean;
  sound?: boolean;
  vibration?: boolean;
  adaptive?: {
    userEngagement?: number;
    stressLevel?: number;
    preferredStyle?: 'minimal' | 'detailed' | 'interactive';
  };
}

interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
  icon?: string;
}

interface SmartNotificationSystemProps {
  maxNotifications?: number;
  defaultDuration?: number;
  enableAI?: boolean;
  enableSound?: boolean;
  enableVibration?: boolean;
  adaptiveBehavior?: boolean;
  className?: string;
}

const PRIORITY_WEIGHTS = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const NOTIFICATION_SOUNDS = {
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
  warning: '/sounds/warning.mp3',
  info: '/sounds/info.mp3',
  ai: '/sounds/ai-notification.mp3',
  system: '/sounds/system.mp3'
};

const SmartNotificationSystem: React.FC<SmartNotificationSystemProps> = ({
  maxNotifications = 5,
  defaultDuration = 5000,
  enableAI = true,
  enableSound = true,
  enableVibration = true,
  adaptiveBehavior = true,
  className = ''
}) => {
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [userPreferences, setUserPreferences] = useState({
    soundEnabled: enableSound,
    vibrationEnabled: enableVibration,
    adaptiveEnabled: adaptiveBehavior,
    preferredStyle: 'detailed' as 'minimal' | 'detailed' | 'interactive',
    autoCloseEnabled: true,
    groupSimilar: true
  });
  const [contextualData, setContextualData] = useState({
    userEngagement: 0.7,
    stressLevel: 0.3,
    currentFeature: '',
    recentErrors: 0,
    sessionStart: Date.now()
  });
  
  const audioRef = useRef<{ [key: string]: HTMLAudioElement }>({});
  const notificationQueue = useRef<SmartNotification[]>([]);
  const processingQueue = useRef(false);

  // Initialize audio elements
  useEffect(() => {
    if (enableSound) {
      Object.entries(NOTIFICATION_SOUNDS).forEach(([type, url]) => {
        const audio = new Audio(url);
        audio.volume = 0.3;
        audioRef.current[type] = audio;
      });
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      // Cleanup audio
      Object.values(audioRef.current).forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, [enableSound]);

  // Smart notification processing
  const processNotificationQueue = useCallback(async () => {
    if (processingQueue.current || notificationQueue.current.length === 0) return;
    
    processingQueue.current = true;
    
    while (notificationQueue.current.length > 0) {
      const notification = notificationQueue.current.shift()!;
      
      // Apply AI-enhanced filtering and adaptation
      const processedNotification = await processNotificationWithAI(notification);
      
      if (processedNotification) {
        // Check if should group with existing notifications
        const shouldGroup = userPreferences.groupSimilar && 
                           shouldGroupNotification(processedNotification, notifications);
        
        if (shouldGroup) {
          groupNotification(processedNotification);
        } else {
          addNotification(processedNotification);
        }
      }
      
      // Respect rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    processingQueue.current = false;
  }, [notifications, userPreferences]);

  // Process notification with AI enhancement
  const processNotificationWithAI = async (notification: SmartNotification): Promise<SmartNotification | null> => {
    if (!enableAI) return notification;

    try {
      // Analyze notification context and user state
      const shouldShow = analyzeNotificationRelevance(notification);
      if (!shouldShow) return null;

      // Adapt notification based on user context
      const adaptedNotification = adaptNotificationToContext(notification);
      
      // Apply smart timing
      const timedNotification = applySmartTiming(adaptedNotification);
      
      return timedNotification;
    } catch (error) {
      console.error('[SmartNotifications] AI processing error:', error);
      return notification;
    }
  };

  // Analyze if notification should be shown
  const analyzeNotificationRelevance = (notification: SmartNotification): boolean => {
    // Don't show low priority notifications if user is stressed
    if (contextualData.stressLevel > 0.7 && notification.priority === 'low') {
      return false;
    }

    // Limit error notifications if there have been many recently
    if (notification.type === 'error' && contextualData.recentErrors > 3) {
      return notification.priority === 'critical';
    }

    // Don't show info notifications if user engagement is very low
    if (notification.type === 'info' && contextualData.userEngagement < 0.3) {
      return false;
    }

    return true;
  };

  // Adapt notification to user context
  const adaptNotificationToContext = (notification: SmartNotification): SmartNotification => {
    const adapted = { ...notification };

    // Adjust duration based on priority and user context
    if (contextualData.stressLevel > 0.6) {
      adapted.duration = Math.max(adapted.duration || defaultDuration, 7000);
    } else if (contextualData.userEngagement > 0.8) {
      adapted.duration = (adapted.duration || defaultDuration) * 0.8;
    }

    // Adjust style based on user preferences and adaptive data
    if (adapted.adaptive) {
      adapted.adaptive.userEngagement = contextualData.userEngagement;
      adapted.adaptive.stressLevel = contextualData.stressLevel;
      adapted.adaptive.preferredStyle = userPreferences.preferredStyle;
    }

    // Add contextual actions for certain notification types
    if (notification.type === 'error' && !notification.actions) {
      adapted.actions = [
        {
          label: 'Get Help',
          action: () => console.log('Opening help for error'),
          style: 'primary',
          icon: '💬'
        },
        {
          label: 'Report Issue',
          action: () => console.log('Reporting issue'),
          style: 'secondary',
          icon: '🐛'
        }
      ];
    }

    return adapted;
  };

  // Apply smart timing
  const applySmartTiming = (notification: SmartNotification): SmartNotification => {
    const adapted = { ...notification };

    // Delay non-critical notifications if user just started session
    const sessionAge = Date.now() - contextualData.sessionStart;
    if (sessionAge < 30000 && notification.priority !== 'critical') {
      // Add delay for new sessions
      setTimeout(() => {
        processNotificationQueue();
      }, 2000);
      return adapted;
    }

    return adapted;
  };

  // Check if notification should be grouped
  const shouldGroupNotification = (newNotification: SmartNotification, existing: SmartNotification[]): boolean => {
    return existing.some(n => 
      n.type === newNotification.type &&
      n.context?.feature === newNotification.context?.feature &&
      Date.now() - n.timestamp.getTime() < 60000 // Within 1 minute
    );
  };

  // Group notification with existing one
  const groupNotification = (notification: SmartNotification) => {
    setNotifications(prev => prev.map(existing => {
      if (existing.type === notification.type && 
          existing.context?.feature === notification.context?.feature) {
        return {
          ...existing,
          message: `${existing.message} (and ${notification.message})`,
          timestamp: notification.timestamp,
          priority: PRIORITY_WEIGHTS[notification.priority] > PRIORITY_WEIGHTS[existing.priority] 
            ? notification.priority : existing.priority
        };
      }
      return existing;
    }));
  };

  // Add notification to display
  const addNotification = (notification: SmartNotification) => {
    setNotifications(prev => {
      const updated = [notification, ...prev];
      
      // Maintain max notifications
      if (updated.length > maxNotifications) {
        // Remove lowest priority notifications
        const sorted = updated.sort((a, b) => 
          PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
        );
        return sorted.slice(0, maxNotifications);
      }
      
      return updated;
    });

    // Play sound
    if (userPreferences.soundEnabled && audioRef.current[notification.type]) {
      audioRef.current[notification.type].play().catch(console.warn);
    }

    // Vibrate
    if (userPreferences.vibrationEnabled && 'vibrate' in navigator) {
      const pattern = notification.priority === 'critical' ? [200, 100, 200] : [100];
      navigator.vibrate(pattern);
    }

    // Browser notification for critical items
    if (notification.priority === 'critical' && 'Notification' in window && 
        Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon-192x192.png',
        tag: notification.id
      });
    }

    // Auto-remove notification
    if (!notification.persistent && userPreferences.autoCloseEnabled) {
      const duration = notification.duration || defaultDuration;
      setTimeout(() => {
        removeNotification(notification.id);
      }, duration);
    }

    // Update contextual data
    if (notification.type === 'error') {
      setContextualData(prev => ({
        ...prev,
        recentErrors: prev.recentErrors + 1
      }));
    }
  };

  // Public API for adding notifications
  const notify = useCallback((notification: Omit<SmartNotification, 'id' | 'timestamp'>) => {
    const fullNotification: SmartNotification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      duration: notification.duration || defaultDuration
    };

    notificationQueue.current.push(fullNotification);
    processNotificationQueue();
  }, [defaultDuration, processNotificationQueue]);

  // Remove notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Handle notification action
  const handleAction = useCallback((notificationId: string, action: NotificationAction) => {
    action.action();
    removeNotification(notificationId);
  }, [removeNotification]);

  // Get notification icon
  const getNotificationIcon = (type: string, priority: string) => {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      ai: '🤖',
      system: '⚙️'
    };

    if (priority === 'critical') {
      return '🚨';
    }

    return icons[type as keyof typeof icons] || 'ℹ️';
  };

  // Get notification style based on type and adaptive data
  const getNotificationStyle = (notification: SmartNotification) => {
    const baseStyles = {
      success: 'bg-green-500/20 border-green-500/50 text-green-100',
      error: 'bg-red-500/20 border-red-500/50 text-red-100',
      warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-100',
      info: 'bg-blue-500/20 border-blue-500/50 text-blue-100',
      ai: 'bg-purple-500/20 border-purple-500/50 text-purple-100',
      system: 'bg-gray-500/20 border-gray-500/50 text-gray-100'
    };

    let style = baseStyles[notification.type] || baseStyles.info;

    // Add priority styling
    if (notification.priority === 'critical') {
      style += ' ring-2 ring-red-500 shadow-lg shadow-red-500/25';
    } else if (notification.priority === 'high') {
      style += ' shadow-lg';
    }

    return style;
  };

  // Expose API globally
  useEffect(() => {
    (window as any).smartNotify = notify;
    return () => {
      delete (window as any).smartNotify;
    };
  }, [notify]);

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full ${className}`}>
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 300, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`
              border rounded-lg p-4 backdrop-blur-sm
              ${getNotificationStyle(notification)}
            `}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 text-xl">
                {getNotificationIcon(notification.type, notification.priority)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold truncate">
                    {notification.title}
                  </h4>
                  <button
                    onClick={() => removeNotification(notification.id)}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    ×
                  </button>
                </div>
                
                <p className="text-xs mt-1 opacity-90">
                  {notification.message}
                </p>
                
                {notification.actions && (
                  <div className="flex space-x-2 mt-3">
                    {notification.actions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleAction(notification.id, action)}
                        className={`
                          text-xs px-3 py-1 rounded transition-colors
                          ${action.style === 'primary' 
                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                            : action.style === 'danger'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-gray-600 hover:bg-gray-700 text-white'
                          }
                        `}
                      >
                        {action.icon && <span className="mr-1">{action.icon}</span>}
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                  <span>{notification.timestamp.toLocaleTimeString()}</span>
                  {notification.priority !== 'low' && (
                    <span className="capitalize text-xs">
                      {notification.priority}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {notifications.length > 2 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={clearAll}
          className="w-full text-xs py-2 px-3 bg-gray-800/80 hover:bg-gray-700/80 text-gray-300 rounded-lg backdrop-blur-sm border border-gray-600/50 transition-colors"
        >
          Clear All ({notifications.length})
        </motion.button>
      )}
    </div>
  );
};

// Helper hook for using the notification system
export const useSmartNotifications = () => {
  return {
    notify: (window as any).smartNotify || (() => console.warn('SmartNotificationSystem not initialized')),
    success: (title: string, message: string, options?: Partial<SmartNotification>) => 
      (window as any).smartNotify?.({ type: 'success', title, message, priority: 'medium', ...options }),
    error: (title: string, message: string, options?: Partial<SmartNotification>) => 
      (window as any).smartNotify?.({ type: 'error', title, message, priority: 'high', ...options }),
    warning: (title: string, message: string, options?: Partial<SmartNotification>) => 
      (window as any).smartNotify?.({ type: 'warning', title, message, priority: 'medium', ...options }),
    info: (title: string, message: string, options?: Partial<SmartNotification>) => 
      (window as any).smartNotify?.({ type: 'info', title, message, priority: 'low', ...options }),
    ai: (title: string, message: string, options?: Partial<SmartNotification>) => 
      (window as any).smartNotify?.({ type: 'ai', title, message, priority: 'medium', ...options }),
    system: (title: string, message: string, options?: Partial<SmartNotification>) => 
      (window as any).smartNotify?.({ type: 'system', title, message, priority: 'low', ...options }),
  };
};

export default SmartNotificationSystem;