'use client';

import { useState, useEffect } from 'react';

interface FontLoadingStatusProps {
  showInDevelopment?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const FontLoadingStatus = ({ 
  showInDevelopment = true,
  position = 'bottom-right'
}: FontLoadingStatusProps) => {
  const [fontStatus, setFontStatus] = useState<{
    loading: boolean;
    loaded: number;
    total: number;
    errors: string[];
  }>({
    loading: true,
    loaded: 0,
    total: 0,
    errors: []
  });

  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show in development mode
    if (process.env.NODE_ENV !== 'development' || !showInDevelopment) {
      return;
    }

    setShow(true);

    if (!('fonts' in document)) {
      setFontStatus(prev => ({
        ...prev,
        loading: false,
        errors: ['Font Loading API not supported']
      }));
      return;
    }

    const updateFontStatus = () => {
      const loadedFonts = Array.from(document.fonts.values());
      const loadedCount = loadedFonts.filter((font: any) => font.status === 'loaded').length;
      
      setFontStatus(prev => ({
        ...prev,
        loaded: loadedCount,
        total: loadedFonts.length,
        loading: loadedCount < loadedFonts.length
      }));
    };

    // Initial check
    updateFontStatus();

    // Listen for font loading events
    const handleFontLoad = () => updateFontStatus();
    const handleFontError = (event: Event) => {
      setFontStatus(prev => ({
        ...prev,
        errors: [...prev.errors, `Font loading error: ${event.type}`]
      }));
    };

    document.fonts.addEventListener('loadingdone', handleFontLoad);
    document.fonts.addEventListener('loadingerror', handleFontError);

    // Check when all fonts are ready
    document.fonts.ready.then(() => {
      setFontStatus(prev => ({
        ...prev,
        loading: false
      }));

      // Hide status after all fonts are loaded
      setTimeout(() => {
        setShow(false);
      }, 2000);
    });

    return () => {
      document.fonts.removeEventListener('loadingdone', handleFontLoad);
      document.fonts.removeEventListener('loadingerror', handleFontError);
    };
  }, [showInDevelopment]);

  if (!show || process.env.NODE_ENV !== 'development') {
    return null;
  }

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 bg-black/80 text-white px-3 py-2 rounded-lg text-xs font-mono shadow-lg`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            fontStatus.loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'
          }`}
        />
        <span>
          Fonts: {fontStatus.loaded}/{fontStatus.total}
          {fontStatus.loading ? ' Loading...' : ' Loaded'}
        </span>
      </div>
      
      {fontStatus.errors.length > 0 && (
        <div className="mt-1 text-red-400">
          {fontStatus.errors.map((error, index) => (
            <div key={index} className="text-xs">
              ⚠️ {error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};