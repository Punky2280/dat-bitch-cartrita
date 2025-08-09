import React from "react";
import type { Message } from "../../types/chat";

interface MessageItemProps {
  message: Message;
  index: number;
}

const formatMessageText = (text: string): string => {
  if (typeof text !== "string") return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>");
};

const getIntentIcon = (intent: string): string => {
  const icons: { [key: string]: string } = {
    time_query: "⏰",
    image_generation: "🎨",
    coding: "💻",
    research: "🔍",
    conversation: "💬",
    general: "🤖",
  };
  return icons[intent] || "🤖";
};

const getPerformanceColor = (score: number): string => {
  if (score >= 90) return "text-green-400";
  if (score >= 70) return "text-yellow-400";
  return "text-red-400";
};

export const MessageItem: React.FC<MessageItemProps> = ({ message, index }) => {
  const isUser = message.speaker === "user";

  return (
    <div
      className={`flex message-appear ${
        isUser ? "justify-end" : "justify-start"
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-lg ${
          isUser
            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md"
            : "bg-gradient-to-br from-gray-700 to-gray-800 text-gray-100 rounded-bl-md"
        }`}
      >
        <div
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: formatMessageText(message.text),
          }}
        />

        <div className="flex justify-between items-center mt-2 text-xs opacity-70">
          <div className="flex items-center space-x-2">
            <span>
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {message.response_time_ms && (
              <span className="text-blue-300">
                ⚡{message.response_time_ms}ms
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1">
            {message.intent_analysis && (
              <span
                title={`Intent: ${message.intent_analysis.primary_intent} (${(
                  message.intent_analysis.primary_confidence * 100
                ).toFixed(0)}%)`}
              >
                {getIntentIcon(message.intent_analysis.primary_intent)}
              </span>
            )}

            {message.tools_used && message.tools_used.length > 0 && (
              <span
                title={`Tools: ${message.tools_used.join(", ")}`}
                className="text-purple-300"
              >
                🔧{message.tools_used.length}
              </span>
            )}

            {message.performance_score && (
              <span
                className={getPerformanceColor(message.performance_score)}
                title={`Performance: ${message.performance_score}/100`}
              >
                📊{message.performance_score}
              </span>
            )}

            {message.model && (
              <span className="ml-2 px-1.5 py-0.5 bg-black/20 rounded text-[10px]">
                {message.model}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
