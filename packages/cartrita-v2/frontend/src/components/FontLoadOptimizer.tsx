"use client";

import { useFontOptimization } from '@/hooks/useFontOptimization';
import { useSimpleFontOptimization } from '@/hooks/useSimpleFontOptimization';

export function FontLoadOptimizer() {
  // Use both optimization approaches for maximum reliability
  useSimpleFontOptimization(); // Simple, reliable baseline
  
  // Advanced features with error handling - disabled removeUnusedPreloads to prevent DevTools warning
  useFontOptimization({
    removeUnusedPreloads: false, // Disabled to prevent "preloaded but not used" DevTools warning
    forceEarlyUsage: true,
    monitorFontLoading: process.env.NODE_ENV === 'development',
    debugMode: process.env.NODE_ENV === 'development',
  });

  return null; // This component doesn't render anything
}