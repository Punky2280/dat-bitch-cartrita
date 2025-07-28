// packages/frontend/src/components/ChatComponent.tsx

import { useState, useEffect, FormEvent, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import { Highlight, themes } from 'prism-react-renderer';
import { useTranslation } from 'react-i18next';

// --- Interfaces ---
interface Message {
  text: string;
  speaker: 'user' | 'cartrita';
  model?: string;
  error?: boolean;
}

interface ChatComponentProps {
  token: string;
}

// --- Component ---
export const ChatComponent = ({ token }: ChatComponentProps) => {
  const { i18n } = useTranslation();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/chat/history', { headers: { 'Authorization': `Bearer ` + token } });
        if (!res.ok) throw new Error('Failed to fetch history');
        const history = await res.json();
        setConversation(Array.isArray(history) && history.length > 0 ? history : [{ text: "Alright, I'm here. What's the emergency?", speaker: 'cartrita' }]);
      } catch (err) { 
        console.error("History fetch failed:", err);
        setConversation([{ text: "Couldn't access my memory banks. Let's start fresh.", speaker: 'cartrita', error: true }]);
      }
      finally { setIsLoadingHistory(false); }
    };
    fetchHistory();

    const newSocket = io({ auth: { token } });
    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    newSocket.on('chat message', (msg: Message) => setConversation(prev => [...prev, msg]));

    return () => { 
      newSocket.disconnect(); 
    };
  }, [token]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !socket || !isConnected) return;
    const userMessage: Message = { text: userInput, speaker: 'user' };
    setConversation(prev => [...prev, userMessage]);
    socket.emit('chat message', { text: userInput, language: i18n.language });
    setUserInput('');
  };

  const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
    const [isCopied, setIsCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const codeText = String(children).replace(/\n$/, '');

    const handleCopy = () => {
      const textArea = document.createElement('textarea');
      textArea.value = codeText;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
      document.body.removeChild(textArea);
    };

    return !inline && match ? (
        <div className="relative bg-gray-900 rounded-md my-2 border border-gray-700">
            <div className="flex items-center justify-between px-4 py-1 bg-gray-800 rounded-t-md">
                <span className="text-xs text-gray-400">{match[1]}</span>
                <button 
                    onClick={handleCopy}
                    className="text-xs text-white bg-gray-600 hover:bg-cyan-600 rounded px-2 py-1 transition-colors"
                >
                    {isCopied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <Highlight
                theme={themes.vsDark}
                code={codeText}
                language={match[1]}
            >
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <pre className={`${className} p-4 overflow-x-auto text-sm`} style={style}>
                    {tokens.map((line, i) => {
                      // FIXED: Destructure the key from the rest of the props
                      const { key, ...restLineProps } = getLineProps({ line, key: i });
                      return (
                        <div key={key} {...restLineProps}>
                          {line.map((token, keyIndex) => {
                            // FIXED: Destructure the key from the rest of the props
                            const { key: tokenKey, ...restTokenProps } = getTokenProps({ token, key: keyIndex });
                            return <span key={tokenKey} {...restTokenProps} />;
                          })}
                        </div>
                      );
                    })}
                </pre>
                )}
            </Highlight>
        </div>
    ) : (
      <code className="bg-gray-800 text-red-400 rounded-sm px-1 text-sm font-mono" {...props}>
        {children}
      </code>
    );
  };

  return (
    <div className="w-full h-full bg-black bg-opacity-30 rounded-lg border border-gray-700 flex flex-col p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-cyan-400">Conversation</h2>
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto pr-2">
        {isLoadingHistory ? <p className="text-gray-400">Accessing memory banks...</p> : conversation.map((msg, index) => (
          <div key={index} className={`my-2 flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-2xl ${msg.speaker === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
              <ReactMarkdown
                components={{
                  code: CodeBlock,
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={isConnected ? "Spit it out..." : "Connecting..."} className="flex-grow bg-gray-800 p-3 rounded-lg border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" disabled={!isConnected} />
        <button type="submit" className="bg-cyan-600 px-6 py-3 font-bold rounded-lg hover:bg-cyan-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed" disabled={!isConnected}>Send</button>
      </form>
    </div>
  );
};
