
/**
 * Comprehensive Camera Auto-Fix Script
 * Automatically detects and resolves camera issues
 */

async function autoFixCameraIssues() {
    console.log('🔧 Starting automatic camera issue resolution...');
    
    const fixes = [];
    
    try {
        // Step 1: Test basic camera access
        console.log('📋 Step 1: Testing camera access...');
        const permissionResult = await PermissionFixer.requestCameraPermissions();
        
        if (!permissionResult.success) {
            fixes.push({
                issue: 'Permission denied',
                fixes: permissionResult.fixes,
                critical: true
            });
        }
        
        // Step 2: Test video element functionality
        console.log('📋 Step 2: Testing video element...');
        const video = document.createElement('video');
        const videoSupported = typeof video.play === 'function';
        
        if (!videoSupported) {
            fixes.push({
                issue: 'Video element not supported',
                fixes: ['Update your browser', 'Enable JavaScript', 'Clear browser cache'],
                critical: true
            });
        }
        
        // Step 3: Test canvas functionality
        console.log('📋 Step 3: Testing canvas support...');
        const canvas = document.createElement('canvas');
        const canvasSupported = !!canvas.getContext('2d');
        
        if (!canvasSupported) {
            fixes.push({
                issue: 'Canvas not supported',
                fixes: ['Update your browser', 'Enable hardware acceleration', 'Clear browser data'],
                critical: false
            });
        }
        
        // Step 4: Performance check
        console.log('📋 Step 4: Checking performance...');
        const performanceIssues = await checkPerformance();
        if (performanceIssues.length > 0) {
            fixes.push({
                issue: 'Performance issues detected',
                fixes: performanceIssues,
                critical: false
            });
        }
        
        // Generate report
        if (fixes.length === 0) {
            console.log('✅ All camera tests passed!');
            return { success: true, message: 'Camera system is working correctly' };
        } else {
            console.log(`⚠️ Found ${fixes.length} issues`);
            return { success: false, fixes };
        }
        
    } catch (error) {
        console.error('❌ Auto-fix process failed:', error);
        return {
            success: false,
            error: error.message,
            fixes: [{
                issue: 'Auto-fix process failed',
                fixes: ['Refresh the page', 'Clear browser cache', 'Try a different browser'],
                critical: true
            }]
        };
    }
}

async function checkPerformance() {
    const issues = [];
    
    // Check available memory
    if (navigator.deviceMemory && navigator.deviceMemory < 2) {
        issues.push('Low device memory - close other applications');
    }
    
    // Check connection
    if (navigator.connection) {
        const connection = navigator.connection;
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            issues.push('Slow network connection - try lower resolution');
        }
    }
    
    // Check hardware acceleration
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) {
        issues.push('WebGL not available - enable hardware acceleration');
    }
    
    return issues;
}

// Auto-run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(autoFixCameraIssues, 1000);
    });
} else {
    setTimeout(autoFixCameraIssues, 1000);
}

window.autoFixCameraIssues = autoFixCameraIssues;
