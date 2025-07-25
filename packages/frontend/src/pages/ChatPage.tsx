import { useState, useEffect, FormEvent, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  text: string;
  speaker: 'user' | 'cartrita';
  model?: string;
}

interface ChatPageProps {
  token: string;
  onLogout: () => void;
}

export const ChatPage = ({ token, onLogout }: ChatPageProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Effect to establish connection and fetch history
  useEffect(() => {
    // Fetch history first
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/chat/history', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch history');
        
        const history = await res.json();
        if (Array.isArray(history) && history.length > 0) {
          setConversation(history);
        } else {
           setConversation([{ text: "Alright, I'm here. We haven't talked before. What's the emergency?", speaker: 'cartrita' }]);
        }
      } catch (err) {
        console.error(err);
        setConversation([{ text: "I can't seem to access my memory banks. Let's just start fresh.", speaker: 'cartrita' }]);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    
    fetchHistory();

    // Then, connect to the WebSocket server
    const newSocket = io('http://localhost:8000', {
      auth: { token }
    });
    setSocket(newSocket);

    newSocket.on('connect', () => console.log('Connected to WebSocket server!'));
    newSocket.on('disconnect', () => console.log('Disconnected from WebSocket server.'));
    
    // Listen for new messages from the socket
    newSocket.on('chat message', (msg: Message) => {
      setConversation((prev) => [...prev, msg]);
    });

    // Cleanup on component unmount
    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !socket) return;

    const userMessage: Message = { text: userInput, speaker: 'user' };
    setConversation(prev => [...prev, userMessage]);
    
    socket.emit('chat message', userInput);
    
    setUserInput('');
  };

  return (
    <div className='bg-gray-900 text-white min-h-screen flex flex-col items-center p-4 font-mono'>
      <header className="w-full max-w-2xl flex justify-between items-center my-8">
        <h1 className='text-5xl font-bold text-cyan-400'>Cartrita</h1>
        <button onClick={onLogout} className="bg-red-600 hover:bg-red-500 p-2 rounded-lg font-bold">Logout</button>
      </header>
      <div className="w-full max-w-2xl h-[60vh] bg-black bg-opacity-30 rounded-lg border border-gray-700 flex flex-col p-4">
        <div className="flex-grow overflow-y-auto pr-2">
          {isLoadingHistory ? (
             <div className="flex justify-center items-center h-full">
                <p>Accessing memory banks...</p>
             </div>
          ) : (
            conversation.map((msg, index) => (
              <div key={index} className={`my-2 flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-lg max-w-md ${msg.speaker === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  {msg.text}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Spit it out..." className="flex-grow bg-gray-800 p-3 rounded-lg" />
          <button type="submit" className="bg-cyan-600 px-6 py-3 font-bold rounded-lg">Send</button>
        </form>
      </div>
    </div>
  );
};
