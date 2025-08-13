/**
 * Media Lightbox Component
 * Full-screen media viewer with navigation and controls
 */

import React, { useState, useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react';
import { MediaAsset } from '../../utils/mediaExtraction';
import MediaRenderer from './MediaRenderer';

interface MediaLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  assets: MediaAsset[];
  initialIndex?: number;
  showNavigation?: boolean;
  allowDownload?: boolean;
  className?: string;
}

const MediaLightbox: React.FC<MediaLightboxProps> = ({
  isOpen,
  onClose,
  assets,
  initialIndex = 0,
  showNavigation = true,
  allowDownload = true,
  className = ''
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const currentAsset = assets[currentIndex];

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : assets.length - 1));
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [assets.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < assets.length - 1 ? prev + 1 : 0));
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [assets.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (showNavigation && assets.length > 1) goToPrevious();
          break;
        case 'ArrowRight':
          if (showNavigation && assets.length > 1) goToNext();
          break;
        case '+':
        case '=':
          setZoom(prev => Math.min(prev * 1.2, 5));
          break;
        case '-':
          setZoom(prev => Math.max(prev / 1.2, 0.5));
          break;
        case '0':
          setZoom(1);
          setPosition({ x: 0, y: 0 });
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showNavigation, assets.length, goToPrevious, goToNext]);

  // Zoom handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.5));
  const handleZoomReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse handlers for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Download handler
  const handleDownload = () => {
    if (!currentAsset) return;
    
    const link = document.createElement('a');
    link.href = currentAsset.url;
    link.download = currentAsset.url.split('/').pop() || 'media';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !currentAsset) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-black/90 backdrop-blur-sm ${className}`}>
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2 text-white text-sm">
            {showNavigation && assets.length > 1 && (
              <span>
                {currentIndex + 1} of {assets.length}
              </span>
            )}
            <span className="text-gray-300">•</span>
            <span className="capitalize">{currentAsset.type}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls (for images) */}
            {currentAsset.type === 'image' && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-white text-sm min-w-[3rem] text-center">
                  {(zoom * 100).toFixed(0)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomReset}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors text-xs"
                  title="Reset zoom"
                >
                  1:1
                </button>
              </>
            )}

            {/* Download */}
            {allowDownload && (
              <button
                onClick={handleDownload}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Open in new tab */}
            <a
              href={currentAsset.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {showNavigation && assets.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full transition-colors z-10"
            title="Previous (←)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 text-white hover:bg-white/20 rounded-full transition-colors z-10"
            title="Next (→)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Main Content */}
      <div
        className="absolute inset-0 flex items-center justify-center p-16"
        onClick={(e) => {
          // Close on backdrop click (but not on content)
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className={`relative max-w-full max-h-full ${currentAsset.type === 'image' && zoom > 1 ? 'cursor-move' : 'cursor-default'}`}
          style={{
            transform: currentAsset.type === 'image' 
              ? `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`
              : undefined
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <MediaRenderer
            asset={currentAsset}
            lazy={false}
            showControls={true}
            maxWidth={window.innerWidth - 128} // Account for padding
            allowUntrusted={true}
            className="rounded-lg shadow-2xl"
          />
        </div>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent">
        <div className="p-4 text-white">
          <div className="text-sm font-medium mb-1 break-all">
            {currentAsset.url}
          </div>
          {currentAsset.meta && (
            <div className="text-xs text-gray-300">
              {currentAsset.meta.size && (
                <span>Size: {(currentAsset.meta.size / 1024).toFixed(1)}KB</span>
              )}
              {currentAsset.mime && (
                <span className="ml-4">Type: {currentAsset.mime}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-400 bg-black/30 rounded p-2">
        <div>ESC: Close</div>
        {showNavigation && assets.length > 1 && (
          <>
            <div>← →: Navigate</div>
          </>
        )}
        {currentAsset.type === 'image' && (
          <>
            <div>+/-: Zoom</div>
            <div>0: Reset</div>
          </>
        )}
      </div>
    </div>
  );
};

export default MediaLightbox;