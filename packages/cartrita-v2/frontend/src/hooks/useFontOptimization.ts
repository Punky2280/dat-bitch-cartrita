'use client';

import { useEffect, useCallback } from 'react';

interface FontOptimizationConfig {
  removeUnusedPreloads?: boolean;
  forceEarlyUsage?: boolean;
  monitorFontLoading?: boolean;
  debugMode?: boolean;
}

export const useFontOptimization = (config: FontOptimizationConfig = {}) => {
  const {
    removeUnusedPreloads = true,
    forceEarlyUsage = true,
    monitorFontLoading = true,
    debugMode = false
  } = config;

  const log = useCallback((message: string, ...args: any[]) => {
    if (debugMode) {
      console.log(`[FontOptimizer] ${message}`, ...args);
    }
  }, [debugMode]);

  const forceEarlyFontUsage = useCallback(() => {
    if (!forceEarlyUsage) {
      return;
    }

    const testElements: HTMLElement[] = [];
    const fontVariables = [
      'var(--font-geist-sans)',
      'var(--font-geist-mono)'
    ];

    fontVariables.forEach((fontFamily, index) => {
      const element = document.createElement('div');
      element.textContent = 'Font loading test';
      element.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        visibility: hidden;
        font-family: ${fontFamily};
        font-size: 16px;
        font-weight: 400;
        line-height: 1;
        white-space: nowrap;
        pointer-events: none;
      `;
      element.setAttribute('aria-hidden', 'true');
      element.id = `font-preload-optimizer-${index}`;
      
      document.body.appendChild(element);
      testElements.push(element);
      
      log(`Forced early usage for font: ${fontFamily}`);
    });

    // Force layout calculation to trigger font loading
    testElements.forEach(el => el.offsetHeight);

    // Clean up test elements
    setTimeout(() => {
      testElements.forEach(element => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
      log(`Cleaned up ${testElements.length} test elements`);
    }, 500);
  }, [forceEarlyUsage, log]);

  const removeUnusedFontPreloads = useCallback(() => {
    if (!removeUnusedPreloads) {
      return;
    }

    setTimeout(() => {
      const preloadLinks = document.querySelectorAll('link[rel="preload"][as="font"]') as NodeListOf<HTMLLinkElement>;
      let removedCount = 0;

      preloadLinks.forEach((link) => {
        const { href } = link;
        
        // Check if this is a Next.js generated font file
        if (href.includes('/_next/static/media/') && href.includes('.woff2')) {
          try {
            // Advanced font checking with proper error handling
            const testElement = document.createElement('div');
            testElement.style.fontFamily = 'var(--font-geist-sans)';
            testElement.style.position = 'absolute';
            testElement.style.visibility = 'hidden';
            testElement.style.fontSize = '16px';
            testElement.textContent = 'test';
            document.body.appendChild(testElement);
            
            // Get the computed font family
            const computedStyle = window.getComputedStyle(testElement);
            const actualFontFamily = computedStyle.fontFamily;
            
            document.body.removeChild(testElement);
            
            // Check font loading status using multiple methods
            let isFontUsed = true; // Default to keeping fonts
            
            if (actualFontFamily && actualFontFamily !== 'var(--font-geist-sans)') {
              // Extract first font from the computed font stack
              const fontNames = actualFontFamily.split(',').map(name => 
                name.trim().replace(/^["']|["']$/g, '')
              );
              
              // Try to check with the actual font name
              for (const fontName of fontNames) {
                if (fontName && !fontName.includes('system-ui') && !fontName.includes('sans-serif')) {
                  try {
                    // Use a more reliable font check method
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.font = `16px "${fontName}"`;
                      const metrics = ctx.measureText('test');
                      isFontUsed = metrics.width > 0;
                      break;
                    }
                  } catch (canvasError) {
                    log(`Canvas font check failed: ${canvasError}`);
                    // Fallback to document.fonts if available
                    if ('fonts' in document && document.fonts.check) {
                      try {
                        isFontUsed = document.fonts.check(`16px "${fontName}"`);
                      } catch (fontCheckError) {
                        log(`Font check failed for ${fontName}: ${fontCheckError}`);
                        isFontUsed = true; // Conservative approach
                      }
                    }
                  }
                }
              }
            }
            
            // Only remove if clearly unused and safe to do so
            if (!isFontUsed && document.fonts.status === 'loaded') {
              log(`Removing unused preload: ${href}`);
              link.remove();
              removedCount++;
            } else {
              log(`Keeping font preload (in use): ${href}`);
            }
            
          } catch (error) {
            log(`Font analysis error: ${error}. Keeping preload for safety.`);
            // Always keep fonts if analysis fails
          }
        }
      });

      if (removedCount > 0) {
        log(`Removed ${removedCount} unused font preload links`);
      } else {
        log('All font preloads kept - fonts are in use');
      }
    }, 5000); // Increased delay for better reliability
  }, [removeUnusedPreloads, log]);

  const monitorFontLoadingStatus = useCallback(() => {
    if (!monitorFontLoading) {
      return;
    }

    if ('fonts' in document) {
      document.fonts.ready.then(() => {
        const loadedFonts = Array.from(document.fonts.values());
        log(`All fonts loaded. Total fonts: ${loadedFonts.length}`);
        
        loadedFonts.forEach((font: any) => {
          log(`Font loaded: ${font.family} ${font.weight} ${font.style}`);
        });
      });

      // Monitor individual font loading
      document.fonts.addEventListener('loadingdone', (event: any) => {
        log('Font loading completed:', event);
      });

      document.fonts.addEventListener('loadingerror', (event: any) => {
        console.warn('[FontOptimizer] Font loading error:', event);
      });
    }
  }, [monitorFontLoading, log]);

  useEffect(() => {
    const initOptimization = () => {
      log('Initializing font optimization');
      forceEarlyFontUsage();
      removeUnusedFontPreloads();
      monitorFontLoadingStatus();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initOptimization);
    } else {
      initOptimization();
    }

    // Also run on window load as a fallback
    window.addEventListener('load', initOptimization);

    return () => {
      document.removeEventListener('DOMContentLoaded', initOptimization);
      window.removeEventListener('load', initOptimization);
    };
  }, [forceEarlyFontUsage, removeUnusedFontPreloads, monitorFontLoadingStatus, log]);

  return {
    forceEarlyFontUsage,
    removeUnusedFontPreloads,
    monitorFontLoadingStatus,
  };
};