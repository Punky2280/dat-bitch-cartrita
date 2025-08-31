'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Image, 
  File, 
  Video, 
  Music, 
  Archive, 
  X, 
  Download, 
  Eye,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useThemeStore } from '../../store/additionalStores';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  status: 'uploading' | 'ready' | 'error' | 'processing';
  preview?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
  };
}

interface AttachmentChipProps {
  attachment: Attachment;
  onRemove?: (id: string) => void;
  onView?: (attachment: Attachment) => void;
  onDownload?: (attachment: Attachment) => void;
  showRemove?: boolean;
  compact?: boolean;
  className?: string;
}

const AttachmentChip: React.FC<AttachmentChipProps> = ({
  attachment,
  onRemove,
  onView,
  onDownload,
  showRemove = true,
  compact = false,
  className = ''
}) => {
  const { currentTheme } = useThemeStore();
  const isDark = currentTheme === 'dark';
  const [imageError, setImageError] = useState(false);

  const getFileIcon = () => {
    const { type } = attachment;
    
    if (type.startsWith('image/')) {
      return <Image className="w-4 h-4" />;
    }
    if (type.startsWith('video/')) {
      return <Video className="w-4 h-4" />;
    }
    if (type.startsWith('audio/')) {
      return <Music className="w-4 h-4" />;
    }
    if (type === 'application/pdf' || type.includes('document') || type.includes('text')) {
      return <FileText className="w-4 h-4" />;
    }
    if (type.includes('zip') || type.includes('archive')) {
      return <Archive className="w-4 h-4" />;
    }
    
    return <File className="w-4 h-4" />;
  };

  const getStatusIcon = () => {
    switch (attachment.status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      case 'ready':
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeLabel = () => {
    const ext = attachment.name.split('.').pop()?.toLowerCase();
    return ext ? ext.toUpperCase() : 'FILE';
  };

  const canPreview = () => {
    return attachment.type.startsWith('image/') || 
           attachment.type === 'application/pdf' ||
           attachment.type.startsWith('text/');
  };

  const handleView = () => {
    if (onView && attachment.status === 'ready') {
      onView(attachment);
    }
  };

  const handleDownload = () => {
    if (onDownload && attachment.status === 'ready') {
      onDownload(attachment);
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove(attachment.id);
    }
  };

  const baseStyles = `
    inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200
    ${compact ? 'px-2 py-1 text-xs' : 'text-sm'}
    ${attachment.status === 'error' 
      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' 
      : attachment.status === 'uploading' || attachment.status === 'processing'
        ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
        : isDark
          ? 'border-gray-600 bg-gray-700/50 hover:bg-gray-700'
          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
    }
  `;

  return (
    <div className={`${baseStyles} ${className} group relative`}>
      {/* File icon or preview */}
      <div className="flex-shrink-0">
        {attachment.preview && !imageError && attachment.type.startsWith('image/') ? (
          <div className="relative">
            <img
              src={attachment.preview}
              alt={attachment.name}
              className={`rounded object-cover ${compact ? 'w-6 h-6' : 'w-8 h-8'}`}
              onError={() => setImageError(true)}
            />
            {attachment.status !== 'ready' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                {getStatusIcon()}
              </div>
            )}
          </div>
        ) : (
          <div className={`flex items-center justify-center rounded ${
            compact ? 'w-6 h-6' : 'w-8 h-8'
          } ${
            attachment.status === 'error'
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : attachment.status === 'uploading' || attachment.status === 'processing'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                : isDark
                  ? 'bg-gray-600 text-gray-300'
                  : 'bg-gray-200 text-gray-600'
          }`}>
            {attachment.status !== 'ready' ? getStatusIcon() : getFileIcon()}
          </div>
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {attachment.name}
          </span>
          {!compact && (
            <span className={`text-xs px-1.5 py-0.5 rounded uppercase font-mono ${
              isDark ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
            }`}>
              {getFileTypeLabel()}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{formatFileSize(attachment.size)}</span>
          
          {attachment.metadata && (
            <>
              {attachment.metadata.width && attachment.metadata.height && (
                <span>• {attachment.metadata.width}×{attachment.metadata.height}</span>
              )}
              {attachment.metadata.duration && (
                <span>• {Math.round(attachment.metadata.duration)}s</span>
              )}
              {attachment.metadata.pages && (
                <span>• {attachment.metadata.pages} pages</span>
              )}
            </>
          )}
          
          {attachment.status === 'uploading' && <span>• Uploading...</span>}
          {attachment.status === 'processing' && <span>• Processing...</span>}
          {attachment.status === 'error' && <span className="text-red-500">• Error</span>}
        </div>
      </div>

      {/* Actions */}
      {attachment.status === 'ready' && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canPreview() && onView && (
            <button
              onClick={handleView}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Preview"
            >
              <Eye className="w-3 h-3" />
            </button>
          )}
          
          {onDownload && (
            <button
              onClick={handleDownload}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Download"
            >
              <Download className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Remove button */}
      {showRemove && onRemove && (
        <button
          onClick={handleRemove}
          className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          title="Remove attachment"
        >
          <X className="w-3 h-3 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" />
        </button>
      )}
    </div>
  );
};

export default AttachmentChip;