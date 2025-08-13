/**
 * Media Extraction Utilities
 * Detects and extracts media URLs from text content
 */

export interface MediaAsset {
  url: string;
  type: 'image' | 'video' | 'audio' | 'unknown';
  width?: number;
  height?: number;
  posterUrl?: string;
  mime?: string;
  meta?: Record<string, any>;
}

// URL detection regex
const URL_REGEX = /\bhttps?:\/\/[^\s<>()]+/gi;

// File extension mappings
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'ogv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'];

// Popular video platforms
const VIDEO_PLATFORMS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
  /vimeo\.com\/(\d+)/,
  /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
  /twitch\.tv\/videos\/(\d+)/
];

/**
 * Classify a URL based on its extension or pattern
 */
export function classifyUrl(url: string): MediaAsset['type'] {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const extension = pathname.split('.').pop()?.split('?')[0] || '';

    // Check for video platforms first
    for (const pattern of VIDEO_PLATFORMS) {
      if (pattern.test(url)) {
        return 'video';
      }
    }

    // Check file extensions
    if (IMAGE_EXTENSIONS.includes(extension)) {
      return 'image';
    }
    
    if (VIDEO_EXTENSIONS.includes(extension)) {
      return 'video';
    }
    
    if (AUDIO_EXTENSIONS.includes(extension)) {
      return 'audio';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Extract media assets from text content
 */
export function extractMediaFromText(text: string): MediaAsset[] {
  const urls = text.match(URL_REGEX) || [];
  const uniqueUrls = Array.from(new Set(urls));
  
  return uniqueUrls
    .map(url => ({
      url,
      type: classifyUrl(url)
    }))
    .filter(asset => asset.type !== 'unknown') as MediaAsset[];
}

/**
 * Validate if a URL is safe to render
 */
export function isUrlSafe(url: string, allowedHosts?: string[]): boolean {
  try {
    const urlObj = new URL(url);
    
    // Must be HTTPS or HTTP
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    
    // Check against allowlist if provided
    if (allowedHosts && allowedHosts.length > 0) {
      return allowedHosts.some(host => 
        urlObj.hostname === host || urlObj.hostname.endsWith(`.${host}`)
      );
    }
    
    // Basic safety checks
    const hostname = urlObj.hostname.toLowerCase();
    
    // Block localhost and private IPs
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') || 
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.match(/^172\.(1[6-9]|2\d|3[01])\./)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Get optimal image size for display
 */
export function getOptimalImageSize(originalWidth?: number, originalHeight?: number, maxWidth = 380): { width: number; height: number } {
  if (!originalWidth || !originalHeight) {
    return { width: maxWidth, height: 200 };
  }
  
  if (originalWidth <= maxWidth) {
    return { width: originalWidth, height: originalHeight };
  }
  
  const ratio = originalHeight / originalWidth;
  return {
    width: maxWidth,
    height: Math.round(maxWidth * ratio)
  };
}

/**
 * Check if media should be lazy loaded
 */
export function shouldLazyLoad(index: number, isInViewport = false): boolean {
  // Always load first few items, lazy load the rest
  return index > 2 && !isInViewport;
}

/**
 * Generate a thumbnail URL for video platforms
 */
export function getVideoThumbnail(url: string): string | null {
  // YouTube thumbnail
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
  if (youtubeMatch) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/mqdefault.jpg`;
  }
  
  // Vimeo thumbnail would require API call, so return null
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return null; // Would need API call to get thumbnail
  }
  
  return null;
}

/**
 * Estimate file size from URL (basic heuristic)
 */
export function estimateFileSize(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase() || '';
  
  const sizeEstimates: Record<string, string> = {
    'jpg': '~500KB',
    'jpeg': '~500KB',
    'png': '~1MB',
    'gif': '~2MB',
    'webp': '~300KB',
    'mp4': '~10MB',
    'webm': '~8MB',
    'mov': '~15MB'
  };
  
  return sizeEstimates[extension] || 'Unknown';
}

/**
 * Security allowlist for common media domains
 */
export const TRUSTED_MEDIA_DOMAINS = [
  'imgur.com',
  'github.com',
  'githubusercontent.com',
  'unsplash.com',
  'pexels.com',
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'twitch.tv',
  'giphy.com',
  'tenor.com',
  'media.discordapp.net',
  'cdn.discordapp.com',
  'images.unsplash.com',
  'via.placeholder.com'
];

/**
 * Content-Type to media type mapping
 */
export const MIME_TYPE_MAP: Record<string, MediaAsset['type']> = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio'
};

/**
 * Fetch media metadata (with CORS fallback)
 */
export async function fetchMediaMetadata(url: string): Promise<Partial<MediaAsset>> {
  try {
    // Try HEAD request first (lighter)
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'cors'
    });
    
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length');
      
      return {
        mime: contentType,
        type: MIME_TYPE_MAP[contentType] || classifyUrl(url),
        meta: {
          size: contentLength ? parseInt(contentLength) : undefined,
          headers: Object.fromEntries(response.headers.entries())
        }
      };
    }
  } catch (error) {
    console.warn('Failed to fetch media metadata:', error);
  }
  
  // Fallback to URL-based classification
  return {
    type: classifyUrl(url)
  };
}