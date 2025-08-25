/**
 * Modern Chat Page - ChatGPT/Claude Style
 * Main chat interface page
 */
'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamically import the simplified chat component
const SimpleChatInterface = dynamic(() => import('@/components/chat/SimpleChatInterface'), {
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Loading Cartrita V2...</p>
      </div>
    </div>
  )
});

export default function ChatPage() {
  return (
    <div className="h-screen overflow-hidden">
      <Suspense fallback={
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading Cartrita V2...</p>
          </div>
        </div>
      }>
        <SimpleChatInterface />
      </Suspense>
    </div>
  );
}