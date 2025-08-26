'use client';

import { useEffect } from 'react';
import { NotificationService } from '@/stores/notificationStore';

export default function DemoNotificationTrigger() {
  useEffect(() => {
    const notificationService = NotificationService.getInstance();
    
    // Simulate periodic system notifications
    const intervals = [
      // Agent status updates
      setInterval(() => {
        notificationService.agentNotification(
          'ChatGPT-4',
          'Processing conversation with user about AI ethics',
          'info'
        );
      }, 30000), // Every 30 seconds

      // System updates
      setInterval(() => {
        notificationService.systemNotification(
          'System Performance',
          'All agents running at optimal performance. Memory usage: 78%',
          'low'
        );
      }, 45000), // Every 45 seconds

      // Security alerts (less frequent)
      setInterval(() => {
        const alerts = [
          'New device login detected from Chrome on Windows',
          'API key accessed from new IP address',
          'Failed login attempt blocked',
        ];
        const randomAlert = alerts[Math.floor(Math.random() * alerts.length)];
        
        notificationService.securityAlert(
          'Security Event',
          randomAlert,
          '/settings/security'
        );
      }, 120000), // Every 2 minutes

      // Updates and features
      setInterval(() => {
        const updates = [
          'New quantum computing integration available',
          'Enhanced natural language processing deployed',
          'Real-time analytics dashboard updated',
          'New machine learning models added to agent pool',
        ];
        const randomUpdate = updates[Math.floor(Math.random() * updates.length)];
        
        notificationService.updateNotification(
          'Platform Update',
          randomUpdate,
          '/about'
        );
      }, 90000), // Every 1.5 minutes
    ];

    // Add some initial varied notifications
    setTimeout(() => {
      notificationService.agentNotification(
        'Vision AI',
        'Image processing complete - 15 objects detected',
        'success'
      );
    }, 5000);

    setTimeout(() => {
      notificationService.systemNotification(
        'Backup Complete',
        'All user data successfully backed up to secure cloud storage',
        'medium'
      );
    }, 10000);

    setTimeout(() => {
      notificationService.securityAlert(
        'Password Expiry',
        'Your password will expire in 7 days. Please update it.',
        '/settings/security'
      );
    }, 15000);

    // Cleanup intervals
    return () => {
      intervals.forEach(clearInterval);
    };
  }, []);

  return null; // This component doesn't render anything
}