"use client";

import { useEffect, useState } from 'react';

interface ChunkError {
  url: string;
  timestamp: number;
  recovered: boolean;
}

export function ChunkErrorDiagnostic() {
  const [chunkErrors, setChunkErrors] = useState<ChunkError[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for chunk loading errors
    const handleChunkError = (event: ErrorEvent) => {
      const errorMessage = event.message || '';
      const isChunkError = errorMessage.includes('Failed to load chunk') || 
                          errorMessage.includes('Loading chunk') ||
                          errorMessage.includes('/_next/static/chunks/');

      if (isChunkError) {
        const url = event.filename || 'Unknown chunk';
        const newError: ChunkError = {
          url,
          timestamp: Date.now(),
          recovered: false
        };
        
        setChunkErrors(prev => [...prev, newError]);
        setIsVisible(true);
        
        // Auto-hide after 10 seconds if recovered
        setTimeout(() => {
          setChunkErrors(prev => 
            prev.map(err => 
              err.url === url ? { ...err, recovered: true } : err
            )
          );
        }, 2000);
        
        // Try to recover by reloading the page
        console.warn('🔧 Chunk loading error detected, attempting recovery...', url);
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }, 3000);
      }
    };

    // Listen for resource load errors (for static assets)
    const handleResourceError = (event: Event) => {
      const target = event.target as HTMLScriptElement | HTMLLinkElement;
      if (target && target.src && target.src.includes('/_next/static/')) {
        const newError: ChunkError = {
          url: target.src,
          timestamp: Date.now(),
          recovered: false
        };
        
        setChunkErrors(prev => [...prev, newError]);
        setIsVisible(true);
      }
    };

    window.addEventListener('error', handleResourceError, true);
    window.addEventListener('error', handleChunkError);

    return () => {
      window.removeEventListener('error', handleResourceError, true);
      window.removeEventListener('error', handleChunkError);
    };
  }, []);

  // Auto-hide when all errors are recovered
  useEffect(() => {
    if (chunkErrors.length > 0 && chunkErrors.every(err => err.recovered)) {
      const timer = setTimeout(() => setIsVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [chunkErrors]);

  if (!isVisible || chunkErrors.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-amber-100 border-2 border-amber-300 rounded-lg p-4 max-w-sm shadow-lg">
      <div className="flex items-start gap-2">
        <div className="text-amber-600">⚠️</div>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-800 text-sm">
            Chunk Loading Issue Detected
          </h3>
          <p className="text-amber-700 text-xs mt-1">
            Attempting recovery... Page will reload shortly.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-2 text-xs">
              <summary className="text-amber-600 cursor-pointer">
                Technical Details
              </summary>
              <div className="mt-1 text-amber-600 font-mono text-xs bg-amber-50 p-2 rounded">
                {chunkErrors.slice(-3).map((error, i) => (
                  <div key={i} className="truncate">
                    {error.url} {error.recovered ? '✓' : '⏳'}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-amber-600 hover:text-amber-800 text-sm"
        >
          ×
        </button>
      </div>
    </div>
  );
}