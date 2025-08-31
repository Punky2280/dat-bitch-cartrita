/**
 * Advanced Chat Interface - Cartrita V2
 * Modern AI chat with enhanced features and real-time capabilities
 */
'use client';

import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import dynamic from 'next/dynamic';

// Dynamically import the AIChat component
const AIChat = dynamic(() => import('@/components/chat/AIChat'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Loading AI Chat Interface...</p>
      </div>
    </div>
  )
});

export default function ChatPage() {
  return (
    <AppLayout>
      <AIChat />
    </AppLayout>
  );
}