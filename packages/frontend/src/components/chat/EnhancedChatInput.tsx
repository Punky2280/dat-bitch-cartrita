import React, { useState, useRef, useCallback, useEffect } from "react";
import { Send, Paperclip, Smile, Mic, Square, Loader2, X, FileText, Image as ImageIcon, Code } from "lucide-react";
import { VoiceToTextButton } from "../VoiceToTextButton";

interface EnhancedChatInputProps {
  inputText: string;
  isConnected: boolean;
  isLoading: boolean;
  messageHistoryCount: number;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSendMessage: () => void;
  onVoiceTranscript: (transcript: string) => void;
  onFileUpload?: (files: File[]) => void;
  onEmojiSelect?: (emoji: string) => void;
  token: string;
  placeholder?: string;
  maxLength?: number;
  showFileUpload?: boolean;
  showEmoji?: boolean;
  showVoice?: boolean;
}

interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'document' | 'code' | 'other';
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const SUPPORTED_CODE_TYPES = [
  'text/javascript', 'text/typescript', 'text/python', 'text/x-python', 
  'text/html', 'text/css', 'text/plain', 'application/json'
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const COMMON_EMOJIS = [
  '😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🔥', 
  '💯', '🚀', '🎉', '💡', '⚡', '🌟', '✨', '🎯'
];

const getFileType = (file: File): AttachedFile['type'] => {
  if (SUPPORTED_IMAGE_TYPES.includes(file.type)) return 'image';
  if (SUPPORTED_CODE_TYPES.includes(file.type)) return 'code';
  if (file.type.includes('text/')) return 'document';
  return 'other';
};

const getFileIcon = (type: AttachedFile['type']) => {
  switch (type) {
    case 'image': return <ImageIcon className="w-4 h-4" />;
    case 'code': return <Code className="w-4 h-4" />;
    case 'document': return <FileText className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

export const EnhancedChatInput: React.FC<EnhancedChatInputProps> = ({
  inputText,
  isConnected,
  isLoading,
  messageHistoryCount,
  inputRef,
  onInputChange,
  onKeyPress,
  onSendMessage,
  onVoiceTranscript,
  onFileUpload,
  onEmojiSelect,
  token,
  placeholder = "Type your message...",
  maxLength = 4000,
  showFileUpload = true,
  showEmoji = true,
  showVoice = true
}) => {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update character count when input changes
  useEffect(() => {
    setCharacterCount(inputText.length);
  }, [inputText]);

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newFiles: AttachedFile[] = [];

    for (const file of fileArray) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        continue;
      }

      const fileType = getFileType(file);
      const attachedFile: AttachedFile = {
        file,
        type: fileType
      };

      // Generate preview for images
      if (fileType === 'image') {
        try {
          const preview = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          attachedFile.preview = preview;
        } catch (error) {
          console.error('Failed to generate image preview:', error);
        }
      }

      newFiles.push(attachedFile);
    }

    setAttachedFiles(prev => [...prev, ...newFiles]);
    
    if (onFileUpload) {
      onFileUpload(newFiles.map(f => f.file));
    }
  }, [onFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleEmojiClick = (emoji: string) => {
    if (onEmojiSelect) {
      onEmojiSelect(emoji);
    } else if (inputRef.current) {
      const current = inputRef.current;
      const start = current.selectionStart || 0;
      const end = current.selectionEnd || 0;
      const newText = inputText.slice(0, start) + emoji + inputText.slice(end);
      
      // Trigger change event
      const event = {
        target: { value: newText }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onInputChange(event);
      
      // Set cursor position after emoji
      setTimeout(() => {
        current.focus();
        current.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  const canSend = inputText.trim().length > 0 && isConnected && !isLoading;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isOverLimit = characterCount > maxLength;

  return (
    <div className="relative">
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm border-2 border-dashed border-blue-500 rounded-2xl flex items-center justify-center z-20">
          <div className="text-center">
            <Paperclip className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-blue-400 font-medium">Drop files here to attach</p>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`bg-gray-800/80 backdrop-blur-sm border border-gray-600/50 rounded-2xl p-4 transition-all duration-200 ${
          isDragOver ? 'border-blue-500 bg-blue-500/10' : ''
        } ${isLoading ? 'opacity-75' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((attachedFile, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 bg-gray-700/50 rounded-lg p-2 border border-gray-600/30"
              >
                {attachedFile.preview ? (
                  <img
                    src={attachedFile.preview}
                    alt={attachedFile.file.name}
                    className="w-8 h-8 rounded object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
                    {getFileIcon(attachedFile.type)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 truncate max-w-32">
                    {attachedFile.file.name}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {(attachedFile.file.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-gray-600 rounded transition-colors"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input container */}
        <div className="flex items-end space-x-3">
          {/* File upload button */}
          {showFileUpload && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors"
              title="Attach files"
              disabled={isLoading}
            >
              <Paperclip className="w-5 h-5" />
            </button>
          )}

          {/* Emoji picker button */}
          {showEmoji && (
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors"
                title="Add emoji"
                disabled={isLoading}
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Emoji picker */}
              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl z-10">
                  <div className="grid grid-cols-8 gap-1">
                    {COMMON_EMOJIS.map((emoji, index) => (
                      <button
                        key={index}
                        onClick={() => handleEmojiClick(emoji)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={onInputChange}
              onKeyDown={onKeyPress}
              placeholder={placeholder}
              className={`w-full bg-transparent text-gray-100 placeholder-gray-400 resize-none border-0 focus:outline-none py-2 max-h-32 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent ${
                isOverLimit ? 'text-red-400' : ''
              }`}
              style={{ minHeight: '2.5rem' }}
              disabled={isLoading}
              maxLength={maxLength}
            />
            
            {/* Character count */}
            {(isNearLimit || isOverLimit) && (
              <div className={`absolute bottom-1 right-2 text-xs ${
                isOverLimit ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {characterCount}/{maxLength}
              </div>
            )}
          </div>

          {/* Voice input */}
          {showVoice && (
            <div className="flex-shrink-0">
              <VoiceToTextButton
                onTranscript={onVoiceTranscript}
                token={token}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Send button */}
          <button
            onClick={onSendMessage}
            disabled={!canSend || isOverLimit}
            className={`p-2 rounded-lg transition-all duration-200 ${
              canSend && !isOverLimit
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            title={isOverLimit ? 'Message too long' : canSend ? 'Send message' : 'Cannot send'}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Status indicators */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            {messageHistoryCount > 0 && (
              <span>• {messageHistoryCount} messages</span>
            )}
          </div>
          
          {attachedFiles.length > 0 && (
            <span>{attachedFiles.length} file{attachedFiles.length !== 1 ? 's' : ''} attached</span>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.js,.ts,.py,.json,.html,.css,.md"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
        className="hidden"
      />
    </div>
  );
};
