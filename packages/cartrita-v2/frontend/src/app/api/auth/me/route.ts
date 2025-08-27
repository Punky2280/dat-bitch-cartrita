import { NextRequest, NextResponse } from 'next/server';

// Mock authentication endpoint for development
export async function GET(request: NextRequest) {
  // Return a mock user for development purposes
  const mockUser = {
    id: 'dev-user-123',
    name: 'Development User',
    email: 'dev@cartrita.ai',
    avatar: null,
    role: 'user',
    permissions: [
      'chat.create',
      'chat.read', 
      'analytics.view',
      'tools.use'
    ],
    preferences: {
      theme: 'dark',
      language: 'en',
      timezone: 'America/Miami',
      notifications: {
        email: false,
        push: false,
        desktop: true,
      },
      accessibility: {
        reducedMotion: false,
        highContrast: false,
        fontSize: 'medium',
      },
    },
    subscription: {
      plan: 'pro',
      status: 'active',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      features: [
        'unlimited_chats',
        'advanced_models',
        'voice_input',
        'file_attachments',
      ],
    },
    usage: {
      apiCalls: 42,
      tokensUsed: 15420,
      agentsCreated: 3,
      lastActive: new Date().toISOString(),
    },
    security: {
      twoFactorEnabled: false,
      lastPasswordChange: new Date().toISOString(),
      activeSessions: 1,
      loginHistory: [],
    },
  };

  return NextResponse.json(mockUser);
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}