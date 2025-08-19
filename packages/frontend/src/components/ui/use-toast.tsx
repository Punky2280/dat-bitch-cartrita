import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastState {
  toasts: Toast[];
}

const toastState: ToastState = {
  toasts: [],
};

export const useToast = () => {
  const [, forceUpdate] = useState({});

  const toast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    
    toastState.toasts.push(newToast);
    forceUpdate({});

    // Auto remove after 5 seconds
    setTimeout(() => {
      toastState.toasts = toastState.toasts.filter(t => t.id !== id);
      forceUpdate({});
    }, 5000);
  }, []);

  const dismiss = useCallback((toastId: string) => {
    toastState.toasts = toastState.toasts.filter(t => t.id !== toastId);
    forceUpdate({});
  }, []);

  return {
    toast,
    dismiss,
    toasts: toastState.toasts,
  };
};