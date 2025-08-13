/**
 * Secure Media Renderer Component
 * Renders images, videos, and other media with security and performance considerations
 */

import React, { useState, useCallback, useRef } from 'react';
import ReactPlayer from 'react-player';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { MediaAsset, isUrlSafe, getOptimalImageSize, getVideoThumbnail, TRUSTED_MEDIA_DOMAINS } from '../../utils/mediaExtraction';
import { AlertTriangle, Play, ExternalLink, Eye, EyeOff } from 'lucide-react';

interface MediaRendererProps {
  asset: MediaAsset;
  lazy?: boolean;
  showControls?: boolean;
  maxWidth?: number;
  allowUntrusted?: boolean;
  onError?: (error: Error) => void;
  onLoad?: () => void;
  className?: string;
}

const MediaRenderer: React.FC<MediaRendererProps> = ({
  asset,
  lazy = true,
  showControls = true,
  maxWidth = 380,
  allowUntrusted = false,
  onError,
  onLoad,
  className = ''
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);
  const [showUntrusted, setShowUntrusted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer for lazy loading
  useIntersectionObserver(
    containerRef,
    (entries) => {
      if (entries[0]?.isIntersecting) {
        setIsVisible(true);
      }
    },
    { threshold: 0.1 }
  );

  // Security check
  const isSecure = isUrlSafe(asset.url, TRUSTED_MEDIA_DOMAINS);
  const shouldRender = isSecure || (allowUntrusted && showUntrusted);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback((error: Error | Event) => {
    setHasError(true);
    const errorObj = error instanceof Error ? error : new Error('Media failed to load');
    onError?.(errorObj);
  }, [onError]);

  const handleImageError = useCallback(() => {
    handleError(new Error(`Failed to load image: ${asset.url}`));
  }, [asset.url, handleError]);

  // Security warning component
  if (!isSecure && !allowUntrusted) {
    return (
      <div 
        ref={containerRef}
        className={`media-security-warning border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 ${className}`}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Untrusted Media Source
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              This media is from an untrusted domain: {new URL(asset.url).hostname}
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setShowUntrusted(true)}
                className="text-xs px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
              >
                <Eye className="w-3 h-3 inline mr-1" />
                Show Anyway
              </button>
              <a
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                <ExternalLink className="w-3 h-3 inline mr-1" />
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Untrusted media with user override
  if (!isSecure && allowUntrusted && !showUntrusted) {
    return (
      <div 
        ref={containerRef}
        className={`media-untrusted border border-orange-300 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <span className="text-sm text-orange-800 dark:text-orange-200">
              Untrusted media hidden
            </span>
          </div>
          <button
            onClick={() => setShowUntrusted(true)}
            className="text-xs px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            <Eye className="w-3 h-3 inline mr-1" />
            Show
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div 
        ref={containerRef}
        className={`media-error border border-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 ${className}`}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Failed to load {asset.type}
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1 break-all">
              {asset.url}
            </p>
            <button
              onClick={() => setHasError(false)}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading placeholder
  if (!isVisible && lazy) {
    return (
      <div 
        ref={containerRef}
        className={`media-placeholder bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse ${className}`}
        style={{ width: maxWidth, height: 200 }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400 text-sm">
            Loading {asset.type}...
          </div>
        </div>
      </div>
    );
  }

  // Render based on media type
  return (
    <div ref={containerRef} className={`media-container ${className}`}>
      {asset.type === 'image' && shouldRender && (
        <ImageRenderer
          asset={asset}
          maxWidth={maxWidth}
          showControls={showControls}
          onLoad={handleLoad}
          onError={handleImageError}
          isLoaded={isLoaded}
        />
      )}
      
      {asset.type === 'video' && shouldRender && (
        <VideoRenderer
          asset={asset}
          maxWidth={maxWidth}
          showControls={showControls}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {asset.type === 'audio' && shouldRender && (
        <AudioRenderer
          asset={asset}
          showControls={showControls}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Untrusted media overlay */}
      {!isSecure && showUntrusted && (
        <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded">
          Untrusted
          <button
            onClick={() => setShowUntrusted(false)}
            className="ml-1 hover:text-orange-200"
          >
            <EyeOff className="w-3 h-3 inline" />
          </button>
        </div>
      )}
    </div>
  );
};

// Image Renderer Component
const ImageRenderer: React.FC<{
  asset: MediaAsset;
  maxWidth: number;
  showControls: boolean;
  onLoad: () => void;
  onError: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  isLoaded: boolean;
}> = ({ asset, maxWidth, showControls, onLoad, onError, isLoaded }) => {
  const [dimensions, setDimensions] = useState<{width: number; height: number} | null>(null);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const optimal = getOptimalImageSize(img.naturalWidth, img.naturalHeight, maxWidth);
    setDimensions(optimal);
    onLoad();
  }, [maxWidth, onLoad]);

  return (
    <div className="image-wrapper relative group">
      <img
        src={asset.url}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={handleImageLoad}
        onError={onError}
        className="rounded-lg max-w-full h-auto shadow-sm border border-gray-200 dark:border-gray-700"
        style={dimensions ? { width: dimensions.width, height: dimensions.height } : { maxWidth }}
      />
      
      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
      )}
      
      {/* Controls overlay */}
      {showControls && isLoaded && (
        <div className="absolute bottom-2 right-2 bg-black/50 rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-xs hover:text-gray-300"
          >
            <ExternalLink className="w-3 h-3 inline mr-1" />
            Open
          </a>
        </div>
      )}
    </div>
  );
};

// Video Renderer Component
const VideoRenderer: React.FC<{
  asset: MediaAsset;
  maxWidth: number;
  showControls: boolean;
  onLoad: () => void;
  onError: (error: Error) => void;
}> = ({ asset, maxWidth, showControls, onLoad, onError }) => {
  const [showPlayer, setShowPlayer] = useState(false);
  const thumbnail = getVideoThumbnail(asset.url);

  // For direct video files
  const isDirect = /\.(mp4|webm|m4v|mov)(\?|$)/i.test(asset.url);
  
  if (isDirect) {
    return (
      <div className="video-wrapper relative rounded-lg overflow-hidden" style={{ maxWidth }}>
        <video
          src={asset.url}
          controls={showControls}
          preload="metadata"
          playsInline
          className="w-full h-auto bg-black"
          onLoadedData={onLoad}
          onError={() => onError(new Error('Video failed to load'))}
        />
      </div>
    );
  }

  // For platform videos (YouTube, Vimeo, etc.)
  if (!showPlayer && thumbnail) {
    return (
      <div className="video-thumbnail relative rounded-lg overflow-hidden cursor-pointer" style={{ maxWidth }}>
        <img
          src={thumbnail}
          alt="Video thumbnail"
          className="w-full h-auto"
          onLoad={onLoad}
          onError={() => onError(new Error('Thumbnail failed to load'))}
        />
        <div 
          className="absolute inset-0 bg-black/30 flex items-center justify-center"
          onClick={() => setShowPlayer(true)}
        >
          <div className="bg-white/90 rounded-full p-3">
            <Play className="w-6 h-6 text-gray-800" />
          </div>
        </div>
      </div>
    );
  }

  // React Player for platform videos
  return (
    <div className="video-player relative rounded-lg overflow-hidden" style={{ maxWidth }}>
      {(
        <ReactPlayer
          //@ts-expect-error upstream types conflict in this environment
          url={asset.url}
          controls={showControls as any}
          width="100%"
          height="auto"
          onReady={onLoad as any}
          onError={() => onError(new Error('Video player failed to load')) as any}
        />
      )}
    </div>
  );
};

// Audio Renderer Component
const AudioRenderer: React.FC<{
  asset: MediaAsset;
  showControls: boolean;
  onLoad: () => void;
  onError: (error: Error) => void;
}> = ({ asset, showControls, onLoad, onError }) => {
  return (
    <div className="audio-wrapper bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
      <div className="flex items-center gap-3">
        <div className="bg-blue-500 rounded p-2">
          <Play className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <audio
            src={asset.url}
            controls={showControls}
            preload="metadata"
            className="w-full h-8"
            onLoadedData={onLoad}
            onError={() => onError(new Error('Audio failed to load'))}
          />
        </div>
      </div>
    </div>
  );
};

export default MediaRenderer;