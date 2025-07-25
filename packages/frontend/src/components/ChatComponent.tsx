import { useState, useEffect, FormEvent, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// ... (interfaces remain the same)
interface Message {
  text: string;
  speaker: 'user' | 'cartrita';
}
interface ChatComponentProps {
  token: string;
}

export const ChatComponent = ({ token }: ChatComponentProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isConnected, setIsConnected] = useState(false); // NEW: Connection status state
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  useEffect(() => {
    const fetchHistory = async () => {
      // ... (history fetching remains the same)
      try {
        const res = await fetch('/api/chat/history', { headers: { 'Authorization': `Bearer ` + token } });
        const history = await res.json();
        setConversation(Array.isArray(history) && history.length > 0 ? history : [{ text: "Alright, I'm here. What's the emergency?", speaker: 'cartrita' }]);
      } catch (err) { console.error("History fetch failed:", err); }
      finally { setIsLoadingHistory(false); }
    };
    fetchHistory();

    const newSocket = io('http://localhost:8000', { auth: { token } });
    setSocket(newSocket);

    // --- NEW: Real-time status listeners ---
    newSocket.on('connect', () => {
        console.log('FRONTEND: Socket connected!');
        setIsConnected(true);
    });
    newSocket.on('disconnect', () => {
        console.log('FRONTEND: Socket disconnected!');
        setIsConnected(false);
    });
    // ---

    newSocket.on('chat message', (msg: Message) => {
        console.log('FRONTEND: Received message from backend:', msg);
        setConversation(prev => [...prev, msg]);
    });
    return () => { newSocket.disconnect(); };
  }, [token]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log('FRONTEND: Form submitted!');
    if (!userInput.trim() || !socket || !isConnected) {
        console.log('FRONTEND: Aborting send. Reason:', { userInput: userInput.trim(), socket: !!socket, isConnected });
        return;
    }

    const userMessage: Message = { text: userInput, speaker: 'user' };
    setConversation(prev => [...prev, userMessage]);
    
    console.log('FRONTEND: Emitting "chat message" to backend with:', userInput);
    socket.emit('chat message', userInput);
    
    setUserInput('');
  };

  return (
    <div className="w-full h-full bg-black bg-opacity-30 rounded-lg border border-gray-700 flex flex-col p-4">
      {/* --- NEW: Connection Status Header --- */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-cyan-400">Conversation</h2>
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      {/* --- */}
      
      <div className="flex-grow overflow-y-auto pr-2">
        {isLoadingHistory ? <p>Accessing memory banks...</p> : conversation.map((msg, index) => (
          <div key={index} className={`my-2 flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-md ${msg.speaker === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>{msg.text}</div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={isConnected ? "Spit it out..." : "Connecting..."} className="flex-grow bg-gray-800 p-3 rounded-lg" disabled={!isConnected} />
        <button type="submit" className="bg-cyan-600 px-6 py-3 font-bold rounded-lg disabled:bg-gray-600" disabled={!isConnected}>Send</button>
      </form>
    </div>
  );
};
