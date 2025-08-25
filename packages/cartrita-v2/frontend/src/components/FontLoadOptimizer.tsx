"use client";

import { useEffect } from 'react';

export function FontLoadOptimizer() {
  useEffect(() => {
    // Ensure fonts are marked as used immediately after page load
    const optimizeFontLoading = () => {
      // Create invisible text elements using the fonts to trigger usage
      const testElements = [
        { text: 'Font optimization test', fontFamily: 'var(--font-geist-sans)' },
        { text: 'Mono test', fontFamily: 'var(--font-geist-mono)' }
      ];

      testElements.forEach(({ text, fontFamily }, index) => {
        const element = document.createElement('span');
        element.textContent = text;
        element.style.position = 'absolute';
        element.style.visibility = 'hidden';
        element.style.fontSize = '1px';
        element.style.fontFamily = fontFamily;
        element.style.pointerEvents = 'none';
        element.setAttribute('aria-hidden', 'true');
        element.id = `font-optimizer-${index}`;
        
        document.body.appendChild(element);
        
        // Remove after fonts are loaded
        setTimeout(() => {
          const existingElement = document.getElementById(`font-optimizer-${index}`);
          if (existingElement) {
            document.body.removeChild(existingElement);
          }
        }, 3000);
      });

      // Force layout recalculation to trigger font usage detection
      document.body.offsetHeight;
    };

    // Run optimization on page load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', optimizeFontLoading);
    } else {
      optimizeFontLoading();
    }

    // Cleanup
    return () => {
      document.removeEventListener('DOMContentLoaded', optimizeFontLoading);
    };
  }, []);

  return null; // This component doesn't render anything
}