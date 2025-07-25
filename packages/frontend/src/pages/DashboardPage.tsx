// CORRECTED PATHS: Changed from relative to absolute paths from src
import { ChatComponent } from '../components/ChatComponent';
import { FractalVisualizer } from '../components/FractalVisualizer';

interface DashboardPageProps {
  token: string;
  onLogout: () => void;
}

export const DashboardPage = ({ token, onLogout }: DashboardPageProps) => {
  return (
    <div className='bg-gray-900 text-white min-h-screen w-full flex flex-col items-center p-4 font-mono'>
      <header className="w-full max-w-7xl flex justify-between items-center my-8">
        <h1 className='text-5xl font-bold text-cyan-400'>Dat Bitch Cartrita</h1>
        <button onClick={onLogout} className="bg-red-600 hover:bg-red-500 p-2 rounded-lg font-bold">Logout</button>
      </header>
      <main className="w-full max-w-7xl flex-grow grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="h-[70vh]">
          <ChatComponent token={token} />
        </section>
        <section className="h-[70vh]">
          <FractalVisualizer token={token} />
        </section>
      </main>
    </div>
  );
};
