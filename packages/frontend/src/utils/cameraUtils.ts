/**
 * Camera utilities for enhanced visual analysis
 */

export interface CameraFrameOptions {
  width?: number;
  height?: number;
  quality?: number; // 0.1 to 1.0
  format?: 'jpeg' | 'png' | 'webp';
}

export interface CameraPermissionResult {
  granted: boolean;
  error?: string;
  stream?: MediaStream;
}

export interface FrameCaptureResult {
  success: boolean;
  imageData?: string; // Base64 data URL
  blob?: Blob;
  error?: string;
  timestamp: number;
}

/**
 * Request camera permissions with optimal settings
 */
export async function requestCameraPermission(): Promise<CameraPermissionResult> {
  try {
    console.log('[CameraUtils] Requesting camera permission...');

    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
        facingMode: 'user', // Prefer front camera
      },
      audio: false, // Only video for visual analysis
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    console.log('[CameraUtils] Camera permission granted');
    console.log('[CameraUtils] Video tracks:', stream.getVideoTracks().length);

    // Log camera settings
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      console.log('[CameraUtils] Camera settings:', {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        deviceId: settings.deviceId,
      });
    }

    return {
      granted: true,
      stream,
    };
  } catch (error: any) {
    console.error('[CameraUtils] Camera permission denied:', error);

    let errorMessage = 'Camera access denied';
    if (error.name === 'NotAllowedError') {
      errorMessage =
        'Camera permission was denied. Please allow camera access and try again.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'No camera device found.';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Camera is already in use by another application.';
    }

    return {
      granted: false,
      error: errorMessage,
    };
  }
}

/**
 * Capture a frame from video stream (synchronous version, no blob)
 */
export function captureFrame(
  videoElement: HTMLVideoElement,
  options: CameraFrameOptions = {}
): FrameCaptureResult {
  try {
    const {
      width = videoElement.videoWidth,
      height = videoElement.videoHeight,
      quality = 0.8,
      format = 'jpeg',
    } = options;

    // Create canvas for frame capture
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = width;
    canvas.height = height;

    // Draw current video frame to canvas
    ctx.drawImage(videoElement, 0, 0, width, height);

    // Convert to data URL
    const mimeType = `image/${format}`;
    const imageData = canvas.toDataURL(mimeType, quality);

    return {
      success: true,
      imageData,
      blob: undefined, // Use captureFrameAsync for blob
      timestamp: Date.now(),
    };
  } catch (error: any) {
    console.error('[CameraUtils] Frame capture failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: Date.now(),
    };
  }
}

/**
 * Capture frame asynchronously with blob (for API uploads)
 */
export async function captureFrameAsync(
  videoElement: HTMLVideoElement,
  options: CameraFrameOptions = {}
): Promise<FrameCaptureResult> {
  return new Promise(resolve => {
    try {
      const {
        width = videoElement.videoWidth,
        height = videoElement.videoHeight,
        quality = 0.8,
        format = 'jpeg',
      } = options;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve({
          success: false,
          error: 'Failed to get canvas context',
          timestamp: Date.now(),
        });
        return;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(videoElement, 0, 0, width, height);

      const mimeType = `image/${format}`;
      const imageData = canvas.toDataURL(mimeType, quality);

      canvas.toBlob(
        blob => {
          resolve({
            success: true,
            imageData,
            blob: blob || undefined,
            timestamp: Date.now(),
          });
        },
        mimeType,
        quality
      );
    } catch (error: any) {
      resolve({
        success: false,
        error: error.message,
        timestamp: Date.now(),
      });
    }
  });
}

/**
 * Start periodic frame capture for continuous analysis
 */
export class FrameCaptureManager {
  private videoElement: HTMLVideoElement;
  private intervalId: number | null = null;
  private captureCallback: (result: FrameCaptureResult) => void;
  private options: CameraFrameOptions;
  private isCapturing = false;

  constructor(
    videoElement: HTMLVideoElement,
    captureCallback: (result: FrameCaptureResult) => void,
    options: CameraFrameOptions = {}
  ) {
    this.videoElement = videoElement;
    this.captureCallback = captureCallback;
    this.options = options;
  }

  startCapture(intervalMs: number = 2000) {
    if (this.isCapturing) {
      console.warn('[FrameCaptureManager] Already capturing frames');
      return;
    }

    console.log(
      `[FrameCaptureManager] Starting frame capture every ${intervalMs}ms`
    );
    this.isCapturing = true;

    this.intervalId = window.setInterval(async () => {
      if (
        !this.isCapturing ||
        this.videoElement.paused ||
        this.videoElement.ended
      ) {
        return;
      }

      try {
        const result = await captureFrameAsync(this.videoElement, this.options);
        this.captureCallback(result);
      } catch (error) {
        console.error('[FrameCaptureManager] Frame capture error:', error);
      }
    }, intervalMs);
  }

  stopCapture() {
    if (!this.isCapturing) {
      return;
    }

    console.log('[FrameCaptureManager] Stopping frame capture');
    this.isCapturing = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isActive(): boolean {
    return this.isCapturing;
  }
}

/**
 * Get available camera devices
 */
export async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  } catch (error) {
    console.error('[CameraUtils] Failed to enumerate camera devices:', error);
    return [];
  }
}

/**
 * Check if camera APIs are supported
 */
export function isCameraSupported(): boolean {
  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.toDataURL === 'function' &&
    typeof HTMLCanvasElement.prototype.toBlob === 'function'
  );
}
