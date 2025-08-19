/**
 * Connection Health Utilities
 * Provides diagnostics and health checks for API and WebSocket connections
 */

export interface ConnectionHealth {
  api: {
    available: boolean;
    latency?: number;
    error?: string;
  };
  websocket: {
    available: boolean;
    latency?: number;
    error?: string;
  };
}

export const checkApiHealth = async (): Promise<{ available: boolean; latency?: number; error?: string }> => {
  const startTime = Date.now();
  
  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      return { available: true, latency };
    } else {
      return { 
        available: false, 
        error: `HTTP ${response.status}: ${response.statusText}` 
      };
    }
  } catch (error) {
    return { 
      available: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

export const checkWebSocketHealth = async (): Promise<{ available: boolean; latency?: number; error?: string }> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    try {
      // Test if Socket.IO endpoint is accessible
      fetch('/socket.io/', { method: 'GET' })
        .then(response => {
          const latency = Date.now() - startTime;
          
          if (response.status === 400 || response.status === 200) {
            // 400 is expected for Socket.IO without proper handshake
            // 200 might indicate a successful connection endpoint
            resolve({ available: true, latency });
          } else {
            resolve({ 
              available: false, 
              error: `HTTP ${response.status}: ${response.statusText}` 
            });
          }
        })
        .catch(error => {
          resolve({ 
            available: false, 
            error: error instanceof Error ? error.message : 'WebSocket endpoint unreachable' 
          });
        });
    } catch (error) {
      resolve({ 
        available: false, 
        error: error instanceof Error ? error.message : 'WebSocket test failed' 
      });
    }
  });
};

export const performConnectionDiagnostics = async (): Promise<ConnectionHealth> => {
  console.log('🔍 Performing connection diagnostics...');
  
  const [apiHealth, websocketHealth] = await Promise.all([
    checkApiHealth(),
    checkWebSocketHealth()
  ]);
  
  const health: ConnectionHealth = {
    api: apiHealth,
    websocket: websocketHealth
  };
  
  console.log('📊 Connection Health Report:', health);
  
  return health;
};

export const getConnectionAdvice = (health: ConnectionHealth): string[] => {
  const advice: string[] = [];
  
  if (!health.api.available) {
    advice.push('🔴 API connection failed. Check if the backend server is running on port 8000.');
    advice.push('💡 Try: npm start in the backend directory');
  }
  
  if (!health.websocket.available) {
    advice.push('🔴 WebSocket connection failed. Check Vite proxy configuration.');
    advice.push('💡 Try: Restart the frontend development server');
  }
  
  if (health.api.latency && health.api.latency > 2000) {
    advice.push('⚠️ High API latency detected. This may affect performance.');
  }
  
  if (health.websocket.latency && health.websocket.latency > 1000) {
    advice.push('⚠️ High WebSocket latency detected. Real-time features may be slow.');
  }
  
  if (health.api.available && health.websocket.available) {
    advice.push('✅ All connections are healthy!');
  }
  
  return advice;
};