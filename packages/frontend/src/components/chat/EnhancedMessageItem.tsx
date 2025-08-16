import React, { useState, useRef, useEffect } from "react";
import { Copy, Check, ThumbsUp, ThumbsDown, MoreHorizontal, Bot, User, Sparkles, Clock, Zap, Code2 } from "lucide-react";
import type { Message } from "../../types/chat";

interface EnhancedMessageItemProps {
  message: Message;
  index: number;
  onCopy?: (text: string) => void;
  onFeedback?: (messageId: string, type: 'positive' | 'negative') => void;
  onRegenerate?: (messageId: string) => void;
  showTimestamp?: boolean;
  showMetadata?: boolean;
}

const formatMessageText = (text: string): string => {
  if (typeof text !== "string") return "";
  
  return text
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-gray-100'>$1</strong>")
    // Italic text
    .replace(/\*(.*?)\*/g, "<em class='italic text-gray-200'>$1</em>")
    // Inline code
    .replace(/`(.*?)`/g, "<code class='px-1.5 py-0.5 bg-gray-900/50 rounded text-sm font-mono text-blue-300 border border-gray-700'>$1</code>")
    // Code blocks
    .replace(/```(\w+)?\n(.*?)```/gs, (match, lang, code) => {
      const language = lang ? `<span class="text-xs text-gray-400 mb-2 block">${lang}</span>` : '';
      return `<div class="my-3 p-4 bg-gray-900/70 rounded-lg border border-gray-700 overflow-x-auto">
        ${language}
        <pre class="text-sm font-mono text-gray-200 whitespace-pre-wrap">${code.trim()}</pre>
      </div>`;
    })
    // Links
    .replace(/(https?:\/\/[^\s]+)/g, "<a href='$1' target='_blank' rel='noopener noreferrer' class='text-blue-400 hover:text-blue-300 underline'>$1</a>")
    // Line breaks
    .replace(/\n/g, "<br>");
};

const getIntentIcon = (intent: string): React.ReactNode => {
  const iconMap: { [key: string]: React.ReactNode } = {
    time_query: <Clock className="w-3 h-3" />,
    image_generation: <Sparkles className="w-3 h-3" />,
    coding: <Code2 className="w-3 h-3" />,
    research: <Bot className="w-3 h-3" />,
    conversation: <User className="w-3 h-3" />,
    general: <Bot className="w-3 h-3" />,
  };
  return iconMap[intent] || <Bot className="w-3 h-3" />;
};

const getPerformanceColor = (score: number): string => {
  if (score >= 90) return "text-green-400";
  if (score >= 70) return "text-yellow-400";
  return "text-red-400";
};

export const EnhancedMessageItem: React.FC<EnhancedMessageItemProps> = ({
  message,
  index,
  onCopy,
  onFeedback,
  onRegenerate,
  showTimestamp = true,
  showMetadata = true
}) => {
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const isUser = message.speaker === "user";

  const handleCopy = async () => {
    if (onCopy) {
      onCopy(message.text);
    } else {
      await navigator.clipboard.writeText(message.text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    if (onFeedback) {
      onFeedback(message.id, type);
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(message.id);
    }
  };

  // Enhanced animation based on message index
  const animationDelay = Math.min(index * 50, 500);

  return (
    <div
      ref={messageRef}
      className={`group flex ${isUser ? "justify-end" : "justify-start"} message-appear-enhanced`}
      style={{ animationDelay: `${animationDelay}ms` }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start space-x-3 max-w-[85%] lg:max-w-[75%]">
        {/* Avatar for assistant messages */}
        {!isUser && (
          <div className="flex-shrink-0 mt-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Bot className="w-4 h-4 text-white" />
            </div>
          </div>
        )}

        {/* Message content */}
        <div
          className={`relative px-4 py-3 rounded-2xl shadow-lg backdrop-blur-sm transition-all duration-300 ${
            isUser
              ? "bg-gradient-to-br from-blue-600/90 to-blue-700/90 text-white rounded-br-md border border-blue-500/30"
              : "bg-gradient-to-br from-gray-700/90 to-gray-800/90 text-gray-100 rounded-bl-md border border-gray-600/30"
          } ${showActions ? 'shadow-xl transform scale-[1.02]' : ''}`}
        >
          {/* Message text */}
          <div
            className="text-sm leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: formatMessageText(message.text),
            }}
          />

          {/* Message metadata */}
          {showMetadata && (
            <div className="flex justify-between items-center mt-3 text-xs opacity-70">
              <div className="flex items-center space-x-2">
                {showTimestamp && (
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                )}
                
                {message.response_time_ms && (
                  <span className="flex items-center space-x-1 text-blue-300">
                    <Zap className="w-3 h-3" />
                    <span>{message.response_time_ms}ms</span>
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {message.intent_analysis && (
                  <div
                    className="flex items-center space-x-1 px-2 py-1 bg-black/20 rounded-full"
                    title={`Intent: ${message.intent_analysis.primary_intent} (${(
                      message.intent_analysis.primary_confidence * 100
                    ).toFixed(0)}%)`}
                  >
                    {getIntentIcon(message.intent_analysis.primary_intent)}
                    <span className="text-[10px]">
                      {message.intent_analysis.primary_intent}
                    </span>
                  </div>
                )}

                {message.tools_used && message.tools_used.length > 0 && (
                  <div
                    className="flex items-center space-x-1 px-2 py-1 bg-purple-500/20 rounded-full"
                    title={`Tools: ${message.tools_used.join(", ")}`}
                  >
                    <Code2 className="w-3 h-3 text-purple-300" />
                    <span className="text-[10px] text-purple-300">
                      {message.tools_used.length}
                    </span>
                  </div>
                )}

                {message.performance_score && (
                  <div
                    className={`flex items-center space-x-1 px-2 py-1 bg-black/20 rounded-full ${getPerformanceColor(message.performance_score)}`}
                    title={`Performance: ${message.performance_score}/100`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span className="text-[10px]">
                      {message.performance_score}
                    </span>
                  </div>
                )}

                {message.model && (
                  <span className="px-2 py-1 bg-black/20 rounded-full text-[10px] text-gray-400">
                    {message.model}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className={`absolute -right-2 top-2 flex items-center space-x-1 transition-all duration-200 ${
            showActions ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'
          }`}>
            <button
              onClick={handleCopy}
              className="p-1.5 bg-gray-800/80 hover:bg-gray-700/80 rounded-full transition-colors"
              title="Copy message"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400" />
              )}
            </button>

            {!isUser && (
              <>
                <button
                  onClick={() => handleFeedback('positive')}
                  className="p-1.5 bg-gray-800/80 hover:bg-green-600/20 rounded-full transition-colors group"
                  title="Good response"
                >
                  <ThumbsUp className="w-3 h-3 text-gray-400 group-hover:text-green-400" />
                </button>

                <button
                  onClick={() => handleFeedback('negative')}
                  className="p-1.5 bg-gray-800/80 hover:bg-red-600/20 rounded-full transition-colors group"
                  title="Poor response"
                >
                  <ThumbsDown className="w-3 h-3 text-gray-400 group-hover:text-red-400" />
                </button>

                <button
                  onClick={handleRegenerate}
                  className="p-1.5 bg-gray-800/80 hover:bg-blue-600/20 rounded-full transition-colors group"
                  title="Regenerate response"
                >
                  <Bot className="w-3 h-3 text-gray-400 group-hover:text-blue-400" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Avatar for user messages */}
        {isUser && (
          <div className="flex-shrink-0 mt-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center shadow-lg">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
