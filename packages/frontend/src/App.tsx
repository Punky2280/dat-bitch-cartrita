import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL as string;

function App() {
  const [message, setMessage] = useState('Connecting to backend...');
  const [timestamp, setTimestamp] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/status`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Network response was not ok');
        }
        return res.json();
      })
      .then((data) => {
        setMessage(data.message);
        setTimestamp(new Date(data.timestamp).toLocaleString());
      })
      .catch((error) => {
        console.error("Fetch error:", error);
        setMessage('Connection failed. Is the backend running? Check the console.');
      });
  }, []);

  return (
    <div className='bg-gray-900 text-white min-h-screen flex items-center justify-center text-center'>
      <div>
        <h1 className='text-4xl font-bold mb-4'>Dat Bitch Cartrita</h1>
        <p className='text-xl text-cyan-400'>"{message}"</p>
        {timestamp && <p className='text-sm text-gray-500 mt-2'>Last Seen: {timestamp}</p>}
      </div>
    </div>
  );
}

export default App;
