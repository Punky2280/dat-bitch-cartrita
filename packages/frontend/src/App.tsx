// packages/frontend/src/App.tsx
import { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { useTheme } from './hooks/useTheme'; // Import the new hook

type AuthView = 'login' | 'register';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [authView, setAuthView] = useState<AuthView>('login');
  
  // Initialize the theme hook to apply the theme on load
  useTheme();

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const handleLogin = (newToken: string) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setAuthView('login'); // Go back to login page on logout
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

  return <DashboardPage token={token} onLogout={handleLogout} />;
}

export default App;
