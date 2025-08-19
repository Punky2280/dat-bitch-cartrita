
/**
 * Camera Permission Auto-Fix Utility
 * Handles common camera permission issues
 */

class PermissionFixer {
    static async requestCameraPermissions() {
        try {
            // Method 1: Standard getUserMedia
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            });
            
            console.log('✅ Camera permissions granted via standard method');
            return { success: true, stream };
            
        } catch (error) {
            console.log('⚠️ Standard method failed, trying alternatives...');
            
            // Method 2: Try with minimal constraints
            try {
                const basicStream = await navigator.mediaDevices.getUserMedia({ video: true });
                console.log('✅ Camera permissions granted via basic method');
                return { success: true, stream: basicStream };
                
            } catch (basicError) {
                // Method 3: Check if permissions API is available
                if (navigator.permissions) {
                    try {
                        const permission = await navigator.permissions.query({ name: 'camera' });
                        
                        if (permission.state === 'denied') {
                            return {
                                success: false,
                                error: 'Camera permission permanently denied. Please reset in browser settings.',
                                fixes: [
                                    'Click the camera icon in the address bar',
                                    'Go to browser settings > Privacy & Security > Site Settings > Camera',
                                    'Remove this site from blocked list',
                                    'Refresh the page'
                                ]
                            };
                        }
                    } catch (permError) {
                        console.warn('Permissions API not supported');
                    }
                }
                
                return {
                    success: false,
                    error: error.message,
                    fixes: this.getPermissionFixes(error)
                };
            }
        }
    }
    
    static getPermissionFixes(error) {
        const fixes = [];
        
        if (error.name === 'NotAllowedError') {
            fixes.push(
                'Click the camera icon (🎥) in your browser address bar',
                'Select "Allow" for camera access',
                'Refresh the page after granting permission',
                'Try using HTTPS instead of HTTP',
                'Clear browser cache and cookies',
                'Try incognito/private browsing mode'
            );
        } else if (error.name === 'NotFoundError') {
            fixes.push(
                'Check if camera is connected and powered on',
                'Close other applications using the camera',
                'Try a different camera if available',
                'Update camera drivers',
                'Restart your computer'
            );
        } else if (error.name === 'NotReadableError') {
            fixes.push(
                'Close video conferencing apps (Zoom, Teams, Skype)',
                'Close other browser tabs using camera',
                'Restart your browser',
                'Unplug and reconnect USB camera',
                'Check camera privacy settings in OS'
            );
        }
        
        return fixes;
    }
    
    static displayPermissionHelp(container, fixes) {
        const helpDiv = document.createElement('div');
        helpDiv.className = 'permission-help';
        helpDiv.innerHTML = `
            <h3>🔧 Camera Permission Help</h3>
            <p>Try these solutions:</p>
            <ul>
                ${fixes.map(fix => `<li>${fix}</li>`).join('')}
            </ul>
            <button onclick="location.reload()" class="retry-button">
                🔄 Retry Camera Access
            </button>
        `;
        
        container.appendChild(helpDiv);
    }
}

window.PermissionFixer = PermissionFixer;
