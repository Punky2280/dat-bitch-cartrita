import React from 'react';
import { useLiveChat } from '../hooks/useLiveChat';
import { useAuth } from '../hooks/useAuth';
import SpeakingIndicator from './SpeakingIndicator';
import { Mic, MicOff } from 'lucide-react';

interface LiveChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LiveChatModal: React.FC<LiveChatModalProps> = ({ isOpen, onClose }) => {
  const { token } = useAuth();
  const {
    agentStatus,
    isRecording,
    userTranscript,
    agentTranscript,
    startLiveChat,
    stopLiveChat,
  } = useLiveChat(token);

  if (!isOpen) return null;

  const handleToggleRecording = () => {
    if (isRecording) {
      stopLiveChat();
      onClose();
    } else {
      startLiveChat();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 text-white rounded-lg p-8 w-full max-w-2xl flex flex-col">
        <div className="flex-grow">
          <div className="flex justify-center items-center h-32 mb-4">
            <SpeakingIndicator isSpeaking={agentStatus === 'speaking'} />
          </div>
          <div className="min-h-[80px] p-4 bg-gray-800 rounded">
            <p className="text-gray-400">You said:</p>
            <p className="text-lg">{userTranscript || '...'}</p>
          </div>
          <div className="min-h-[80px] mt-4 p-4 bg-blue-900 bg-opacity-30 rounded">
            <p className="text-blue-300">Cartrita is {agentStatus}:</p>
            <p className="text-lg">{agentTranscript || '...'}</p>
          </div>
        </div>
        <div className="flex justify-center mt-6">
          <button onClick={handleToggleRecording} className={`p-4 rounded-full ${isRecording ? 'bg-red-600' : 'bg-blue-600'}`}>
            {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveChatModal;