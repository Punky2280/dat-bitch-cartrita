// packages/frontend/src/pages/SettingsPage.tsx
import React, { useState, useEffect, FormEvent } from 'react';
import { useTheme } from '../hooks/useTheme'; // Import the theme hook

interface SettingsPageProps {
  token: string;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ token }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [theme, toggleTheme] = useTheme(); // Use the theme hook

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/user/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch user data');
        const data = await res.json();
        setName(data.name);
        setEmail(data.email);
      } catch (error) {
        console.error(error);
        setMessage({ type: 'error', text: 'Could not load user data.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [token]);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await fetch('/api/user/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile.');
      setMessage({ type: 'success', text: data.message });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmNewPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    try {
      const res = await fetch('/api/user/me/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to change password.');
      setMessage({ type: 'success', text: data.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  if (isLoading) {
    return <div className="text-white">Loading settings...</div>;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 text-white">
      <h1 className="text-3xl font-bold text-cyan-400 mb-6">Settings</h1>

      {message && (
        <div className={`p-3 rounded-lg mb-6 text-center ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* Appearance Section */}
        <div className="bg-black bg-opacity-30 border border-gray-700 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Appearance</h2>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Theme</span>
            <button
              onClick={toggleTheme}
              className="bg-gray-700 hover:bg-gray-600 text-cyan-300 font-bold py-2 px-4 rounded-lg capitalize"
            >
              Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
            </button>
          </div>
        </div>
        
        {/* Profile Information Section */}
        <div className="bg-black bg-opacity-30 border border-gray-700 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-400">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                disabled
                className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-400">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="text-right">
              <button type="submit" className="bg-cyan-600 px-6 py-2 font-bold rounded-lg hover:bg-cyan-500 transition-colors">
                Update Profile
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Section */}
        <div className="bg-black bg-opacity-30 border border-gray-700 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-400">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-400">New Password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-400">Confirm New Password</label>
              <input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="text-right">
              <button type="submit" className="bg-cyan-600 px-6 py-2 font-bold rounded-lg hover:bg-cyan-500 transition-colors">
                Change Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
