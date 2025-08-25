'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToasts } from '@/store';
import useAppStore from '@/store';
import { cn } from '@/lib/utils';

const ToastContainer: React.FC = () => {
  const toasts = useToasts();
  const { removeToast } = useAppStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "p-4 rounded-lg shadow-lg border backdrop-blur-sm",
              getStyles(toast.type)
            )}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {getIcon(toast.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <div className="font-medium text-sm mb-1">
                    {toast.title}
                  </div>
                )}
                {toast.description && (
                  <div className="text-sm opacity-90">
                    {toast.description}
                  </div>
                )}
                
                {toast.action && (
                  <div className="mt-2">
                    <button
                      onClick={toast.action.onClick}
                      className="text-sm font-medium underline hover:no-underline"
                    >
                      {toast.action.label}
                    </button>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;