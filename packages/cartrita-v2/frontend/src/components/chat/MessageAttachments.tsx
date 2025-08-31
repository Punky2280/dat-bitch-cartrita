'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  File, 
  FileText, 
  Image, 
  Music, 
  Video, 
  Download, 
  Eye,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw
} from 'lucide-react';
import { Attachment } from '@/types';
import { formatFileSize, isImageFile, isVideoFile, isAudioFile, isDocumentFile } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface MessageAttachmentsProps {
  attachments: Attachment[];
}

const MessageAttachments: React.FC<MessageAttachmentsProps> = ({ attachments }) => {
  const [selectedImage, setSelectedImage] = useState<Attachment | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  const getFileIcon = (attachment: Attachment) => {
    if (isImageFile(attachment.name)) {
      return <Image className="w-4 h-4 text-blue-500" />;
    } else if (isVideoFile(attachment.name)) {
      return <Video className="w-4 h-4 text-red-500" />;
    } else if (isAudioFile(attachment.name)) {
      return <Music className="w-4 h-4 text-green-500" />;
    } else if (isDocumentFile(attachment.name)) {
      return <FileText className="w-4 h-4 text-orange-500" />;
    }
    return <File className="w-4 h-4 text-gray-500" />;
  };

  const renderImagePreview = (attachment: Attachment) => (
    <div className="relative group">
      <img
        src={attachment.url}
        alt={attachment.name}
        className="max-w-xs max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => setSelectedImage(attachment)}
      />
      
      {/* Image overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
        <ZoomIn className="w-6 h-6 text-white" />
      </div>
      
      {/* Image metadata */}
      {attachment.metadata && (
        <div className="mt-2 text-xs text-muted-foreground">
          {attachment.metadata.width && attachment.metadata.height && (
            <span className="mr-2">
              {attachment.metadata.width} × {attachment.metadata.height}
            </span>
          )}
          <span>{formatFileSize(attachment.size)}</span>
        </div>
      )}
      
      {/* Analysis results */}
      {attachment.metadata?.analysis && (
        <div className="mt-2 p-2 bg-accent rounded text-xs">
          {attachment.metadata.analysis.description && (
            <p className="text-muted-foreground mb-1">
              <strong>AI Analysis:</strong> {attachment.metadata.analysis.description}
            </p>
          )}
          {attachment.metadata.analysis.objects && attachment.metadata.analysis.objects.length > 0 && (
            <p className="text-muted-foreground">
              <strong>Objects:</strong> {attachment.metadata.analysis.objects.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderVideoPreview = (attachment: Attachment) => (
    <div className="relative">
      <video
        src={attachment.url}
        controls
        className="max-w-xs max-h-48 rounded-lg"
        preload="metadata"
      />
      <div className="mt-2 text-xs text-muted-foreground">
        {attachment.metadata?.duration && (
          <span className="mr-2">
            {Math.floor(attachment.metadata.duration / 60)}:
            {(attachment.metadata.duration % 60).toString().padStart(2, '0')}
          </span>
        )}
        <span>{formatFileSize(attachment.size)}</span>
      </div>
    </div>
  );

  const renderAudioPreview = (attachment: Attachment) => (
    <div className="flex items-center space-x-3 p-3 bg-accent rounded-lg max-w-xs">
      <Music className="w-8 h-8 text-green-500" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{attachment.name}</p>
        <audio src={attachment.url} controls className="w-full mt-2" />
        <div className="mt-1 text-xs text-muted-foreground">
          {attachment.metadata?.duration && (
            <span className="mr-2">
              {Math.floor(attachment.metadata.duration / 60)}:
              {(attachment.metadata.duration % 60).toString().padStart(2, '0')}
            </span>
          )}
          <span>{formatFileSize(attachment.size)}</span>
        </div>
      </div>
    </div>
  );

  const renderFilePreview = (attachment: Attachment) => (
    <div className="flex items-center space-x-3 p-3 bg-accent rounded-lg max-w-xs hover:bg-accent/80 transition-colors">
      <div className="flex-shrink-0">
        {getFileIcon(attachment)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{attachment.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.size)}
        </p>
        
        {/* Document preview */}
        {attachment.metadata?.extractedText && (
          <div className="mt-2 p-2 bg-background rounded text-xs">
            <p className="text-muted-foreground line-clamp-3">
              {attachment.metadata.extractedText.slice(0, 150)}...
            </p>
          </div>
        )}
      </div>
      
      <div className="flex flex-col space-y-1">
        <button
          onClick={() => window.open(attachment.url, '_blank')}
          className="p-1.5 rounded hover:bg-background transition-colors"
          title="View file"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            const link = document.createElement('a');
            link.href = attachment.url;
            link.download = attachment.name;
            link.click();
          }}
          className="p-1.5 rounded hover:bg-background transition-colors"
          title="Download file"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="mt-3 space-y-3">
        {attachments.map((attachment) => (
          <motion.div
            key={attachment.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {attachment.type === 'image' && renderImagePreview(attachment)}
            {attachment.type === 'video' && renderVideoPreview(attachment)}
            {attachment.type === 'audio' && renderAudioPreview(attachment)}
            {(attachment.type === 'document' || attachment.type === 'other') && 
              renderFilePreview(attachment)}
          </motion.div>
        ))}
      </div>

      {/* Image Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative max-w-4xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Controls */}
              <div className="absolute top-4 right-4 flex space-x-2 z-10">
                <button
                  onClick={() => setImageZoom(zoom => Math.max(0.5, zoom - 0.25))}
                  className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setImageZoom(zoom => Math.min(3, zoom + 0.25))}
                  className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setImageRotation(rot => rot + 90)}
                  className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setImageZoom(1);
                    setImageRotation(0);
                  }}
                  className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Image */}
              <img
                src={selectedImage.url}
                alt={selectedImage.name}
                className="max-w-full max-h-full object-contain"
                style={{
                  transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                  transition: 'transform 0.2s ease-in-out',
                }}
              />

              {/* Image info */}
              <div className="absolute bottom-4 left-4 bg-black/50 text-white p-3 rounded-lg">
                <p className="font-medium">{selectedImage.name}</p>
                <p className="text-sm opacity-90">
                  {formatFileSize(selectedImage.size)}
                  {selectedImage.metadata?.width && selectedImage.metadata?.height && (
                    <span className="ml-2">
                      {selectedImage.metadata.width} × {selectedImage.metadata.height}
                    </span>
                  )}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MessageAttachments;