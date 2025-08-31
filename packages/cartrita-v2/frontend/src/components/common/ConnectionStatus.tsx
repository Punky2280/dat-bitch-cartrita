'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useWebSocketStatus } from '@/hooks/useWebSocket';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  className?: string;
  showText?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  className,
  showText = false,
  position = 'top-right'
}) => {
  const { connected, connecting, reconnectAttempts } = useWebSocketStatus();

  const getStatusConfig = () => {
    if (connected) {
      return {
        icon: CheckCircle,
        color: 'text-green-500',
        bgColor: 'bg-green-100',
        text: 'Connected',
        description: 'Real-time connection active'
      };
    }

    if (connecting || reconnectAttempts > 0) {
      return {
        icon: Loader2,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-100',
        text: reconnectAttempts > 0 ? `Reconnecting (${reconnectAttempts})` : 'Connecting',
        description: 'Establishing connection...'
      };
    }

    return {
      icon: WifiOff,
      color: 'text-red-500',
      bgColor: 'bg-red-100',
      text: 'Disconnected',
      description: 'Real-time features unavailable'
    };
  };

  const status = getStatusConfig();
  const Icon = status.icon;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "fixed z-50",
        positionClasses[position],
        className
      )}
    >
      <div className={cn(
        "flex items-center space-x-2 px-3 py-2 rounded-lg shadow-lg border backdrop-blur-sm",
        status.bgColor,
        showText ? "bg-background/90" : "bg-background/95"
      )}>
        <Icon 
          className={cn(
            "w-4 h-4",
            status.color,
            (connecting || reconnectAttempts > 0) && "animate-spin"
          )}
        />
        
        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="whitespace-nowrap">
                <span className={cn("font-medium text-sm", status.color)}>
                  {status.text}
                </span>
                <p className="text-xs text-muted-foreground">
                  {status.description}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// Inline connection indicator for toolbar/header
export const InlineConnectionStatus: React.FC<{
  className?: string;
}> = ({ className }) => {
  const { connected, connecting, reconnectAttempts } = useWebSocketStatus();

  const getStatusConfig = () => {
    if (connected) {
      return {
        icon: Wifi,
        color: 'text-green-500',
        pulse: false
      };
    }

    if (connecting || reconnectAttempts > 0) {
      return {
        icon: Loader2,
        color: 'text-yellow-500',
        pulse: true
      };
    }

    return {
      icon: WifiOff,
      color: 'text-red-500',
      pulse: false
    };
  };

  const status = getStatusConfig();
  const Icon = status.icon;

  return (
    <div className={cn("flex items-center", className)}>
      <Icon 
        className={cn(
          "w-4 h-4",
          status.color,
          status.pulse && "animate-spin"
        )}
      />
    </div>
  );
};

// Detailed connection info modal/tooltip
export const ConnectionDetails: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { connected, connecting, reconnectAttempts } = useWebSocketStatus();

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-background rounded-lg shadow-lg border p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Connection Status</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Status:</span>
            <div className="flex items-center space-x-2">
              {connected ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-green-600 font-medium">Connected</span>
                </>
              ) : connecting ? (
                <>
                  <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
                  <span className="text-yellow-600 font-medium">Connecting</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-500" />
                  <span className="text-red-600 font-medium">Disconnected</span>
                </>
              )}
            </div>
          </div>

          {reconnectAttempts > 0 && (
            <div className="flex items-center justify-between">
              <span>Reconnect Attempts:</span>
              <span className="font-medium">{reconnectAttempts}</span>
            </div>
          )}

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Real-time Features:</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center space-x-2">
                {connected ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                <span>Live message streaming</span>
              </li>
              <li className="flex items-center space-x-2">
                {connected ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                <span>Typing indicators</span>
              </li>
              <li className="flex items-center space-x-2">
                {connected ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                <span>Tool execution updates</span>
              </li>
              <li className="flex items-center space-x-2">
                {connected ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                )}
                <span>Real-time notifications</span>
              </li>
            </ul>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
};

export default ConnectionStatus;