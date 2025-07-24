import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChatPage } from './pages/ChatPage';

type View = 'login' | 'register';

function App() {
  const { token, saveToken, logout } = useAuth();
  const [view, setView] = useState<View>('login');

  if (token) {
    return <ChatPage token={token} onLogout={logout} />;
  }

  return (
    <div className='bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center font-mono p-4'>
       <header className="text-center mb-12">
        <h1 className='text-5xl font-bold text-cyan-400'>Dat Bitch Cartrita</h1>
        <p className="text-gray-500 mt-2">Your AGI with Attitude</p>
      </header>
      {view === 'login' ? (
        <LoginPage 
          onLoginSuccess={saveToken} 
          onSwitchToRegister={() => setView('register')} 
        />
      ) : (
        <RegisterPage 
          onRegisterSuccess={() => setView('login')}
          onSwitchToLogin={() => setView('login')}
        />
      )}
    </div>
  );
}

export default App;
