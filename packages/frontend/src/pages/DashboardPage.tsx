// packages/frontend/src/pages/DashboardPage.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatComponent } from '../components/ChatComponent';
import { FractalVisualizer } from '../components/FractalVisualizer';
import SettingsPage from './SettingsPage';
import AboutPage from './AboutPage';
import LicensePage from './LicensePage';
import BackstoryPage from './BackstoryPage';
import WorkflowBuilderPage from './WorkflowBuilderPage'; // Import the new page

interface DashboardPageProps {
  token: string;
  onLogout: () => void;
}

// Add 'workflows' to the possible views
type View = 'chat' | 'visualizer' | 'settings' | 'about' | 'license' | 'backstory' | 'workflows';

export const DashboardPage = ({ token, onLogout }: DashboardPageProps) => {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<View>('chat');

  const renderView = () => {
    switch (currentView) {
      case 'chat':
        return <ChatComponent token={token} />;
      case 'visualizer':
        return <FractalVisualizer />;
      case 'settings':
        return <SettingsPage token={token} />;
      case 'about':
        return <AboutPage />;
      case 'license':
        return <LicensePage />;
      case 'backstory':
        return <BackstoryPage />;
      case 'workflows':
        return <WorkflowBuilderPage token={token} />;
      default:
        return <ChatComponent token={token} />;
    }
  };

  const getButtonClass = (view: View) => {
    return `px-4 py-2 font-bold rounded-lg transition-colors ${
      currentView === view
        ? 'bg-cyan-500 text-white'
        : 'bg-gray-700 text-cyan-300 hover:bg-gray-600'
    }`;
  };

  return (
    <div className="w-screen h-screen bg-gray-900 text-white flex flex-col p-4 gap-4">
      <header className="flex justify-between items-center bg-black bg-opacity-20 p-4 rounded-lg border border-gray-700">
        <h1 className="text-2xl font-bold text-cyan-400 cursor-pointer" onClick={() => setCurrentView('chat')}>
          Dat Bitch Cartrita
        </h1>
        <nav className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
          <button onClick={() => setCurrentView('chat')} className={getButtonClass('chat')}>
            {t('dashboard.chat')}
          </button>
          <button onClick={() => setCurrentView('visualizer')} className={getButtonClass('visualizer')}>
            {t('dashboard.visualizer')}
          </button>
          {/* Add the new Workflows button */}
          <button onClick={() => setCurrentView('workflows')} className={getButtonClass('workflows')}>
            Workflows
          </button>
          <button onClick={() => setCurrentView('backstory')} className={getButtonClass('backstory')}>
            {t('dashboard.backstory')}
          </button>
          <button onClick={() => setCurrentView('settings')} className={getButtonClass('settings')}>
            {t('dashboard.settings')}
          </button>
          <button 
            onClick={onLogout} 
            className="bg-red-600 hover:bg-red-500 px-4 py-2 font-bold rounded-lg transition-colors"
          >
            {t('dashboard.logout')}
          </button>
        </nav>
      </header>
      <main className="flex-grow h-full overflow-hidden">
        {renderView()}
      </main>
      <footer className="text-center text-xs text-gray-500">
        <button onClick={() => setCurrentView('about')} className="hover:text-cyan-400 transition-colors">{t('dashboard.about')}</button>
        <span className="mx-2">|</span>
        <button onClick={() => setCurrentView('license')} className="hover:text-cyan-400 transition-colors">{t('dashboard.license')}</button>
      </footer>
    </div>
  );
};
