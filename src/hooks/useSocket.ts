import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

/**
 * Custom hook for Socket.IO connections
 * Manages socket connections with automatic reconnection and namespace support
 * @author Robbie Allen - Lead Architect  
 * @date January 2025
 */

interface UseSocketOptions {
    autoConnect?: boolean;
    reconnection?: boolean;
    reconnectionDelay?: number;
    reconnectionAttempts?: number;
    timeout?: number;
    auth?: any;
}

export const useSocket = (namespace: string = '', options: UseSocketOptions = {}) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    
    const socketRef = useRef<Socket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Default options
    const defaultOptions: UseSocketOptions = {
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 20000,
        ...options
    };

    const getServerUrl = () => {
        if (typeof window !== 'undefined') {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = process.env.NODE_ENV === 'development' 
                ? `${window.location.hostname}:8001`
                : window.location.host;
            return `${protocol}//${host}`;
        }
        return process.env.REACT_APP_SOCKET_URL || 'ws://localhost:8001';
    };

    const connect = () => {
        if (socketRef.current?.connected) {
            return;
        }

        try {
            const serverUrl = getServerUrl();
            const fullPath = namespace ? `${serverUrl}${namespace}` : serverUrl;

            console.log(`[Socket] Connecting to: ${fullPath}`);

            const newSocket = io(fullPath, {
                autoConnect: defaultOptions.autoConnect,
                reconnection: defaultOptions.reconnection,
                reconnectionDelay: defaultOptions.reconnectionDelay,
                reconnectionAttempts: defaultOptions.reconnectionAttempts,
                timeout: defaultOptions.timeout,
                transports: ['websocket', 'polling'],
                auth: defaultOptions.auth || (() => {
                    const token = localStorage.getItem('token');
                    return token ? { token } : {};
                })
            });

            // Connection event handlers
            newSocket.on('connect', () => {
                console.log(`[Socket] Connected to ${namespace || 'main'} namespace: ${newSocket.id}`);
                setIsConnected(true);
                setConnectionError(null);
                setReconnectAttempt(0);
            });

            newSocket.on('disconnect', (reason) => {
                console.log(`[Socket] Disconnected from ${namespace || 'main'}: ${reason}`);
                setIsConnected(false);
                
                if (reason === 'io server disconnect') {
                    // Server initiated disconnect, don't reconnect automatically
                    setConnectionError('Server disconnected');
                } else {
                    // Client or network initiated disconnect, will auto-reconnect
                    setConnectionError(`Disconnected: ${reason}`);
                }
            });

            newSocket.on('connect_error', (error) => {
                console.error(`[Socket] Connection error to ${namespace || 'main'}:`, error);
                setConnectionError(error.message);
                setIsConnected(false);
            });

            newSocket.on('reconnect', (attemptNumber) => {
                console.log(`[Socket] Reconnected to ${namespace || 'main'} after ${attemptNumber} attempts`);
                setReconnectAttempt(0);
                setConnectionError(null);
            });

            newSocket.on('reconnect_attempt', (attemptNumber) => {
                console.log(`[Socket] Reconnect attempt ${attemptNumber} to ${namespace || 'main'}`);
                setReconnectAttempt(attemptNumber);
            });

            newSocket.on('reconnect_error', (error) => {
                console.error(`[Socket] Reconnect error to ${namespace || 'main'}:`, error);
                setConnectionError(`Reconnect failed: ${error.message}`);
            });

            newSocket.on('reconnect_failed', () => {
                console.error(`[Socket] Reconnect failed to ${namespace || 'main'} after max attempts`);
                setConnectionError('Reconnection failed');
                setIsConnected(false);
            });

            // Custom events
            newSocket.on('error', (error) => {
                console.error(`[Socket] Socket error in ${namespace || 'main'}:`, error);
                setConnectionError(error.message || 'Socket error');
            });

            socketRef.current = newSocket;
            setSocket(newSocket);

        } catch (error) {
            console.error(`[Socket] Failed to create connection to ${namespace || 'main'}:`, error);
            setConnectionError('Failed to create connection');
        }
    };

    const disconnect = () => {
        if (socketRef.current) {
            console.log(`[Socket] Manually disconnecting from ${namespace || 'main'}`);
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
        }
    };

    const reconnect = () => {
        if (socketRef.current) {
            disconnect();
        }
        
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        // Attempt reconnection after a short delay
        reconnectTimeoutRef.current = setTimeout(() => {
            connect();
        }, 1000);
    };

    // Initialize connection
    useEffect(() => {
        if (defaultOptions.autoConnect) {
            connect();
        }

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [namespace]); // Reconnect when namespace changes

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, []);

    // Helper functions for common socket operations
    const emit = (event: string, data?: any) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(event, data);
            return true;
        } else {
            console.warn(`[Socket] Cannot emit '${event}': not connected to ${namespace || 'main'}`);
            return false;
        }
    };

    const on = (event: string, handler: (...args: any[]) => void) => {
        if (socketRef.current) {
            socketRef.current.on(event, handler);
            return () => socketRef.current?.off(event, handler);
        }
        return () => {};
    };

    const off = (event: string, handler?: (...args: any[]) => void) => {
        if (socketRef.current) {
            if (handler) {
                socketRef.current.off(event, handler);
            } else {
                socketRef.current.removeAllListeners(event);
            }
        }
    };

    const once = (event: string, handler: (...args: any[]) => void) => {
        if (socketRef.current) {
            socketRef.current.once(event, handler);
        }
    };

    return {
        socket,
        isConnected,
        connectionError,
        reconnectAttempt,
        connect,
        disconnect,
        reconnect,
        emit,
        on,
        off,
        once,
        id: socket?.id || null
    };
};

// Hook for specific collaboration namespace
export const useCollaborationSocket = (options?: UseSocketOptions) => {
    return useSocket('/collaboration', options);
};

// Hook for main chat namespace
export const useChatSocket = (options?: UseSocketOptions) => {
    return useSocket('', options);
};

// Hook for notifications namespace
export const useNotificationsSocket = (options?: UseSocketOptions) => {
    return useSocket('/notifications', options);
};

export default useSocket;
