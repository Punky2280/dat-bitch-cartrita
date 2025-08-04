import React, { useState, useEffect } from 'react';
import {
  ExclamationTriangleIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

export interface MediaPermissionState {
  microphone: 'unknown' | 'granted' | 'denied' | 'requesting';
  camera: 'unknown' | 'granted' | 'denied' | 'requesting';
  error?: string;
}

interface MediaPermissionHandlerProps {
  onPermissionChange: (permissions: MediaPermissionState) => void;
  requiredPermissions: ('microphone' | 'camera')[];
  showUI?: boolean;
  autoRequest?: boolean;
}

export const MediaPermissionHandler: React.FC<MediaPermissionHandlerProps> = ({
  onPermissionChange,
  requiredPermissions,
  showUI = true,
  autoRequest = false,
}) => {
  const [permissions, setPermissions] = useState<MediaPermissionState>({
    microphone: 'unknown',
    camera: 'unknown',
  });

  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    checkExistingPermissions();

    if (autoRequest) {
      requestPermissions();
    }
  }, [autoRequest]);

  useEffect(() => {
    onPermissionChange(permissions);
  }, [permissions, onPermissionChange]);

  const checkExistingPermissions = async () => {
    try {
      if (!navigator.permissions) {
        console.warn('[MediaPermissions] Permissions API not supported');
        return;
      }

      const micPermission = requiredPermissions.includes('microphone')
        ? await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          })
        : null;

      const cameraPermission = requiredPermissions.includes('camera')
        ? await navigator.permissions.query({
            name: 'camera' as PermissionName,
          })
        : null;

      setPermissions(prev => ({
        ...prev,
        microphone: micPermission ? (micPermission.state as any) : 'unknown',
        camera: cameraPermission ? (cameraPermission.state as any) : 'unknown',
      }));

      // Listen for permission changes
      if (micPermission) {
        micPermission.onchange = () => {
          setPermissions(prev => ({
            ...prev,
            microphone: micPermission.state as any,
          }));
        };
      }

      if (cameraPermission) {
        cameraPermission.onchange = () => {
          setPermissions(prev => ({
            ...prev,
            camera: cameraPermission.state as any,
          }));
        };
      }
    } catch (error) {
      console.error('[MediaPermissions] Failed to check permissions:', error);
    }
  };

  const requestPermissions = async () => {
    try {
      const constraints: MediaStreamConstraints = {};

      if (requiredPermissions.includes('microphone')) {
        constraints.audio = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
        setPermissions(prev => ({ ...prev, microphone: 'requesting' }));
      }

      if (requiredPermissions.includes('camera')) {
        constraints.video = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        };
        setPermissions(prev => ({ ...prev, camera: 'requesting' }));
      }

      console.log('[MediaPermissions] Requesting permissions...', constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Permission granted - update state
      setPermissions(prev => ({
        ...prev,
        microphone: constraints.audio ? 'granted' : prev.microphone,
        camera: constraints.video ? 'granted' : prev.camera,
        error: undefined,
      }));

      // Clean up the stream (we just needed it for permission)
      stream.getTracks().forEach(track => track.stop());

      console.log('[MediaPermissions] Permissions granted');
    } catch (error: any) {
      console.error('[MediaPermissions] Permission request failed:', error);

      let errorMessage = 'Permission request failed';
      const micState =
        permissions.microphone === 'requesting'
          ? 'denied'
          : permissions.microphone;
      const camState =
        permissions.camera === 'requesting' ? 'denied' : permissions.camera;

      if (error.name === 'NotAllowedError') {
        errorMessage =
          'Permission was denied. Please allow access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone or camera found.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Device is already in use by another application.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Device does not meet the required constraints.';
      }

      setPermissions(prev => ({
        ...prev,
        microphone: micState,
        camera: camState,
        error: errorMessage,
      }));
    }
  };

  const openSystemSettings = () => {
    // This will vary by browser and OS
    alert(`To enable microphone/camera access:

1. Click the lock icon (🔒) in your browser's address bar
2. Select "Allow" for microphone and camera
3. Refresh the page

Or go to your browser settings:
- Chrome: Settings → Privacy & Security → Site Settings → Camera/Microphone
- Firefox: Settings → Privacy & Security → Permissions
- Safari: Safari → Preferences → Websites → Camera/Microphone`);
  };

  const getPermissionIcon = (permission: string, state: string) => {
    const iconClass = 'h-5 w-5';

    if (state === 'granted') {
      return <CheckCircleIcon className={`${iconClass} text-green-500`} />;
    } else if (state === 'denied') {
      return <XCircleIcon className={`${iconClass} text-red-500`} />;
    } else if (state === 'requesting') {
      return (
        <div className={`${iconClass} animate-pulse`}>
          {permission === 'microphone' ? (
            <MicrophoneIcon className={`${iconClass} text-blue-500`} />
          ) : (
            <VideoCameraIcon className={`${iconClass} text-blue-500`} />
          )}
        </div>
      );
    } else {
      return permission === 'microphone' ? (
        <MicrophoneIcon className={`${iconClass} text-gray-400`} />
      ) : (
        <VideoCameraIcon className={`${iconClass} text-gray-400`} />
      );
    }
  };

  const getPermissionText = (permission: string, state: string) => {
    const name = permission === 'microphone' ? 'Microphone' : 'Camera';

    switch (state) {
      case 'granted':
        return `${name} access granted`;
      case 'denied':
        return `${name} access denied`;
      case 'requesting':
        return `Requesting ${name.toLowerCase()} access...`;
      default:
        return `${name} permission unknown`;
    }
  };

  const allPermissionsGranted = requiredPermissions.every(
    perm => permissions[perm] === 'granted'
  );

  const hasPermissionErrors =
    requiredPermissions.some(perm => permissions[perm] === 'denied') ||
    !!permissions.error;

  if (!showUI) {
    return null;
  }

  return (
    <div className="media-permission-handler">
      {/* Main Permission Status */}
      <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Media Permissions</h3>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <InformationCircleIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Permission Items */}
        <div className="space-y-2">
          {requiredPermissions.map(permission => (
            <div key={permission} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getPermissionIcon(permission, permissions[permission])}
                <span className="text-sm text-gray-300">
                  {getPermissionText(permission, permissions[permission])}
                </span>
              </div>

              {permissions[permission] === 'denied' && (
                <button
                  onClick={requestPermissions}
                  className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-white transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {permissions.error && (
          <div className="bg-red-900/20 border border-red-500/20 rounded p-3">
            <div className="flex items-start space-x-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-200">{permissions.error}</p>
                <button
                  onClick={openSystemSettings}
                  className="mt-2 text-xs text-red-300 hover:text-red-100 underline"
                >
                  How to fix this
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            {allPermissionsGranted && (
              <div className="flex items-center space-x-1 text-green-400 text-xs">
                <CheckCircleIcon className="h-4 w-4" />
                <span>Ready to use</span>
              </div>
            )}

            {hasPermissionErrors && (
              <div className="flex items-center space-x-1 text-red-400 text-xs">
                <XCircleIcon className="h-4 w-4" />
                <span>Permissions needed</span>
              </div>
            )}
          </div>

          <div className="space-x-2">
            {hasPermissionErrors && (
              <button
                onClick={openSystemSettings}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                <Cog6ToothIcon className="h-4 w-4 inline mr-1" />
                Settings
              </button>
            )}

            {!allPermissionsGranted && (
              <button
                onClick={requestPermissions}
                disabled={
                  permissions.microphone === 'requesting' ||
                  permissions.camera === 'requesting'
                }
                className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1 rounded text-white transition-colors"
              >
                {permissions.microphone === 'requesting' ||
                permissions.camera === 'requesting'
                  ? 'Requesting...'
                  : 'Grant Access'}
              </button>
            )}
          </div>
        </div>

        {/* Help Text */}
        {showHelp && (
          <div className="bg-blue-900/20 border border-blue-500/20 rounded p-3 text-xs text-blue-200">
            <p className="mb-2">
              <strong>Why do we need these permissions?</strong>
            </p>
            <ul className="space-y-1 text-blue-300">
              {requiredPermissions.includes('microphone') && (
                <li>• Microphone: For voice commands and transcription</li>
              )}
              {requiredPermissions.includes('camera') && (
                <li>• Camera: For visual analysis and context understanding</li>
              )}
            </ul>
            <p className="mt-2 text-blue-400">
              Your privacy is protected - media is processed securely and not
              stored without permission.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
