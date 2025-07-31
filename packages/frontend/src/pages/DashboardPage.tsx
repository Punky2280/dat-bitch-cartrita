import { useState, useEffect } from 'react';
import { ChatComponent } from '@/components/ChatComponent';
import { SettingsPage } from '@/pages/SettingsPage';
import { WorkflowsPage } from '@/pages/WorkflowsPage';
import { KnowledgeHubPage } from '@/pages/KnowledgeHubPage';
import { ApiKeyVaultPage } from '@/pages/ApiKeyVaultPage';
import AboutPage from '@/pages/AboutPage';
import LicensePage from '@/pages/LicensePage';
import UserManualPage from '@/pages/UserManualPage';
import LiveChatButton from '@/components/LiveChatButton';
import { PermissionTester } from '@/components/PermissionTester';

interface DashboardPageProps {
  token: string;
  onLogout: () => void;
}

interface User {
  id: number;
  name: string;
  email: string;
}

type DashboardView = 'chat' | 'settings' | 'workflows' | 'knowledge' | 'vault' | 'about' | 'license' | 'manual';

export const DashboardPage = ({ token, onLogout }: DashboardPageProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<DashboardView>('chat');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Validate token format
        if (!token || typeof token !== 'string') {
          throw new Error('Invalid token format');
        }

        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Token does not have 3 parts');
        }

        // Safely decode and parse the payload
        const base64Payload = tokenParts[1];
        let decodedPayload;
        
        try {
          decodedPayload = atob(base64Payload);
        } catch (decodeError) {
          throw new Error('Failed to decode token payload');
        }

        let payload;
        try {
          payload = JSON.parse(decodedPayload);
        } catch (parseError) {
          throw new Error('Failed to parse token payload as JSON');
        }

        // Validate payload structure
        if (!payload || typeof payload !== 'object') {
          throw new Error('Invalid payload structure');
        }

        setUser({
          id: payload.userId || payload.sub || payload.id,
          name: payload.name || payload.username || 'User',
          email: payload.email || 'No email provided',
        });
      } catch (error) {
        console.error('Error parsing token:', error);
        onLogout();
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [token, onLogout]);

  if (loading) {
    return (
      <div className="min-h-screen bg-animated flex items-center justify-center">
        <div className="glass-card p-8 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="spinner"></div>
            <span className="text-white text-xl">Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show settings page
  if (currentView === 'settings') {
    return <SettingsPage token={token} onBack={() => setCurrentView('chat')} />;
  }

  // Show workflows page
  if (currentView === 'workflows') {
    return <WorkflowsPage token={token} onBack={() => setCurrentView('chat')} />;
  }

  // Show knowledge hub page
  if (currentView === 'knowledge') {
    return <KnowledgeHubPage token={token} onBack={() => setCurrentView('chat')} />;
  }

  // Show API key vault page
  if (currentView === 'vault') {
    return <ApiKeyVaultPage token={token} onBack={() => setCurrentView('chat')} />;
  }

  // Show about page
  if (currentView === 'about') {
    return <AboutPage onBack={() => setCurrentView('chat')} />;
  }

  // Show license page
  if (currentView === 'license') {
    return <LicensePage onBack={() => setCurrentView('chat')} />;
  }

  // Show user manual page
  if (currentView === 'manual') {
    return <UserManualPage onBack={() => setCurrentView('chat')} />;
  }

  // Show main dashboard
  return (
    <div className="min-h-screen bg-animated text-white">
      {/* Header */}
      <header className="glass-card border-b border-gray-600/50 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gradient">
              Dat Bitch Cartrita
            </h1>
            <p className="text-gray-400 mt-1">Welcome back, {user?.name} 👋</p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Live Chat Button */}
            <LiveChatButton 
              token={token} 
              className="transform hover:scale-105"
              onActivate={(mode) => {
                console.log(`Live chat activated in ${mode} mode`);
              }}
            />

            <button
              onClick={() => setCurrentView('workflows')}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800/50 flex items-center space-x-2"
              title="Workflows"
            >
              <span>🚀</span>
              <span className="hidden sm:inline">Workflows</span>
            </button>

            <button
              onClick={() => setCurrentView('knowledge')}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800/50 flex items-center space-x-2"
              title="Knowledge Hub"
            >
              <span>🧠</span>
              <span className="hidden sm:inline">Knowledge</span>
            </button>

            <button
              onClick={() => setCurrentView('vault')}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800/50 flex items-center space-x-2"
              title="API Key Vault"
            >
              <span>🔐</span>
              <span className="hidden sm:inline">Vault</span>
            </button>

            <button
              onClick={() => setCurrentView('settings')}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800/50 flex items-center space-x-2"
              title="Settings"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              onClick={onLogout}
              className="bg-red-600/80 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <span>🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chat Section */}
          <div className="lg:col-span-3">
            <ChatComponent token={token} />
          </div>

          {/* Enhanced Sidebar */}
          <div className="space-y-6">
            {/* User Card */}
            <div className="glass-card p-6 rounded-xl">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xl font-bold">
                  {user?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold">{user?.name}</h3>
                  <p className="text-sm text-gray-400">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-400">Online</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <span>⚡</span>
                <span>Quick Actions</span>
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => setCurrentView('workflows')}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-800/50 transition-colors flex items-center space-x-3"
                >
                  <span>🚀</span>
                  <span>Workflow Automation</span>
                </button>
                <button
                  onClick={() => setCurrentView('knowledge')}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-800/50 transition-colors flex items-center space-x-3"
                >
                  <span>🧠</span>
                  <span>Knowledge Hub</span>
                </button>
                <button
                  onClick={() => setCurrentView('vault')}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-800/50 transition-colors flex items-center space-x-3"
                >
                  <span>🔐</span>
                  <span>API Key Vault</span>
                </button>
                <button
                  onClick={() => setCurrentView('settings')}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-800/50 transition-colors flex items-center space-x-3"
                >
                  <span>⚙️</span>
                  <span>Account Settings</span>
                </button>
                <button className="w-full text-left p-3 rounded-lg hover:bg-gray-800/50 transition-colors flex items-center space-x-3">
                  <span>🗑️</span>
                  <span>Clear Chat History</span>
                </button>
                <button className="w-full text-left p-3 rounded-lg hover:bg-gray-800/50 transition-colors flex items-center space-x-3">
                  <span>🎨</span>
                  <span>Customize Theme</span>
                </button>
              </div>
            </div>

            {/* System Status */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <span>📊</span>
                <span>System Status</span>
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">AI Core</span>
                  <span className="text-green-400 flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Active</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">WebSocket</span>
                  <span className="text-green-400 flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Connected</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Database</span>
                  <span className="text-green-400 flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Online</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Sub-Agents</span>
                  <span className="text-blue-400">4 Active</span>
                </div>
              </div>
            </div>

            {/* Features Overview */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <span>🎯</span>
                <span>Available Features</span>
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">✅</span>
                  <span>Real-time Chat</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">✅</span>
                  <span>Message History</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">✅</span>
                  <span>Code Generation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-400">✅</span>
                  <span>Image Creation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-400">🔄</span>
                  <span>Voice Synthesis</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-400">🔄</span>
                  <span>Ambient Listening</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">⏳</span>
                  <span>Video Analysis</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-600/50 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-center items-center space-x-6">
            <button
              onClick={() => setCurrentView('about')}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1"
            >
              <span>ℹ️</span>
              <span>About Me</span>
            </button>
            
            <button
              onClick={() => setCurrentView('manual')}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1"
            >
              <span>📖</span>
              <span>User Manual</span>
            </button>
            
            <button
              onClick={() => setCurrentView('license')}
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1"
            >
              <span>⚖️</span>
              <span>License</span>
            </button>
            
            <div className="text-gray-500 text-xs">
              © 2025 Dat Bitch Cartrita • Iteration 21
            </div>
          </div>
        </div>
      </footer>

      {/* Permission Tester for debugging */}
      <PermissionTester />
    </div>
  );
};
