'use client';

import { useEffect, useCallback } from 'react';

export const useSimpleFontOptimization = () => {
  const optimizeFonts = useCallback(() => {
    // Simple approach: force early font usage without complex font checking
    const testElements: HTMLElement[] = [];
    
    // Create test elements for each font variable
    const fontTests = [
      { family: 'var(--font-geist-sans)', text: 'Test' },
      { family: 'var(--font-geist-mono)', text: 'Code' }
    ];

    fontTests.forEach(({ family, text }, index) => {
      const element = document.createElement('span');
      element.textContent = text;
      element.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        opacity: 0;
        font-family: ${family};
        font-size: 16px;
        pointer-events: none;
      `;
      element.setAttribute('aria-hidden', 'true');
      element.id = `font-test-${index}`;
      
      document.body.appendChild(element);
      testElements.push(element);
    });

    // Force layout calculation
    testElements.forEach(el => {
      el.offsetHeight; // Trigger layout
    });

    // Clean up after fonts should be loaded
    setTimeout(() => {
      testElements.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[FontOptimization] Font usage optimization completed');
      }
    }, 1000);
  }, []);

  useEffect(() => {
    // Run immediately if DOM is ready
    if (document.readyState !== 'loading') {
      optimizeFonts();
    } else {
      document.addEventListener('DOMContentLoaded', optimizeFonts);
    }

    // Also run on window load as fallback
    window.addEventListener('load', optimizeFonts);

    return () => {
      document.removeEventListener('DOMContentLoaded', optimizeFonts);
      window.removeEventListener('load', optimizeFonts);
    };
  }, [optimizeFonts]);
};