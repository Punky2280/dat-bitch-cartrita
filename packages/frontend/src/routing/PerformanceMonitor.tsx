import React, { useEffect, useState, ReactNode } from 'react';

interface PerformanceMetrics {
  navigationTiming: number;
  routeLoadTime: number;
  memoryUsage?: number;
  connectionType?: string;
}

interface PerformanceMonitorProps {
  children: ReactNode;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ children }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);

  useEffect(() => {
    // Monitor Core Web Vitals
    const observePerformance = () => {
      if ('PerformanceObserver' in window) {
        // Largest Contentful Paint (LCP)
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          console.log('LCP:', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay (FID)
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            console.log('FID:', (entry as any).processingStart - entry.startTime);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift (CLS)
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          list.getEntries().forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          console.log('CLS:', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        return () => {
          lcpObserver.disconnect();
          fidObserver.disconnect();
          clsObserver.disconnect();
        };
      }
    };

    // Monitor route navigation performance
    const monitorRoutePerformance = () => {
      const navigationStart = performance.now();
      
      const cleanup = observePerformance();
      
      // Record metrics on route completion
      setTimeout(() => {
        const navigationTime = performance.now() - navigationStart;
        setMetrics(prev => [...prev.slice(-9), {
          navigationTiming: navigationTime,
          routeLoadTime: navigationTime,
          memoryUsage: (performance as any).memory?.usedJSHeapSize,
          connectionType: (navigator as any).connection?.effectiveType
        }]);

        cleanup?.();
      }, 100);

      return cleanup;
    };

    const cleanup = monitorRoutePerformance();

    return () => {
      cleanup?.();
    };
  }, []);

  // Performance reporting in development
  useEffect(() => {
    if (import.meta.env.DEV && metrics.length > 0) {
      const latestMetric = metrics[metrics.length - 1];
      console.log('Route Performance:', {
        navigationTime: `${latestMetric.navigationTiming.toFixed(2)}ms`,
        memoryUsage: latestMetric.memoryUsage ? 
          `${(latestMetric.memoryUsage / 1024 / 1024).toFixed(2)}MB` : 'N/A',
        connectionType: latestMetric.connectionType || 'Unknown'
      });
    }
  }, [metrics]);

  return (
    <>
      {children}
    </>
  );
};
