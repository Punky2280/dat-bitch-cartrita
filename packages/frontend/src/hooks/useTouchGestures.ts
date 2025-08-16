// Touch Gesture Hook for Mobile Interactions
// Provides swipe, pinch, tap, and other mobile gesture support

import { useRef, useEffect, useState, useCallback } from 'react';

export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
  duration: number;
}

export interface PinchGesture {
  scale: number;
  center: { x: number; y: number };
}

export interface TapGesture {
  x: number;
  y: number;
  count: number; // For double/triple tap detection
}

interface UseTouchGesturesOptions {
  onSwipe?: (gesture: SwipeGesture) => void;
  onPinch?: (gesture: PinchGesture) => void;
  onTap?: (gesture: TapGesture) => void;
  onLongPress?: (point: TouchPoint) => void;
  
  // Thresholds
  swipeThreshold?: number;
  longPressThreshold?: number;
  doubleTapThreshold?: number;
  
  // Enable/disable gestures
  enableSwipe?: boolean;
  enablePinch?: boolean;
  enableTap?: boolean;
  enableLongPress?: boolean;
}

export function useTouchGestures(options: UseTouchGesturesOptions = {}) {
  const {
    onSwipe,
    onPinch,
    onTap,
    onLongPress,
    swipeThreshold = 50,
    longPressThreshold = 500,
    doubleTapThreshold = 300,
    enableSwipe = true,
    enablePinch = true,
    enableTap = true,
    enableLongPress = true
  } = options;

  const touchStartRef = useRef<TouchList | null>(null);
  const touchStartTime = useRef<number>(0);
  const lastTapTime = useRef<number>(0);
  const tapCount = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const initialDistance = useRef<number>(0);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    touchStartRef.current = event.touches;
    touchStartTime.current = Date.now();

    // Handle long press
    if (enableLongPress && event.touches.length === 1) {
      const touch = event.touches[0];
      longPressTimer.current = setTimeout(() => {
        onLongPress?.({
          x: touch.clientX,
          y: touch.clientY,
          timestamp: Date.now()
        });
      }, longPressThreshold);
    }

    // Handle pinch start
    if (enablePinch && event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      initialDistance.current = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
    }
  }, [enableLongPress, enablePinch, onLongPress, longPressThreshold]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    // Clear long press timer on move
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Handle pinch
    if (enablePinch && event.touches.length === 2 && touchStartRef.current?.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      if (initialDistance.current > 0) {
        const scale = currentDistance / initialDistance.current;
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;

        onPinch?.({
          scale,
          center: { x: centerX, y: centerY }
        });
      }
    }
  }, [enablePinch, onPinch]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const touchStart = touchStartRef.current;
    const touchEnd = event.changedTouches;
    const duration = Date.now() - touchStartTime.current;

    if (!touchStart || touchStart.length !== 1 || touchEnd.length !== 1) {
      return;
    }

    const startTouch = touchStart[0];
    const endTouch = touchEnd[0];

    const deltaX = endTouch.clientX - startTouch.clientX;
    const deltaY = endTouch.clientY - startTouch.clientY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Handle swipe
    if (enableSwipe && distance > swipeThreshold) {
      const velocity = distance / duration;
      let direction: SwipeGesture['direction'];

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      onSwipe?.({
        direction,
        distance,
        velocity,
        duration
      });
    }
    // Handle tap (if not a swipe)
    else if (enableTap && distance < swipeThreshold) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime.current;

      if (timeSinceLastTap < doubleTapThreshold) {
        tapCount.current += 1;
      } else {
        tapCount.current = 1;
      }

      lastTapTime.current = now;

      // Debounce tap events to detect multiple taps
      setTimeout(() => {
        const currentTime = Date.now();
        if (currentTime - lastTapTime.current >= doubleTapThreshold - 50) {
          onTap?.({
            x: endTouch.clientX,
            y: endTouch.clientY,
            count: tapCount.current
          });
          tapCount.current = 0;
        }
      }, doubleTapThreshold);
    }

    // Reset
    touchStartRef.current = null;
    initialDistance.current = 0;
  }, [enableSwipe, enableTap, swipeThreshold, doubleTapThreshold, onSwipe, onTap]);

  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Add touch event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return ref;
}

// Hook for pull-to-refresh functionality
interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export function usePullToRefresh(options: UsePullToRefreshOptions) {
  const { onRefresh, threshold = 100, disabled = false } = options;
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY = useRef<number>(0);
  const scrollElement = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const element = scrollElement.current;
    if (!element || element.scrollTop > 0) return;

    startY.current = event.touches[0].clientY;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (disabled || isRefreshing || startY.current === 0) return;

    const element = scrollElement.current;
    if (!element || element.scrollTop > 0) return;

    const currentY = event.touches[0].clientY;
    const distance = currentY - startY.current;

    if (distance > 0) {
      event.preventDefault();
      setIsPulling(true);
      setPullDistance(Math.min(distance, threshold * 1.5));
    }
  }, [disabled, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async (event: TouchEvent) => {
    if (disabled || isRefreshing || !isPulling) return;

    setIsPulling(false);
    startY.current = 0;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, isPulling, pullDistance, threshold, onRefresh]);

  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    scrollElement.current = element;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    ref,
    isPulling,
    pullDistance,
    isRefreshing,
    pullProgress: pullDistance / threshold
  };
}
