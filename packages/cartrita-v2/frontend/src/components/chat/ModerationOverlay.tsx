// Simple moderation overlay component
'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ModerationOverlayProps {
  warning: string;
  onDismiss: () => void;
}

const ModerationOverlay: React.FC<ModerationOverlayProps> = ({ warning, onDismiss }) => {
  return (
    <div className="absolute inset-0 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg flex items-center justify-center p-4">
      <div className="text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-700 dark:text-red-300 mb-3">{warning}</p>
        <button
          onClick={onDismiss}
          className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default ModerationOverlay;