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
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Effect to establish and clean up socket connection
  useEffect(() => {
    // Connect to the server
    const newSocket = io('http://localhost:8000', {
      auth: { token }
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server!');
      // You could fetch history here if needed, but for now we start fresh
       setConversation([{ text: "Real-time connection established. Now we're talking.", speaker: 'cartrita' }]);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server.');
    });

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
    
    // Send message via socket
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
          {conversation.map((msg, index) => (
            <div key={index} className={`my-2 flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-lg max-w-md ${msg.speaker === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                {msg.text}
              </div>
            </div>
          ))}
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
