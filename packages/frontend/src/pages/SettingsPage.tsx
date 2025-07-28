// packages/frontend/src/pages/SettingsPage.tsx
import React, { useState, useEffect, FormEvent } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { useAmbient } from '../context/AmbientContext';

// --- Interfaces ---
interface ApiKey {
  id: number;
  service_name: string;
  updated_at: string;
}

interface SettingsPageProps {
  token: string;
}

// --- Component ---
const SettingsPage: React.FC<SettingsPageProps> = ({ token }) => {
  const { t, i18n } = useTranslation();
  const [theme, toggleTheme] = useTheme();
  const { isAmbientModeEnabled, permissionState, enableAmbientMode, disableAmbientMode } = useAmbient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyService, setNewKeyService] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [userRes, keysRes] = await Promise.all([
          fetch('/api/user/me', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/keys', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!userRes.ok) throw new Error('Failed to fetch user data');
        const userData = await userRes.json();
        setName(userData.name);
        setEmail(userData.email);

        if (!keysRes.ok) throw new Error('Failed to fetch API keys');
        const keysData = await keysRes.json();
        setApiKeys(keysData);

      } catch (error: any) {
        setMessage({ type: 'error', text: error.message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, [token]);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await fetch('/api/user/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
  
  const handleAddApiKey = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!newKeyService || !newKeyValue) {
      setMessage({ type: 'error', text: 'Service name and API key are required.' });
      return;
    }
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ service_name: newKeyService, api_key: newKeyValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save API key.');
      
      setMessage({ type: 'success', text: `API key for ${data.service_name} saved.` });
      setApiKeys(prev => [...prev.filter(k => k.service_name !== data.service_name), data]);
      setNewKeyService('');
      setNewKeyValue('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDeleteApiKey = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this API key?')) return;
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete API key.');
      setMessage({ type: 'success', text: 'API key deleted.' });
      setApiKeys(prev => prev.filter(key => key.id !== id));
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const changeLanguage = (lng: string) => { i18n.changeLanguage(lng); };

  if (isLoading) {
    return <div className="text-white text-center p-8">Loading settings...</div>;
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-cyan-400 mb-6">{t('settings.title')}</h1>

        {message && (
          <div className={`p-3 rounded-lg mb-6 text-center ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-8">
          {/* Ambient Intelligence Section */}
          <div className="bg-black bg-opacity-30 border-2 border-green-500 p-6 rounded-lg shadow-lg shadow-green-500/20">
            <h2 className="text-xl font-semibold mb-4 text-green-300">Ambient Intelligence</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300">Allow Cartrita to see and hear your environment.</p>
                <p className="text-xs text-gray-500">This requires microphone and camera access.</p>
              </div>
              {isAmbientModeEnabled ? (
                <button
                  onClick={disableAmbientMode}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg"
                >
                  Disable Ambient Mode
                </button>
              ) : (
                <button
                  onClick={enableAmbientMode}
                  disabled={permissionState === 'denied'}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {permissionState === 'denied' ? 'Permissions Denied' : 'Enable Ambient Mode'}
                </button>
              )}
            </div>
             {permissionState === 'denied' && <p className="text-red-400 text-xs mt-2">You have denied permissions. To enable this feature, you must grant microphone and camera access in your browser's site settings.</p>}
          </div>

          <div className="bg-black bg-opacity-30 border border-gray-700 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Language & Appearance</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Language</span>
                <div className="flex gap-2">
                  <button onClick={() => changeLanguage('en')} className={`font-bold py-2 px-4 rounded-lg ${i18n.language === 'en' ? 'bg-cyan-500' : 'bg-gray-700 hover:bg-gray-600'}`}>English</button>
                  <button onClick={() => changeLanguage('es')} className={`font-bold py-2 px-4 rounded-lg ${i18n.language === 'es' ? 'bg-cyan-500' : 'bg-gray-700 hover:bg-gray-600'}`}>Español</button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">{t('settings.theme')}</span>
                <button
                  onClick={toggleTheme}
                  className="bg-gray-700 hover:bg-gray-600 text-cyan-300 font-bold py-2 px-4 rounded-lg capitalize"
                >
                  {theme === 'dark' ? t('settings.switchToLight') : t('settings.switchToDark')}
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-black bg-opacity-30 border-2 border-purple-500 p-6 rounded-lg shadow-lg shadow-purple-500/20">
            <h2 className="text-xl font-semibold mb-4 text-purple-300">API Key Vault</h2>
            <form onSubmit={handleAddApiKey} className="space-y-4 mb-6">
              <input type="text" placeholder="Service Name (e.g., GoogleCalendar)" value={newKeyService} onChange={(e) => setNewKeyService(e.target.value)} className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <input type="password" placeholder="Paste API Key Here" value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <div className="text-right">
                <button type="submit" className="bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-2 font-bold rounded-lg hover:from-purple-700 hover:to-pink-600 transition-all">
                  Save Key
                </button>
              </div>
            </form>
            <h3 className="text-lg font-semibold mb-2 text-gray-300">Saved Keys</h3>
            <div className="space-y-2">
              {apiKeys.length > 0 ? apiKeys.map(key => (
                <div key={key.id} className="flex justify-between items-center bg-gray-800 p-3 rounded-lg">
                  <span className="font-mono text-cyan-400">{key.service_name}</span>
                  <button onClick={() => handleDeleteApiKey(key.id)} className="text-red-400 hover:text-red-300 font-bold text-sm">DELETE</button>
                </div>
              )) : (
                <p className="text-gray-500">No API keys saved yet.</p>
              )}
            </div>
          </div>
          
          <div className="bg-black bg-opacity-30 border border-gray-700 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">{t('settings.profileInfo')}</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-400">{t('settings.email')}</label>
                <input id="email" type="email" value={email} disabled className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 cursor-not-allowed" />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-400">{t('settings.name')}</label>
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div className="text-right">
                <button type="submit" className="bg-cyan-600 px-6 py-2 font-bold rounded-lg hover:bg-cyan-500 transition-colors">{t('settings.updateProfile')}</button>
              </div>
            </form>
          </div>

          <div className="bg-black bg-opacity-30 border border-gray-700 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">{t('settings.changePassword')}</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-400">{t('settings.currentPassword')}</label>
                <input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-400">{t('settings.newPassword')}</label>
                <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div>
                <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-400">{t('settings.confirmNewPassword')}</label>
                <input id="confirmNewPassword" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div className="text-right">
                <button type="submit" className="bg-cyan-600 px-6 py-2 font-bold rounded-lg hover:bg-cyan-500 transition-colors">{t('settings.changePassword')}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
