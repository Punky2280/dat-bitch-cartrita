// packages/frontend/src/pages/RegisterPage.tsx
import { useState, FormEvent } from 'react';

interface RegisterPageProps {
  onRegisterSuccess: () => void;
  onSwitchToLogin: () => void;
}

export const RegisterPage = ({ onRegisterSuccess, onSwitchToLogin }: RegisterPageProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      // FIXED: Add specific handling for 409 Conflict error
      if (res.status === 409) {
        throw new Error('That email is already in use. Try logging in.');
      }
      
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed for an unknown reason.');
      }
      
      setSuccess('Success! Welcome aboard. Redirecting you to login...');
      setTimeout(() => {
        onRegisterSuccess();
      }, 2000);

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
          <h2 className="text-4xl font-extrabold text-white">Create Your Account</h2>
          <p className="mt-2 text-gray-400">Join the future with Cartrita</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            type="text" 
            placeholder="Name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="w-full bg-gray-900 text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition" 
            required 
          />
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
            placeholder="Password (min. 6 characters)" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="w-full bg-gray-900 text-white p-3 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500 transition" 
            required 
          />
          
          {error && <p className="text-red-400 text-center font-semibold">{error}</p>}
          {success && <p className="text-green-400 text-center font-semibold">{success}</p>}

          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white p-3 rounded-lg font-bold text-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-gray-400">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="font-bold text-cyan-400 hover:underline">
            Login here
          </button>
        </p>
      </div>
    </div>
  );
};
