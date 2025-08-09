import React from "react";
import { VoiceToTextButton } from "../VoiceToTextButton";

interface ChatInputProps {
  inputText: string;
  isConnected: boolean;
  isLoading: boolean;
  messageHistoryCount: number;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSendMessage: () => void;
  onVoiceTranscript: (transcript: string) => void;
  token: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  isConnected,
  isLoading,
  messageHistoryCount,
  inputRef,
  onInputChange,
  onKeyPress,
  onSendMessage,
  onVoiceTranscript,
  token,
}) => {
  return (
    <div className="p-4 border-t border-gray-600/50 bg-gray-800/30">
      <div className="flex items-end space-x-3">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={onInputChange}
            onKeyDown={onKeyPress}
            placeholder="Type your message or use voice input... (Ctrl+↑/↓ for history)"
            className="w-full input-enhanced px-4 py-3 pr-12 rounded-xl resize-none min-h-[48px] max-h-[120px] text-sm leading-relaxed"
            disabled={!isConnected || isLoading}
            rows={1}
          />

          <div className="absolute right-2 bottom-2">
            <VoiceToTextButton
              onTranscript={onVoiceTranscript}
              disabled={!isConnected || isLoading}
              token={token}
            />
          </div>

          {inputText.length > 0 && (
            <div className="absolute bottom-1 right-14 text-xs text-gray-500">
              {inputText.length}/2000
            </div>
          )}
        </div>

        <button
          onClick={onSendMessage}
          disabled={!inputText.trim() || !isConnected || isLoading}
          className="btn-skittles px-6 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Sending...</span>
            </>
          ) : (
            <>
              <span>Send</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </>
          )}
        </button>
      </div>

      {messageHistoryCount > 0 && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Use Ctrl+↑/↓ to navigate message history ({messageHistoryCount} saved)
        </div>
      )}
    </div>
  );
};
