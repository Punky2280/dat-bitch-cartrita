// Simple working message bubble component
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Copy, 
  Pin, 
  Edit2, 
  Edit3,
  MoreVertical, 
  MoreHorizontal,
  ThumbsUp, 
  ThumbsDown, 
  RotateCcw,
  GitBranch,
  Eye,
  EyeOff,
  Sparkles,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  FileText,
  ExternalLink,
  Zap,
  DollarSign,
  Flag,
  Maximize2,
  Minimize2,
  Download
} from 'lucide-react';
import type { Message } from '../../store/chatStore';
import { useChatStore } from '../../store/chatStore';
import { useThemeStore, useAccessibilityStore, useAnalyticsStore } from '../../store/additionalStores';
import MarkdownRenderer from './MarkdownRenderer';
import AttachmentChip from './AttachmentChip';
import ToolInvocationBlock from './ToolInvocationBlock';
import VariantSelector from './VariantSelector';
import BranchIndicator from './BranchIndicator';

interface MessageBubbleProps {
  message: Message;
  index?: number;
  isSelected?: boolean;
  showAvatar?: boolean;
  compact?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  index = 0,
  isSelected = false,
  showAvatar = true,
  compact = false
}) => {
  const chatStore = useChatStore();
  const themeStore = useThemeStore();
  const accessibilityStore = useAccessibilityStore();
  const analyticsStore = useAnalyticsStore();

  // Local state
  const [showActions, setShowActions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showCitations, setShowCitations] = useState(false);
  const [showVariants, setShowVariants] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const bubbleRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Derived state
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';
  const isError = message.role === 'error';
  const isStreaming = message.state === 'streaming';
  const isModerated = message.state === 'moderated';
  const hasCitations = message.citations && message.citations.length > 0;
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const hasToolInvocations = message.tool_invocations && message.tool_invocations.length > 0;
  const hasVariants = message.content_variants && message.content_variants.length > 1;
  const isDarkMode = themeStore.currentTheme === 'dark';

  // Animation variants
  const bubbleVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.2, ease: 'easeOut' }
    },
    exit: { opacity: 0, y: -20, scale: 0.95 }
  };

  const streamingVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.1 } }
  };

  // Effects
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [isEditing, editContent.length]);

  useEffect(() => {
    if (message.state === 'streaming') {
      chatStore.incrementViewCount(message.id);
    }
  }, [message.state, message.id, chatStore.incrementViewCount]);

  // Event handlers
  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    chatStore.incrementCopyCount(message.id);
    analyticsStore.trackEvent('message.copied', { message_id: message.id });
  };

  const handleEdit = () => {
    setIsEditing(true);
    chatStore.startEditingMessage(message.id);
  };

  const handleSaveEdit = () => {
    chatStore.saveEditedMessage(message.id, editContent);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
    chatStore.cancelEditingMessage();
  };

  const handlePin = () => {
    if (message.pinned) {
      chatStore.unpinMessage(message.id);
    } else {
      chatStore.pinMessage(message.id);
    }
    analyticsStore.trackEvent('message.pinned', { message_id: message.id, pinned: !message.pinned });
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    await chatStore.regenerateMessage(message.id);
    setIsRegenerating(false);
    analyticsStore.trackEvent('message.regenerated', { message_id: message.id });
  };

  const handleCreateBranch = () => {
    const branchId = chatStore.createBranch(message.id);
    analyticsStore.trackEvent('branch.created', { message_id: message.id, branch_id: branchId });
  };

  const handleReaction = (reaction: 'positive' | 'negative' | 'flag') => {
    chatStore.addReaction(message.id, reaction);
    analyticsStore.trackEvent('message.reacted', { message_id: message.id, reaction });
  };

  const handleToggleCollapse = () => {
    if (message.collapsed) {
      chatStore.expandMessage(message.id);
    } else {
      chatStore.collapseMessage(message.id);
    }
  };

  const handleExport = async (format: 'markdown' | 'text') => {
    const exported = chatStore.exportMessage(message.id, format);
    await navigator.clipboard.writeText(exported);
  };

  const handleTransformTone = async (tone: 'formal' | 'casual' | 'bullet_points') => {
    await chatStore.transformTone(message.id, tone);
  };

  const handleTranslate = async (language: string) => {
    await chatStore.translateMessage(message.id, language);
  };

  const handleSummarize = async () => {
    await chatStore.summarizeMessage(message.id);
  };

  // Style calculations
  const getBubbleStyles = () => {
    const baseStyles = `
      relative max-w-[760px] md:max-w-[calc(100vw-2rem)] 
      rounded-lg px-4 py-3 shadow-sm transition-all duration-200
      ${compact ? 'px-3 py-2' : 'px-4 py-3'}
    `;

    if (isUser) {
      return `${baseStyles} ml-auto bg-gradient-to-br from-blue-600 to-blue-700 text-white`;
    }

    if (isAssistant) {
      return `${baseStyles} mr-auto ${
        isDarkMode 
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 text-gray-100 border border-gray-700' 
          : 'bg-gradient-to-br from-white to-gray-50 text-gray-900 border border-gray-200'
      }`;
    }

    if (isSystem) {
      return `${baseStyles} mx-auto bg-gradient-to-br from-purple-600 to-purple-700 text-white text-center`;
    }

    if (isTool) {
      return `${baseStyles} mr-auto ${
        isDarkMode 
          ? 'bg-gradient-to-br from-green-900 to-green-800 text-green-100 border border-green-700' 
          : 'bg-gradient-to-br from-green-50 to-green-100 text-green-900 border border-green-200'
      }`;
    }

    if (isError) {
      return `${baseStyles} mr-auto ${
        isDarkMode 
          ? 'bg-gradient-to-br from-red-900 to-red-800 text-red-100 border border-red-700' 
          : 'bg-gradient-to-br from-red-50 to-red-100 text-red-900 border border-red-200'
      }`;
    }

    return baseStyles;
  };

  const getAvatarColor = () => {
    if (isUser) {
      return 'bg-blue-600';
    }
    if (isAssistant) {
      return 'bg-purple-600';
    }
    if (isSystem) {
      return 'bg-gray-600';
    }
    if (isTool) {
      return 'bg-green-600';
    }
    if (isError) {
      return 'bg-red-600';
    }
    return 'bg-gray-600';
  };

  const getRoleIcon = () => {
    if (isUser) {
      return '👤';
    }
    if (isAssistant) {
      return '🤖';
    }
    if (isSystem) {
      return '⚙️';
    }
    if (isTool) {
      return '🔧';
    }
    if (isError) {
      return '⚠️';
    }
    return '💬';
  };

  const getStatusIcon = () => {
    switch (message.state) {
      case 'pending':
        return <Clock className="w-3 h-3 text-yellow-500" />;
      case 'streaming':
        return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'moderated':
        return <AlertTriangle className="w-3 h-3 text-orange-500" />;
      default:
        return null;
    }
  };

  // Render message content
  const renderContent = () => {
    if (isEditing) {
      return (
        <div className="space-y-3">
          <textarea
            ref={editTextareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className={`w-full min-h-[100px] p-3 rounded border resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-gray-700 text-white border-gray-600' 
                : 'bg-white text-gray-900 border-gray-300'
            }`}
            placeholder="Edit your message..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    if (message.collapsed) {
      return (
        <div className="flex items-center gap-2 text-sm opacity-70">
          <span>Message collapsed</span>
          <button
            onClick={handleToggleCollapse}
            className="text-blue-500 hover:text-blue-600"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      );
    }

    if (isModerated) {
      return (
        <div className={`p-3 rounded border-l-4 border-orange-500 ${
          isDarkMode ? 'bg-orange-900/20' : 'bg-orange-50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="font-medium text-orange-700">Content Moderated</span>
          </div>
          <p className="text-sm text-orange-600 mb-3">
            This message has been flagged by our content moderation system.
          </p>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">
              Request Review
            </button>
            <button className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">
              Show Content
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Attachments */}
        {hasAttachments && (
          <div className="flex flex-wrap gap-2">
            {message.attachments!.map((attachment) => (
              <AttachmentChip key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="prose prose-sm max-w-none">
          {isStreaming ? (
            <motion.div variants={streamingVariants}>
              <MarkdownRenderer content={message.content} />
              <motion.span
                className="inline-block w-2 h-4 bg-blue-500 ml-1"
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </motion.div>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        {/* Citations */}
        {hasCitations && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">Sources</span>
            </div>
            <div className="space-y-2">
              {message.citations!.map((citation, idx) => (
                <div key={citation.id} className="flex items-center gap-2 text-sm">
                  <span className="text-blue-500">[{idx + 1}]</span>
                  <span className="flex-1">{citation.text}</span>
                  {citation.url && (
                    <button
                      onClick={() => window.open(citation.url, '_blank')}
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tool invocations */}
        {hasToolInvocations && (
          <div className="space-y-2">
            {message.tool_invocations!.map((tool) => (
              <ToolInvocationBlock key={tool.id} tool={tool} />
            ))}
          </div>
        )}

        {/* Message variants */}
        {hasVariants && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <VariantSelector
              variants={message.content_variants!}
              onSelectVariant={(variantId) => chatStore.selectVariant(message.id, variantId)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      ref={bubbleRef}
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`relative group mb-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Branch indicator */}
      {message.branch_anchor && (
        <BranchIndicator
          messageId={message.id}
          branchId={message.branch_id}
        />
      )}

      <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        {showAvatar && (
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor()}`}>
            {getRoleIcon()}
          </div>
        )}

        {/* Message bubble */}
        <div className={getBubbleStyles()}>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Role label */}
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                isUser 
                  ? 'bg-blue-500/20 text-blue-100' 
                  : isDarkMode 
                    ? 'bg-gray-700 text-gray-300' 
                    : 'bg-gray-100 text-gray-600'
              }`}>
                {message.role}
              </span>

              {/* Model label */}
              {chatStore.show_model_labels && message.model_used && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  isDarkMode 
                    ? 'bg-purple-900/30 text-purple-300' 
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {message.model_used}
                </span>
              )}

              {/* Pinned indicator */}
              {message.pinned && (
                <Pin className="w-3 h-3 text-yellow-500" fill="currentColor" />
              )}

              {/* Status icon */}
              {getStatusIcon()}
            </div>

            {/* Timestamp and metadata */}
            <div className="flex items-center gap-2 text-xs opacity-70">
              {chatStore.show_timestamps && (
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
              )}
              
              {chatStore.show_token_counts && message.tokens && (
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>{message.tokens.output}</span>
                </div>
              )}

              {message.cost_estimate && (
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  <span>${message.cost_estimate.toFixed(4)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          {renderContent()}

          {/* Actions toolbar */}
          <AnimatePresence>
            {showActions && !isEditing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -bottom-2 left-4 right-4 flex items-center justify-center"
              >
                <div className={`flex items-center gap-1 px-3 py-1 rounded-full shadow-lg backdrop-blur-sm ${
                  isDarkMode 
                    ? 'bg-gray-800/90 border border-gray-600' 
                    : 'bg-white/90 border border-gray-200'
                }`}>
                  {/* Copy */}
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Copy message"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit (user messages only) */}
                  {isUser && (
                    <button
                      onClick={handleEdit}
                      className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Edit message"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Regenerate (assistant messages only) */}
                  {isAssistant && (
                    <button
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      title="Regenerate response"
                    >
                      {isRegenerating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  {/* Pin */}
                  <button
                    onClick={handlePin}
                    className={`p-1.5 rounded-full transition-colors ${
                      message.pinned 
                        ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title={message.pinned ? 'Unpin message' : 'Pin message'}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>

                  {/* Branch */}
                  <button
                    onClick={handleCreateBranch}
                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Create branch"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                  </button>

                  {/* Reactions */}
                  <div className="flex items-center border-l border-gray-200 dark:border-gray-600 ml-1 pl-1">
                    <button
                      onClick={() => handleReaction('positive')}
                      className={`p-1.5 rounded-full transition-colors ${
                        message.reaction === 'positive' 
                          ? 'text-green-500 bg-green-100 dark:bg-green-900/30' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title="Good response"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleReaction('negative')}
                      className={`p-1.5 rounded-full transition-colors ${
                        message.reaction === 'negative' 
                          ? 'text-red-500 bg-red-100 dark:bg-red-900/30' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title="Poor response"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleReaction('flag')}
                      className={`p-1.5 rounded-full transition-colors ${
                        message.reaction === 'flag' 
                          ? 'text-orange-500 bg-orange-100 dark:bg-orange-900/30' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title="Report message"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* More actions */}
                  <div className="relative border-l border-gray-200 dark:border-gray-600 ml-1 pl-1">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="More actions"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {/* Dropdown menu */}
                    {showMenu && (
                      <div className={`absolute bottom-full right-0 mb-2 w-48 rounded-lg shadow-lg border ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-600' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className="py-1">
                          <button
                            onClick={handleToggleCollapse}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {message.collapsed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                            {message.collapsed ? 'Expand' : 'Collapse'}
                          </button>
                          
                          <button
                            onClick={handleSummarize}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <FileText className="w-4 h-4" />
                            Summarize
                          </button>

                          <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

                          <button
                            onClick={() => handleTransformTone('formal')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Make Formal
                          </button>

                          <button
                            onClick={() => handleTransformTone('casual')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Make Casual
                          </button>

                          <button
                            onClick={() => handleTransformTone('bullet_points')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Bullet Points
                          </button>

                          <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

                          <button
                            onClick={() => handleExport('markdown')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <Download className="w-4 h-4" />
                            Export Markdown
                          </button>

                          <button
                            onClick={() => handleExport('text')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <FileText className="w-4 h-4" />
                            Export Text
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default MessageBubble;