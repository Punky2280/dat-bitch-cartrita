"use client";

import { useEffect } from 'react';

/**
 * ClientBodyHandler - Manages browser extension compatibility
 * Handles attributes injected by browser extensions like Grammarly
 * to prevent hydration mismatch errors
 */
export function ClientBodyHandler() {
  useEffect(() => {
    // List of known browser extension attributes that cause hydration mismatches
    const extensionAttributes = [
      'data-new-gr-c-s-check-loaded', // Grammarly
      'data-gr-ext-installed',        // Grammarly
      'data-1p-ignore',               // 1Password
      'data-lastpass-icon-root',      // LastPass
      'data-dashlane-root',           // Dashlane
      'data-ms-editor',               // Microsoft Editor
      'cz-shortcut-listen',           // ColorZilla
      'spellcheck',                   // Various extensions
    ];

    // Clean up extension attributes during development to reduce console noise
    if (process.env.NODE_ENV === 'development') {
      const { body } = document;
      extensionAttributes.forEach(attr => {
        if (body.hasAttribute(attr)) {
          console.debug(`🔧 Detected browser extension attribute: ${attr}`);
        }
      });
    }

    // Optional: Add a class to indicate extensions are present for CSS targeting
    const hasExtensions = extensionAttributes.some(attr => 
      document.body.hasAttribute(attr)
    );
    
    if (hasExtensions) {
      document.body.classList.add('has-browser-extensions');
    }
  }, []);

  return null; // This component doesn't render anything
}