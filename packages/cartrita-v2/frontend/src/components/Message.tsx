import React from 'react';

interface MessageProps {
  text: string;
  sender: 'user' | 'bot';
  timestamp?: Date;
}

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);


const Message: React.FC<MessageProps> = ({ text, sender, timestamp }) => {
  const isUser = sender === 'user';
  
  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex items-start gap-3 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 bg-indigo-500 flex items-center justify-center rounded-full flex-shrink-0">
          <BotIcon />
        </div>
      )}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-lg p-3 max-w-lg ${
            isUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 border'
          }`}
        >
          <div className="whitespace-pre-wrap">{text}</div>
        </div>
        {timestamp && (
          <div className="text-xs text-gray-400 mt-1 px-1">
            {formatTime(timestamp)}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 bg-blue-600 flex items-center justify-center rounded-full flex-shrink-0">
          <UserIcon />
        </div>
      )}
    </div>
  );
};

export default Message;