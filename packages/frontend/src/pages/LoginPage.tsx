// packages/frontend/src/pages/LoginPage.tsx
import { useState, FormEvent } from 'react';

interface LoginPageProps {
  onLoginSuccess: (token: string) => void;
  onSwitchToRegister: () => void;
}

export const LoginPage = ({ onLoginSuccess, onSwitchToRegister }: LoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      // FIXED: Add specific error handling for invalid credentials
      if (res.status === 401) {
        throw new Error('Invalid email or password.');
      }

      if (!res.ok) {
        throw new Error(data.message || 'Login failed. Please try again.');
      }
      
      onLoginSuccess(data.token);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 bg-opacity-80 border-2 border-cyan-500 rounded-2xl shadow-lg shadow-cyan-500/20">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-white">Welcome Back</h2>
          <p className="mt-2 text-gray-400">Log in to access your dashboard</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            className="w-full bg-gray-900 text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition" 
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="w-full bg-gray-900 text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition" 
            required 
          />
          
          {error && <p className="text-red-400 text-center font-semibold">{error}</p>}
          
          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white p-3 rounded-lg font-bold text-lg hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Logging In...' : 'Login'}
          </button>
        </form>

        <p className="text-center text-gray-400">
          Don't have an account?{' '}
          <button onClick={onSwitchToRegister} className="font-bold text-cyan-400 hover:underline">
            Register here
          </button>
        </p>
      </div>
    </div>
  );
};
