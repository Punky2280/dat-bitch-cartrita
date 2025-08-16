import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Users, 
    Lock, 
    Unlock, 
    MessageCircle, 
    Eye, 
    EyeOff, 
    Activity,
    Clock,
    Share2,
    Bell,
    BellOff,
    Video,
    Mic,
    MicOff,
    Monitor,
    Settings
} from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import { collaborationAPI } from '../../services/collaborationService';
import { toast } from 'react-hot-toast';

/**
 * Real-time Collaboration Component
 * Provides live collaborative editing, presence tracking, and communication
 * @author Robbie Allen - Lead Architect
 * @date January 2025
 */

interface User {
    id: string;
    username: string;
    display_name: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    current_activity?: string;
    cursor_position?: any;
    selection_data?: any;
}

interface Comment {
    id: string;
    user: User;
    comment_text: string;
    position_data?: any;
    thread_id?: string;
    is_resolved: boolean;
    created_at: string;
    replies?: Comment[];
}

interface Lock {
    id: string;
    lock_type: string;
    user: User;
    acquired_at: string;
    expires_at: string;
}

interface CollaborativeEditorProps {
    resourceId: string;
    resourceType: 'document' | 'workflow' | 'conversation';
    initialContent?: any;
    onContentChange?: (content: any, operation: any) => void;
    readOnly?: boolean;
    enableComments?: boolean;
    enablePresence?: boolean;
    enableLocks?: boolean;
    enableVideo?: boolean;
    className?: string;
}

export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
    resourceId,
    resourceType,
    initialContent = '',
    onContentChange,
    readOnly = false,
    enableComments = true,
    enablePresence = true,
    enableLocks = true,
    enableVideo = false,
    className = ''
}) => {
    // State management
    const [content, setContent] = useState(initialContent);
    const [collaborators, setCollaborators] = useState<User[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [locks, setLocks] = useState<Lock[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showPresence, setShowPresence] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [notifications, setNotifications] = useState(true);
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(false);
    const [screenSharing, setScreenSharing] = useState(false);
    
    // Refs
    const editorRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<any>({});
    const versionRef = useRef(0);
    const operationQueueRef = useRef<any[]>([]);
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

    // Socket connection
    const socket = useSocket('/collaboration');

    // Initialize collaboration session
    useEffect(() => {
        initializeSession();
        return () => {
            if (sessionId) {
                leaveSession();
            }
        };
    }, [resourceId, resourceType]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('user_joined', handleUserJoined);
        socket.on('user_left', handleUserLeft);
        socket.on('presence_updated', handlePresenceUpdate);
        socket.on('operation_applied', handleOperationApplied);
        socket.on('lock_acquired', handleLockAcquired);
        socket.on('lock_released', handleLockReleased);
        socket.on('comment_added', handleCommentAdded);
        socket.on('comment_resolved', handleCommentResolved);
        socket.on('cursor_moved', handleCursorMoved);
        socket.on('selection_changed', handleSelectionChanged);
        socket.on('typing_indicator', handleTypingIndicator);

        return () => {
            socket.off('user_joined');
            socket.off('user_left');
            socket.off('presence_updated');
            socket.off('operation_applied');
            socket.off('lock_acquired');
            socket.off('lock_released');
            socket.off('comment_added');
            socket.off('comment_resolved');
            socket.off('cursor_moved');
            socket.off('selection_changed');
            socket.off('typing_indicator');
        };
    }, [socket]);

    // Initialize collaboration session
    const initializeSession = async () => {
        try {
            // Create or join collaboration session
            const sessionResponse = await collaborationAPI.createSession({
                resourceId,
                resourceType,
                expiresIn: 4 // 4 hours
            });

            if (sessionResponse.success) {
                setSessionId(sessionResponse.session.id);
                
                // Join the session
                const joinResponse = await collaborationAPI.joinSession(sessionResponse.session.id);
                if (joinResponse.success) {
                    setCollaborators(joinResponse.collaborators || []);
                    setIsConnected(true);
                }
            }

            // Load existing comments
            if (enableComments) {
                await loadComments();
            }

            // Load resource locks
            if (enableLocks) {
                await loadLocks();
            }

        } catch (error) {
            console.error('Error initializing collaboration session:', error);
            toast.error('Failed to initialize collaboration');
        }
    };

    // Leave collaboration session
    const leaveSession = async () => {
        if (!sessionId) return;

        try {
            await collaborationAPI.leaveSession(sessionId);
            setIsConnected(false);
            setSessionId(null);
            setCollaborators([]);
        } catch (error) {
            console.error('Error leaving session:', error);
        }
    };

    // Load comments
    const loadComments = async () => {
        try {
            const response = await collaborationAPI.getComments(resourceId, resourceType);
            if (response.success) {
                setComments(response.comments);
            }
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    };

    // Load resource locks
    const loadLocks = async () => {
        try {
            const response = await collaborationAPI.getLocks(resourceId, resourceType);
            if (response.success) {
                setLocks(response.locks);
            }
        } catch (error) {
            console.error('Error loading locks:', error);
        }
    };

    // Apply operational transform
    const applyOperation = useCallback((operation: any) => {
        const { type, position, content: opContent, length } = operation;
        
        let newContent = content;
        
        switch (type) {
            case 'insert':
                newContent = content.slice(0, position) + opContent + content.slice(position);
                break;
            case 'delete':
                newContent = content.slice(0, position) + content.slice(position + length);
                break;
            case 'replace':
                newContent = content.slice(0, position) + opContent + content.slice(position + length);
                break;
        }

        setContent(newContent);
        versionRef.current += 1;

        if (onContentChange) {
            onContentChange(newContent, operation);
        }

        return newContent;
    }, [content, onContentChange]);

    // Handle content change
    const handleContentChange = async (newContent: string, operation: any) => {
        if (readOnly) return;

        try {
            // Apply operation locally
            setContent(newContent);
            versionRef.current += 1;

            // Send operation to server
            const response = await collaborationAPI.logOperation({
                documentId: resourceId,
                documentType: resourceType,
                operationType: operation.type,
                operationData: operation,
                version: versionRef.current,
                position: operation.position,
                content: operation.content,
                sessionId
            });

            if (!response.success) {
                // Revert on failure
                console.error('Failed to log operation:', response.message);
                toast.error('Failed to sync changes');
            }

        } catch (error) {
            console.error('Error handling content change:', error);
            toast.error('Error syncing changes');
        }
    };

    // Acquire resource lock
    const acquireLock = async (lockType: string) => {
        if (!socket) return;

        try {
            const response = await collaborationAPI.acquireLock({
                resourceId,
                resourceType,
                lockType,
                socketId: socket.id,
                duration: 30
            });

            if (response.success) {
                toast.success('Lock acquired');
            } else {
                toast.error(response.message || 'Failed to acquire lock');
            }
        } catch (error) {
            console.error('Error acquiring lock:', error);
            toast.error('Failed to acquire lock');
        }
    };

    // Release resource lock
    const releaseLock = async (lockType: string) => {
        try {
            const response = await collaborationAPI.releaseLock({
                resourceId,
                resourceType,
                lockType
            });

            if (response.success) {
                toast.success('Lock released');
            }
        } catch (error) {
            console.error('Error releasing lock:', error);
            toast.error('Failed to release lock');
        }
    };

    // Add comment
    const addComment = async (position?: any) => {
        if (!newComment.trim()) return;

        try {
            const response = await collaborationAPI.addComment({
                resourceId,
                resourceType,
                commentText: newComment,
                positionData: position || selectedPosition
            });

            if (response.success) {
                setNewComment('');
                setSelectedPosition(null);
                await loadComments();
                toast.success('Comment added');
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            toast.error('Failed to add comment');
        }
    };

    // Resolve comment
    const resolveComment = async (commentId: string) => {
        try {
            const response = await collaborationAPI.resolveComment(commentId);
            if (response.success) {
                await loadComments();
                toast.success('Comment resolved');
            }
        } catch (error) {
            console.error('Error resolving comment:', error);
            toast.error('Failed to resolve comment');
        }
    };

    // Socket event handlers
    const handleUserJoined = (data: any) => {
        setCollaborators(prev => {
            const exists = prev.find(u => u.id === data.user.id);
            if (exists) return prev;
            return [...prev, data.user];
        });
        
        if (notifications) {
            toast.success(`${data.user.username} joined`);
        }
    };

    const handleUserLeft = (data: any) => {
        setCollaborators(prev => prev.filter(u => u.id !== data.user_id));
    };

    const handlePresenceUpdate = (data: any) => {
        setCollaborators(prev => 
            prev.map(user => 
                user.id === data.user_id 
                    ? { ...user, status: data.status, current_activity: data.activity }
                    : user
            )
        );
    };

    const handleOperationApplied = (data: any) => {
        const { operation, user } = data;
        
        // Don't apply operations from current user
        if (user.id === localStorage.getItem('userId')) return;

        // Apply operational transform
        applyOperation(operation.operation_data);
    };

    const handleLockAcquired = (data: any) => {
        setLocks(prev => [...prev, {
            id: `${data.resource_id}_${data.lock_type}`,
            lock_type: data.lock_type,
            user: { id: data.user_id, username: data.username },
            acquired_at: data.timestamp,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        }]);
    };

    const handleLockReleased = (data: any) => {
        setLocks(prev => prev.filter(lock => 
            !(lock.lock_type === data.lock_type && lock.user.id === data.user_id)
        ));
    };

    const handleCommentAdded = (data: any) => {
        setComments(prev => [...prev, data.comment]);
        
        if (notifications && data.comment.user.id !== localStorage.getItem('userId')) {
            toast.success(`New comment from ${data.comment.user.username}`);
        }
    };

    const handleCommentResolved = (data: any) => {
        setComments(prev => 
            prev.map(comment => 
                comment.id === data.comment_id 
                    ? { ...comment, is_resolved: true, resolved_at: data.timestamp }
                    : comment
            )
        );
    };

    const handleCursorMoved = (data: any) => {
        cursorRef.current[data.user_id] = {
            position: data.position,
            user: data.user
        };
        // Update cursor visualization
    };

    const handleSelectionChanged = (data: any) => {
        cursorRef.current[data.user_id] = {
            ...cursorRef.current[data.user_id],
            selection: data.selection
        };
    };

    const handleTypingIndicator = (data: any) => {
        // Show typing indicator
        console.log(`${data.username} is typing...`);
    };

    // Toggle video call
    const toggleVideo = async () => {
        if (!enableVideo) return;

        try {
            if (!videoEnabled) {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: audioEnabled 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setVideoEnabled(true);
            } else {
                if (videoRef.current?.srcObject) {
                    const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                    tracks.forEach(track => track.stop());
                }
                setVideoEnabled(false);
            }
        } catch (error) {
            console.error('Error toggling video:', error);
            toast.error('Failed to toggle video');
        }
    };

    // Toggle audio
    const toggleAudio = async () => {
        if (!enableVideo) return;

        setAudioEnabled(!audioEnabled);
        
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            const audioTracks = stream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !audioEnabled;
            });
        }
    };

    // Share screen
    const shareScreen = async () => {
        try {
            if (!screenSharing) {
                const stream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: true, 
                    audio: true 
                });
                // Handle screen sharing stream
                setScreenSharing(true);
                toast.success('Screen sharing started');
            } else {
                setScreenSharing(false);
                toast.success('Screen sharing stopped');
            }
        } catch (error) {
            console.error('Error sharing screen:', error);
            toast.error('Failed to share screen');
        }
    };

    return (
        <div className={`collaborative-editor ${className}`}>
            {/* Connection Status */}
            <div className="collaboration-header">
                <div className="connection-status">
                    <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                        <div className="status-dot"></div>
                        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                </div>

                {/* Collaboration Controls */}
                <div className="collaboration-controls">
                    {enablePresence && (
                        <button
                            onClick={() => setShowPresence(!showPresence)}
                            className={`control-btn ${showPresence ? 'active' : ''}`}
                            title="Toggle presence"
                        >
                            <Users size={16} />
                            <span>{collaborators.length}</span>
                        </button>
                    )}

                    {enableComments && (
                        <button
                            onClick={() => setShowComments(!showComments)}
                            className={`control-btn ${showComments ? 'active' : ''}`}
                            title="Toggle comments"
                        >
                            <MessageCircle size={16} />
                            <span>{comments.length}</span>
                        </button>
                    )}

                    <button
                        onClick={() => setNotifications(!notifications)}
                        className={`control-btn ${notifications ? 'active' : ''}`}
                        title="Toggle notifications"
                    >
                        {notifications ? <Bell size={16} /> : <BellOff size={16} />}
                    </button>

                    {enableVideo && (
                        <>
                            <button
                                onClick={toggleVideo}
                                className={`control-btn ${videoEnabled ? 'active' : ''}`}
                                title="Toggle video"
                            >
                                <Video size={16} />
                            </button>

                            <button
                                onClick={toggleAudio}
                                className={`control-btn ${audioEnabled ? 'active' : ''}`}
                                title="Toggle audio"
                            >
                                {audioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                            </button>

                            <button
                                onClick={shareScreen}
                                className={`control-btn ${screenSharing ? 'active' : ''}`}
                                title="Share screen"
                            >
                                <Monitor size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="collaboration-content">
                {/* Presence Panel */}
                {enablePresence && showPresence && (
                    <div className="presence-panel">
                        <h3>
                            <Users size={16} />
                            Collaborators ({collaborators.length})
                        </h3>
                        
                        <div className="collaborator-list">
                            {collaborators.map(user => (
                                <div key={user.id} className="collaborator-item">
                                    <div className={`user-avatar ${user.status}`}>
                                        {user.display_name?.charAt(0) || user.username.charAt(0)}
                                    </div>
                                    <div className="user-info">
                                        <div className="user-name">{user.display_name || user.username}</div>
                                        {user.current_activity && (
                                            <div className="user-activity">
                                                <Activity size={12} />
                                                {user.current_activity}
                                            </div>
                                        )}
                                        <div className={`user-status ${user.status}`}>
                                            {user.status}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Resource Locks */}
                        {enableLocks && locks.length > 0 && (
                            <div className="locks-section">
                                <h4>
                                    <Lock size={14} />
                                    Active Locks
                                </h4>
                                {locks.map(lock => (
                                    <div key={lock.id} className="lock-item">
                                        <Lock size={12} />
                                        <span>{lock.lock_type}</span>
                                        <small>by {lock.user.username}</small>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Main Editor Area */}
                <div className="editor-container">
                    {/* Video Call Area */}
                    {enableVideo && (videoEnabled || screenSharing) && (
                        <div className="video-area">
                            <video ref={videoRef} autoPlay muted className="local-video" />
                        </div>
                    )}

                    {/* Editor */}
                    <div
                        ref={editorRef}
                        className="collaborative-text-editor"
                        contentEditable={!readOnly}
                        onInput={(e) => {
                            const newContent = e.currentTarget.textContent || '';
                            const operation = {
                                type: 'replace',
                                position: 0,
                                content: newContent,
                                length: content.length
                            };
                            handleContentChange(newContent, operation);
                        }}
                        onSelect={(e) => {
                            const selection = window.getSelection();
                            if (selection && socket) {
                                socket.emit('selection_changed', {
                                    resourceId,
                                    selection: {
                                        start: selection.anchorOffset,
                                        end: selection.focusOffset
                                    }
                                });
                            }
                        }}
                        suppressContentEditableWarning={true}
                    >
                        {content}
                    </div>

                    {/* Cursors and Selections */}
                    <div className="cursors-overlay">
                        {Object.entries(cursorRef.current).map(([userId, cursor]: [string, any]) => (
                            <div
                                key={userId}
                                className="user-cursor"
                                style={{
                                    left: cursor.position?.x || 0,
                                    top: cursor.position?.y || 0
                                }}
                            >
                                <div className="cursor-label">
                                    {cursor.user?.username}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Comments Panel */}
                {enableComments && showComments && (
                    <div className="comments-panel">
                        <h3>
                            <MessageCircle size={16} />
                            Comments ({comments.filter(c => !c.is_resolved).length})
                        </h3>

                        {/* Add Comment */}
                        <div className="add-comment">
                            <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..."
                                rows={3}
                            />
                            <button 
                                onClick={() => addComment()}
                                disabled={!newComment.trim()}
                            >
                                Add Comment
                            </button>
                        </div>

                        {/* Comments List */}
                        <div className="comments-list">
                            {comments
                                .filter(comment => !comment.is_resolved)
                                .map(comment => (
                                    <div key={comment.id} className="comment-item">
                                        <div className="comment-header">
                                            <div className="user-avatar">
                                                {comment.user.display_name?.charAt(0) || comment.user.username.charAt(0)}
                                            </div>
                                            <div className="comment-meta">
                                                <span className="username">
                                                    {comment.user.display_name || comment.user.username}
                                                </span>
                                                <span className="timestamp">
                                                    <Clock size={12} />
                                                    {new Date(comment.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => resolveComment(comment.id)}
                                                className="resolve-btn"
                                                title="Mark as resolved"
                                            >
                                                ✓
                                            </button>
                                        </div>
                                        <div className="comment-content">
                                            {comment.comment_text}
                                        </div>
                                        {comment.replies && comment.replies.length > 0 && (
                                            <div className="comment-replies">
                                                {comment.replies.map(reply => (
                                                    <div key={reply.id} className="reply-item">
                                                        <div className="reply-user">
                                                            {reply.user.username}:
                                                        </div>
                                                        <div className="reply-content">
                                                            {reply.comment_text}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Lock Controls */}
            {enableLocks && !readOnly && (
                <div className="lock-controls">
                    <button onClick={() => acquireLock('document')}>
                        <Lock size={14} />
                        Lock Document
                    </button>
                    <button onClick={() => releaseLock('document')}>
                        <Unlock size={14} />
                        Release Lock
                    </button>
                </div>
            )}

            <style jsx>{`
                .collaborative-editor {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                .collaboration-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid #e2e8f0;
                    background: #f8fafc;
                }

                .connection-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 14px;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #ef4444;
                }

                .status-indicator.connected .status-dot {
                    background: #10b981;
                }

                .collaboration-controls {
                    display: flex;
                    gap: 8px;
                }

                .control-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    background: white;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .control-btn:hover {
                    background: #f3f4f6;
                }

                .control-btn.active {
                    background: #3b82f6;
                    color: white;
                    border-color: #3b82f6;
                }

                .collaboration-content {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }

                .presence-panel {
                    width: 280px;
                    padding: 16px;
                    border-right: 1px solid #e2e8f0;
                    background: #f8fafc;
                    overflow-y: auto;
                }

                .presence-panel h3 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 0 16px 0;
                    font-size: 16px;
                    font-weight: 600;
                }

                .collaborator-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 24px;
                }

                .collaborator-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .user-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: #6b7280;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 14px;
                    position: relative;
                }

                .user-avatar.online::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    right: 0;
                    width: 10px;
                    height: 10px;
                    background: #10b981;
                    border: 2px solid white;
                    border-radius: 50%;
                }

                .user-info {
                    flex: 1;
                    min-width: 0;
                }

                .user-name {
                    font-weight: 500;
                    font-size: 14px;
                    color: #1f2937;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .user-activity {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 12px;
                    color: #6b7280;
                    margin-top: 2px;
                }

                .user-status {
                    font-size: 11px;
                    text-transform: uppercase;
                    font-weight: 600;
                    margin-top: 2px;
                }

                .user-status.online { color: #10b981; }
                .user-status.away { color: #f59e0b; }
                .user-status.busy { color: #ef4444; }
                .user-status.offline { color: #6b7280; }

                .locks-section {
                    padding-top: 16px;
                    border-top: 1px solid #e2e8f0;
                }

                .locks-section h4 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 0 12px 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #1f2937;
                }

                .lock-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 0;
                    font-size: 13px;
                    color: #6b7280;
                }

                .editor-container {
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                }

                .video-area {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    z-index: 10;
                }

                .local-video {
                    width: 200px;
                    height: 150px;
                    border-radius: 8px;
                    background: #000;
                }

                .collaborative-text-editor {
                    width: 100%;
                    height: 100%;
                    padding: 24px;
                    border: none;
                    outline: none;
                    resize: none;
                    font-family: inherit;
                    font-size: 14px;
                    line-height: 1.6;
                    overflow-y: auto;
                }

                .cursors-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 5;
                }

                .user-cursor {
                    position: absolute;
                    width: 2px;
                    height: 20px;
                    background: #3b82f6;
                    pointer-events: none;
                }

                .cursor-label {
                    position: absolute;
                    top: -24px;
                    left: 0;
                    background: #3b82f6;
                    color: white;
                    padding: 2px 6px;
                    font-size: 11px;
                    border-radius: 4px;
                    white-space: nowrap;
                }

                .comments-panel {
                    width: 320px;
                    padding: 16px;
                    border-left: 1px solid #e2e8f0;
                    background: #f8fafc;
                    overflow-y: auto;
                }

                .comments-panel h3 {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 0 16px 0;
                    font-size: 16px;
                    font-weight: 600;
                }

                .add-comment {
                    margin-bottom: 24px;
                }

                .add-comment textarea {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    resize: vertical;
                    margin-bottom: 8px;
                }

                .add-comment button {
                    padding: 6px 12px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                }

                .add-comment button:disabled {
                    background: #9ca3af;
                    cursor: not-allowed;
                }

                .comments-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .comment-item {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 12px;
                }

                .comment-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .comment-meta {
                    flex: 1;
                }

                .comment-meta .username {
                    font-weight: 500;
                    font-size: 14px;
                    color: #1f2937;
                }

                .comment-meta .timestamp {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 12px;
                    color: #6b7280;
                    margin-top: 2px;
                }

                .resolve-btn {
                    background: none;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    width: 24px;
                    height: 24px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6b7280;
                }

                .resolve-btn:hover {
                    background: #f3f4f6;
                    color: #10b981;
                }

                .comment-content {
                    font-size: 14px;
                    line-height: 1.5;
                    color: #374151;
                }

                .comment-replies {
                    margin-top: 12px;
                    padding-left: 16px;
                    border-left: 2px solid #e5e7eb;
                }

                .reply-item {
                    margin-bottom: 8px;
                }

                .reply-user {
                    font-weight: 500;
                    font-size: 13px;
                    color: #6b7280;
                    margin-bottom: 2px;
                }

                .reply-content {
                    font-size: 13px;
                    color: #374151;
                }

                .lock-controls {
                    display: flex;
                    gap: 8px;
                    padding: 12px 16px;
                    border-top: 1px solid #e2e8f0;
                    background: #f8fafc;
                }

                .lock-controls button {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    background: white;
                    cursor: pointer;
                    font-size: 14px;
                }

                .lock-controls button:hover {
                    background: #f3f4f6;
                }
            `}</style>
        </div>
    );
};

export default CollaborativeEditor;
