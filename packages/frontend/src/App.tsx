// packages/frontend/src/App.tsx
import { useState } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { useTheme } from './hooks/useTheme'; // Import the new hook
import { useAuth } from './hooks/useAuth';

type AuthView = 'login' | 'register';

function App() {
  const { token, setToken, logout } = useAuth();
  const [authView, setAuthView] = useState<AuthView>('login');
  
  // Initialize the theme hook to apply the theme on load
  useTheme();

  const handleLogin = (newToken: string) => {
    setToken(newToken);
  };

  const handleRegisterSuccess = () => {
    setAuthView('login');
  };

  if (!token) {
    if (authView === 'login') {
      return <LoginPage onLoginSuccess={handleLogin} onSwitchToRegister={() => setAuthView('register')} />;
    }
    return <RegisterPage onSwitchToLogin={() => setAuthView('login')} onRegisterSuccess={handleRegisterSuccess} />;
  }

  return <DashboardPage token={token} onLogout={logout} />;
}

export default App;
