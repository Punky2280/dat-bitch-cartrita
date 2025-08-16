import React, { useEffect, useState } from "react";
import { Bot, Sparkles, Cpu } from "lucide-react";

interface EnhancedTypingIndicatorProps {
  agentName?: string;
  activity?: 'thinking' | 'processing' | 'analyzing' | 'responding';
  showAgentStatus?: boolean;
  estimatedTime?: number;
}

export const EnhancedTypingIndicator: React.FC<EnhancedTypingIndicatorProps> = ({
  agentName = "Cartrita",
  activity = 'thinking',
  showAgentStatus = true,
  estimatedTime
}) => {
  const [dots, setDots] = useState("");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (estimatedTime) {
      const timer = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [estimatedTime]);

  const getActivityIcon = () => {
    switch (activity) {
      case 'thinking': return <Bot className="w-4 h-4" />;
      case 'processing': return <Cpu className="w-4 h-4 animate-pulse" />;
      case 'analyzing': return <Sparkles className="w-4 h-4 animate-spin" />;
      default: return <Bot className="w-4 h-4" />;
    }
  };

  const getActivityText = () => {
    switch (activity) {
      case 'thinking': return 'thinking';
      case 'processing': return 'processing';
      case 'analyzing': return 'analyzing';
      case 'responding': return 'responding';
      default: return 'thinking';
    }
  };

  return (
    <div className="flex justify-start message-appear">
      <div className="bg-gradient-to-br from-gray-700/90 to-gray-800/90 backdrop-blur-sm px-4 py-3 rounded-2xl rounded-bl-md shadow-lg border border-gray-600/30">
        <div className="flex items-center space-x-3">
          {/* Agent Avatar */}
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              {getActivityIcon()}
            </div>
          </div>

          {/* Status Content */}
          <div className="flex flex-col min-w-0">
            {showAgentStatus && (
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-xs font-medium text-gray-300">{agentName}</span>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse delay-150"></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse delay-300"></div>
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-300">
                {getActivityText()}{dots}
              </span>
              
              {/* Enhanced typing dots */}
              <div className="enhanced-typing-indicator">
                <div className="typing-dot-enhanced"></div>
                <div className="typing-dot-enhanced"></div>
                <div className="typing-dot-enhanced"></div>
              </div>
            </div>

            {/* Time estimate */}
            {estimatedTime && (
              <div className="text-xs text-gray-400 mt-1">
                ~{Math.max(0, estimatedTime - elapsed)}s remaining
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
