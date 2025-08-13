/**
 * Enhanced Chat Message Component
 * Supports inline media rendering with URL detection
 */

import React, { useState, useCallback, useMemo } from 'react';
import linkifyHtml from 'linkify-html';
import DOMPurify from 'dompurify';
import { extractMediaFromText, isUrlSafe, TRUSTED_MEDIA_DOMAINS } from '../../utils/mediaExtraction';
import MediaRenderer from '../media/MediaRenderer';
import MediaLightbox from '../media/MediaLightbox';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
  };
}

interface EnhancedChatMessageProps {
  message: ChatMessage;
  showTimestamp?: boolean;
  enableMarkdown?: boolean;
  enableMediaRendering?: boolean;
  allowUntrustedMedia?: boolean;
  maxMediaWidth?: number;
  className?: string;
}

const EnhancedChatMessage: React.FC<EnhancedChatMessageProps> = ({
  message,
  showTimestamp = true,
  // enableMarkdown = false,
  enableMediaRendering = true,
  allowUntrustedMedia = false,
  maxMediaWidth = 380,
  className = ''
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Extract media from message content
  const mediaAssets = useMemo(() => {
    if (!enableMediaRendering) return [];
    return extractMediaFromText(message.content);
  }, [message.content, enableMediaRendering]);

  // Filter trusted media
  const trustedMedia = useMemo(() => {
    return mediaAssets.filter(asset => isUrlSafe(asset.url, TRUSTED_MEDIA_DOMAINS));
  }, [mediaAssets]);

  // Untrusted media that needs user permission
  const untrustedMedia = useMemo(() => {
    return mediaAssets.filter(asset => !isUrlSafe(asset.url, TRUSTED_MEDIA_DOMAINS));
  }, [mediaAssets]);

  // Process message text for display
  const processedText = useMemo(() => {
    let text = message.content;

    // Remove media URLs from text if we're rendering them separately
    if (enableMediaRendering && mediaAssets.length > 0) {
      mediaAssets.forEach(asset => {
        text = text.replace(asset.url, '');
      });
    }

    // Apply linkification
    const linkified = linkifyHtml(text, {
      target: '_blank',
      rel: 'noopener noreferrer',
      className: 'text-blue-600 dark:text-blue-400 hover:underline'
    });

    // Sanitize HTML
    return DOMPurify.sanitize(linkified);
  }, [message.content, enableMediaRendering, mediaAssets]);

  // Handle media click for lightbox
  const handleMediaClick = useCallback((clickedAsset: any) => {
    const allMedia = [...trustedMedia, ...(allowUntrustedMedia ? untrustedMedia : [])];
    const index = allMedia.findIndex(asset => asset.url === clickedAsset.url);
    if (index !== -1) {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  }, [trustedMedia, untrustedMedia, allowUntrustedMedia]);

  // Get role-specific styling
  const getRoleStyles = () => {
    switch (message.role) {
      case 'user':
        return {
          container: 'ml-auto max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-br-md',
          bubble: 'px-4 py-2'
        };
      case 'assistant':
        return {
          container: 'mr-auto max-w-[80%] bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-md',
          bubble: 'px-4 py-2'
        };
      case 'system':
        return {
          container: 'mx-auto max-w-[60%] bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg border border-yellow-200 dark:border-yellow-800',
          bubble: 'px-3 py-2 text-sm'
        };
      default:
        return {
          container: 'mr-auto max-w-[80%] bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-md',
          bubble: 'px-4 py-2'
        };
    }
  };

  const styles = getRoleStyles();

  return (
    <div className={`chat-message flex flex-col gap-2 mb-4 ${className}`}>
      <div className={`${styles.container} shadow-sm`}>
        {/* Message Content */}
        <div className={styles.bubble}>
          {processedText.trim() && (
            <div
              className="message-text whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: processedText }}
            />
          )}
          
          {/* Trusted Media Rendering */}
          {enableMediaRendering && trustedMedia.length > 0 && (
            <div className="media-stack mt-3 space-y-3">
              {trustedMedia.map((asset, index) => (
                <div key={index} onClick={() => handleMediaClick(asset)}>
                  <MediaRenderer
                    asset={asset}
                    lazy={true}
                    showControls={true}
                    maxWidth={maxMediaWidth}
                    allowUntrusted={false}
                    className="cursor-pointer hover:opacity-90 transition-opacity"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Untrusted Media Warning/Rendering */}
          {enableMediaRendering && untrustedMedia.length > 0 && (
            <div className="untrusted-media-stack mt-3 space-y-3">
              {untrustedMedia.map((asset, index) => (
                <div key={index}>
                  <MediaRenderer
                    asset={asset}
                    lazy={true}
                    showControls={true}
                    maxWidth={maxMediaWidth}
                    allowUntrusted={allowUntrustedMedia}
                    className={allowUntrustedMedia ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}
                    onLoad={() => allowUntrustedMedia && handleMediaClick(asset)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Metadata */}
        {(showTimestamp || message.metadata) && (
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between text-xs opacity-70">
              {showTimestamp && (
                <span>
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
              
              {message.metadata && (
                <div className="flex items-center gap-2">
                  {message.metadata.model && (
                    <span>{message.metadata.model}</span>
                  )}
                  {message.metadata.tokens && (
                    <span>{message.metadata.tokens} tokens</span>
                  )}
                  {message.metadata.processingTime && (
                    <span>{message.metadata.processingTime}ms</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Media Lightbox */}
      {enableMediaRendering && (trustedMedia.length > 0 || (allowUntrustedMedia && untrustedMedia.length > 0)) && (
        <MediaLightbox
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          assets={[...trustedMedia, ...(allowUntrustedMedia ? untrustedMedia : [])]}
          initialIndex={lightboxIndex}
          showNavigation={true}
          allowDownload={true}
        />
      )}
    </div>
  );
};

export default EnhancedChatMessage;