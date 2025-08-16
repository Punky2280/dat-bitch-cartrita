import React from "react";
import { Download, Upload, Trash2, MoreHorizontal, Wifi, WifiOff, MessageCircle } from "lucide-react";

interface ChatHeaderProps {
  title?: string;
  subtitle?: string;
  isConnected: boolean;
  messageCount: number;
  onClearHistory?: () => void;
  onExportHistory?: () => void;
  onImportHistory?: () => void;
  showAdvancedControls?: boolean;
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = "Chat with Cartrita",
  subtitle = "Your AI companion",
  isConnected,
  messageCount,
  onClearHistory,
  onExportHistory,
  onImportHistory,
  showAdvancedControls = true,
  className = ""
}) => {
  return (
    <div className={`p-4 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/80 to-gray-700/80 backdrop-blur-sm ${className}`}>
      <div className="flex justify-between items-center">
        {/* Left side - Title and status */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-gradient">
              {title}
            </h2>
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-xs text-gray-400">
                {messageCount > 0
                  ? `${messageCount} message${messageCount !== 1 ? 's' : ''}`
                  : subtitle}
              </p>
              
              {/* Connection status */}
              <div className="flex items-center space-x-1">
                {isConnected ? (
                  <>
                    <Wifi className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-red-400" />
                    <span className="text-xs text-red-400">Disconnected</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Controls */}
        {showAdvancedControls && (
          <div className="flex items-center space-x-2">
            {/* Export History */}
            {onExportHistory && messageCount > 0 && (
              <button
                onClick={onExportHistory}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors"
                title="Export chat history"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Import History */}
            {onImportHistory && (
              <button
                onClick={onImportHistory}
                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors"
                title="Import chat history"
              >
                <Upload className="w-4 h-4" />
              </button>
            )}

            {/* Clear History */}
            {onClearHistory && messageCount > 0 && (
              <button
                onClick={onClearHistory}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Clear chat history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* More options */}
            <button
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;