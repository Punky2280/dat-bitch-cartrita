import type { ChatState, ChatAction, Message, ChatStats } from "../types/chat";

export const initialChatState: ChatState = {
  messages: [],
  isLoading: false,
  isConnected: false,
  chatStats: {
    totalMessages: 0,
    userMessages: 0,
    cartritaMessages: 0,
    conversationStarted: null,
    averageResponseTime: 0,
    toolsUsed: 0,
    totalPerformanceScore: 0,
  },
};

const calculateChatStats = (messages: Message[]): ChatStats => {
  const userMessages = messages.filter((m) => m.speaker === "user").length;
  const cartritaMessages = messages.filter(
    (m) => m.speaker === "cartrita",
  ).length;
  const toolsUsed = messages.reduce(
    (sum, m) => sum + (m.tools_used?.length || 0),
    0,
  );
  const totalPerformance = messages.reduce(
    (sum, m) => sum + (m.performance_score || 0),
    0,
  );

  const responseTimes = messages
    .filter((m) => m.response_time_ms)
    .map((m) => m.response_time_ms!);

  const averageResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

  return {
    totalMessages: messages.length,
    userMessages,
    cartritaMessages,
    conversationStarted:
      messages.length > 0 ? new Date(messages[0].created_at) : null,
    averageResponseTime,
    toolsUsed,
    totalPerformanceScore: totalPerformance,
  };
};

export const chatReducer = (
  state: ChatState,
  action: ChatAction,
): ChatState => {
  switch (action.type) {
    case "ADD_MESSAGE": {
      const newMessages = [...state.messages, action.payload];
      return {
        ...state,
        messages: newMessages,
        chatStats: calculateChatStats(newMessages),
        isLoading: false,
      };
    }

    case "SET_MESSAGES": {
      return {
        ...state,
        messages: action.payload,
        chatStats: calculateChatStats(action.payload),
      };
    }

    case "CLEAR_MESSAGES": {
      return {
        ...state,
        messages: [],
        chatStats: initialChatState.chatStats,
      };
    }

    case "SET_LOADING": {
      return {
        ...state,
        isLoading: action.payload,
      };
    }

    case "SET_CONNECTED": {
      return {
        ...state,
        isConnected: action.payload,
      };
    }

    default:
      return state;
  }
};
