import React, { useState, useRef, useCallback } from "react";
import { VoiceToTextButton } from "../VoiceToTextButton";
import api from "../../services/apiService";

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

interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'document' | 'code';
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_CODE_TYPES = ['text/javascript', 'text/python', 'text/x-python', 'text/plain'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isExecutingCode, setIsExecutingCode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (file.size > MAX_FILE_SIZE) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }

      let fileType: 'image' | 'document' | 'code' = 'document';
      
      if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        fileType = 'image';
      } else if (SUPPORTED_CODE_TYPES.includes(file.type) || file.name.endsWith('.py') || file.name.endsWith('.js') || file.name.endsWith('.ts')) {
        fileType = 'code';
      }

      const attachedFile: AttachedFile = {
        file,
        type: fileType
      };

      // Generate preview for images
      if (fileType === 'image') {
        try {
          const preview = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          attachedFile.preview = preview;
        } catch (error) {
          console.error('Error generating image preview:', error);
        }
      }

      newFiles.push(attachedFile);
    }

    setAttachedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const executeCode = useCallback(async () => {
    if (!inputText.trim()) return;

    setIsExecutingCode(true);
    try {
      const response = await api.post('/api/ai/code-execution', {
        code: inputText,
        language: 'python' // Default to Python, could be detected
      });

      if (response.success) {
        const result = response.data;
        // Add execution result to chat
        onVoiceTranscript(`\n\nCode execution result:\n${result.output || result.result}`);
      } else {
        onVoiceTranscript(`\n\nCode execution failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Code execution error:', error);
      onVoiceTranscript(`\n\nCode execution error: ${error}`);
    } finally {
      setIsExecutingCode(false);
    }
  }, [inputText, token, onVoiceTranscript]);

  const analyzeImage = useCallback(async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('task', 'analyze');

      const response = await api.postFormData('/api/ai/vision-analysis', formData);

      if (response.success) {
        const result = response.data;
        onVoiceTranscript(`\n\nImage analysis: ${result.description || result.analysis}`);
      }
    } catch (error) {
      console.error('Image analysis error:', error);
    }
  }, [token, onVoiceTranscript]);

  const insertQuickAction = useCallback((action: string) => {
    const quickActions: { [key: string]: string } = {
      'explain': 'Please explain in detail: ',
      'summarize': 'Please summarize: ',
      'code': 'Write code that: ',
      'debug': 'Help me debug this code: ',
      'translate': 'Translate this to Spanish: ',
      'analyze': 'Analyze this data: '
    };
    
    const actionText = quickActions[action] || action;
    onVoiceTranscript(actionText);
    setShowQuickActions(false);
  }, [onVoiceTranscript]);

  return (
  <div className="p-4 border-t border-slate-600/50 bg-slate-800/30">
      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachedFiles.map((file, index) => (
            <div key={index} className="relative bg-slate-700/60 rounded-lg p-2 flex items-center space-x-2 max-w-xs">
              {file.type === 'image' && file.preview && (
                <img src={file.preview} alt="Preview" className="w-8 h-8 object-cover rounded" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{file.file.name}</div>
                <div className="text-xs text-slate-400">{(file.file.size / 1024).toFixed(1)}KB</div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-slate-400 hover:text-red-400 text-xs"
              >
                ×
              </button>
              {file.type === 'image' && (
                <button
                  onClick={() => analyzeImage(file.file)}
                  className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-white"
                >
                  Analyze
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      {showQuickActions && (
        <div className="mb-3 flex flex-wrap gap-2">
          {['explain', 'summarize', 'code', 'debug', 'translate', 'analyze'].map((action) => (
            <button
              key={action}
              onClick={() => insertQuickAction(action)}
              className="px-3 py-1 bg-purple-600/80 hover:bg-purple-600 rounded-lg text-xs text-white transition-colors"
            >
              {action.charAt(0).toUpperCase() + action.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end space-x-3">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={onInputChange}
            onKeyDown={onKeyPress}
            placeholder="Type your message, attach files, or use voice input... (Ctrl+↑/↓ for history)"
            className="w-full input-enhanced px-12 py-3 pr-20 rounded-xl resize-none min-h-[48px] max-h-[120px] text-sm leading-relaxed"
            disabled={!isConnected || isLoading}
            rows={1}
          />

          {/* Left side buttons */}
          <div className="absolute left-2 bottom-2 flex items-center space-x-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected || isLoading}
              className="p-1.5 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              title="Attach file"
            >
              📎
            </button>
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              disabled={!isConnected || isLoading}
              className="p-1.5 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              title="Quick actions"
            >
              ⚡
            </button>
            {inputText.includes('```') && (
              <button
                onClick={executeCode}
                disabled={!isConnected || isLoading || isExecutingCode}
                className="p-1.5 text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                title="Execute code"
              >
                {isExecutingCode ? '⏳' : '▶️'}
              </button>
            )}
          </div>

          {/* Right side buttons */}
          <div className="absolute right-2 bottom-2 flex items-center space-x-1">
            <VoiceToTextButton
              onTranscript={onVoiceTranscript}
              disabled={!isConnected || isLoading}
              token={token}
            />
          </div>

          {inputText.length > 0 && (
            <div className="absolute bottom-1 right-16 text-xs text-slate-500">
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

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        multiple
        accept="image/*,.py,.js,.ts,.txt,.md,.json,.csv"
        className="hidden"
      />

      {messageHistoryCount > 0 && (
  <div className="mt-2 text-xs text-slate-500 text-center">
          Use Ctrl+↑/↓ to navigate message history ({messageHistoryCount} saved) • 📎 Attach files • ⚡ Quick actions • ▶️ Execute code
        </div>
      )}
    </div>
  );
};
