/**
 * Collaboration Service API Client
 * Handles API calls for real-time collaboration features
 * @author Robbie Allen - Lead Architect
 * @date January 2025
 */

import { apiClient } from './api';

interface CreateSessionRequest {
    resourceId: string;
    resourceType: 'document' | 'workflow' | 'conversation';
    sessionData?: any;
    expiresIn?: number;
}

interface AcquireLockRequest {
    resourceId: string;
    resourceType: string;
    lockType: string;
    socketId: string;
    duration?: number;
}

interface ReleaseLockRequest {
    resourceId: string;
    resourceType: string;
    lockType: string;
}

interface LogOperationRequest {
    documentId: string;
    documentType: string;
    operationType: string;
    operationData: any;
    version: number;
    position?: number;
    content?: string;
    sessionId?: string;
}

interface AddCommentRequest {
    resourceId: string;
    resourceType: string;
    commentText: string;
    positionData?: any;
    threadId?: string;
}

interface UpdatePresenceRequest {
    status: 'online' | 'away' | 'busy' | 'offline';
    activity?: string;
    socketId?: string;
}

export class CollaborationService {
    private baseURL = '/api/collaboration';

    /**
     * Get current user presence
     */
    async getPresence() {
        try {
            const response = await apiClient.get(`${this.baseURL}/presence`);
            return response.data;
        } catch (error) {
            console.error('Error getting presence:', error);
            throw error;
        }
    }

    /**
     * Update user presence status
     */
    async updatePresence(data: UpdatePresenceRequest) {
        try {
            const response = await apiClient.put(`${this.baseURL}/presence`, data);
            return response.data;
        } catch (error) {
            console.error('Error updating presence:', error);
            throw error;
        }
    }

    /**
     * Get presence information for multiple users
     */
    async getUserPresences(userIds: string[]) {
        try {
            const response = await apiClient.get(`${this.baseURL}/presence/users`, {
                params: { userIds: userIds.join(',') }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting user presences:', error);
            throw error;
        }
    }

    /**
     * Create a new collaboration session
     */
    async createSession(data: CreateSessionRequest) {
        try {
            const response = await apiClient.post(`${this.baseURL}/sessions`, data);
            return response.data;
        } catch (error) {
            console.error('Error creating collaboration session:', error);
            throw error;
        }
    }

    /**
     * Get collaboration session details
     */
    async getSession(sessionId: string) {
        try {
            const response = await apiClient.get(`${this.baseURL}/sessions/${sessionId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting collaboration session:', error);
            throw error;
        }
    }

    /**
     * Join a collaboration session
     */
    async joinSession(sessionId: string) {
        try {
            const response = await apiClient.post(`${this.baseURL}/sessions/${sessionId}/join`);
            return response.data;
        } catch (error) {
            console.error('Error joining collaboration session:', error);
            throw error;
        }
    }

    /**
     * Leave a collaboration session
     */
    async leaveSession(sessionId: string) {
        try {
            const response = await apiClient.post(`${this.baseURL}/sessions/${sessionId}/leave`);
            return response.data;
        } catch (error) {
            console.error('Error leaving collaboration session:', error);
            throw error;
        }
    }

    /**
     * Acquire a resource lock
     */
    async acquireLock(data: AcquireLockRequest) {
        try {
            const response = await apiClient.post(`${this.baseURL}/locks`, data);
            return response.data;
        } catch (error) {
            console.error('Error acquiring lock:', error);
            throw error;
        }
    }

    /**
     * Release a resource lock
     */
    async releaseLock(data: ReleaseLockRequest) {
        try {
            const response = await apiClient.delete(`${this.baseURL}/locks`, { data });
            return response.data;
        } catch (error) {
            console.error('Error releasing lock:', error);
            throw error;
        }
    }

    /**
     * Get locks for a resource
     */
    async getLocks(resourceId: string, resourceType: string) {
        try {
            const response = await apiClient.get(`${this.baseURL}/locks/${resourceId}`, {
                params: { resourceType }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting locks:', error);
            throw error;
        }
    }

    /**
     * Log a document operation for operational transform
     */
    async logOperation(data: LogOperationRequest) {
        try {
            const response = await apiClient.post(`${this.baseURL}/operations`, data);
            return response.data;
        } catch (error) {
            console.error('Error logging operation:', error);
            throw error;
        }
    }

    /**
     * Get document operations history
     */
    async getOperations(documentId: string, documentType: string, options: {
        since?: string;
        limit?: number;
    } = {}) {
        try {
            const response = await apiClient.get(`${this.baseURL}/operations/${documentId}`, {
                params: {
                    documentType,
                    ...options
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting operations:', error);
            throw error;
        }
    }

    /**
     * Add a comment to a resource
     */
    async addComment(data: AddCommentRequest) {
        try {
            const response = await apiClient.post(`${this.baseURL}/comments`, data);
            return response.data;
        } catch (error) {
            console.error('Error adding comment:', error);
            throw error;
        }
    }

    /**
     * Get comments for a resource
     */
    async getComments(resourceId: string, resourceType: string, includeResolved = false) {
        try {
            const response = await apiClient.get(`${this.baseURL}/comments/${resourceId}`, {
                params: { resourceType, includeResolved }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting comments:', error);
            throw error;
        }
    }

    /**
     * Mark a comment as resolved
     */
    async resolveComment(commentId: string) {
        try {
            const response = await apiClient.put(`${this.baseURL}/comments/${commentId}/resolve`);
            return response.data;
        } catch (error) {
            console.error('Error resolving comment:', error);
            throw error;
        }
    }

    /**
     * Get activity history for a resource
     */
    async getActivity(resourceId: string, resourceType: string, options: {
        limit?: number;
        offset?: number;
    } = {}) {
        try {
            const response = await apiClient.get(`${this.baseURL}/activity/${resourceId}`, {
                params: {
                    resourceType,
                    limit: options.limit || 20,
                    offset: options.offset || 0
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting activity:', error);
            throw error;
        }
    }

    /**
     * Create a collaboration invitation
     */
    async createInvitation(data: {
        resourceId: string;
        resourceType: string;
        inviteeEmail?: string;
        inviteeId?: string;
        permissions: string[];
        message?: string;
        expiresIn?: number;
    }) {
        try {
            const response = await apiClient.post(`${this.baseURL}/invitations`, data);
            return response.data;
        } catch (error) {
            console.error('Error creating invitation:', error);
            throw error;
        }
    }

    /**
     * Accept a collaboration invitation
     */
    async acceptInvitation(invitationId: string) {
        try {
            const response = await apiClient.post(`${this.baseURL}/invitations/${invitationId}/accept`);
            return response.data;
        } catch (error) {
            console.error('Error accepting invitation:', error);
            throw error;
        }
    }

    /**
     * Decline a collaboration invitation
     */
    async declineInvitation(invitationId: string) {
        try {
            const response = await apiClient.post(`${this.baseURL}/invitations/${invitationId}/decline`);
            return response.data;
        } catch (error) {
            console.error('Error declining invitation:', error);
            throw error;
        }
    }

    /**
     * Get collaboration invitations
     */
    async getInvitations(status?: 'pending' | 'accepted' | 'declined' | 'expired') {
        try {
            const response = await apiClient.get(`${this.baseURL}/invitations`, {
                params: { status }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting invitations:', error);
            throw error;
        }
    }

    /**
     * Share a resource with specific permissions
     */
    async shareResource(data: {
        resourceId: string;
        resourceType: string;
        userIds: string[];
        permissions: string[];
        message?: string;
    }) {
        try {
            const response = await apiClient.post(`${this.baseURL}/share`, data);
            return response.data;
        } catch (error) {
            console.error('Error sharing resource:', error);
            throw error;
        }
    }

    /**
     * Update resource permissions
     */
    async updatePermissions(data: {
        resourceId: string;
        resourceType: string;
        userId: string;
        permissions: string[];
    }) {
        try {
            const response = await apiClient.put(`${this.baseURL}/permissions`, data);
            return response.data;
        } catch (error) {
            console.error('Error updating permissions:', error);
            throw error;
        }
    }

    /**
     * Remove user access to resource
     */
    async revokeAccess(resourceId: string, resourceType: string, userId: string) {
        try {
            const response = await apiClient.delete(`${this.baseURL}/permissions`, {
                data: { resourceId, resourceType, userId }
            });
            return response.data;
        } catch (error) {
            console.error('Error revoking access:', error);
            throw error;
        }
    }

    /**
     * Get resource permissions
     */
    async getPermissions(resourceId: string, resourceType: string) {
        try {
            const response = await apiClient.get(`${this.baseURL}/permissions/${resourceId}`, {
                params: { resourceType }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting permissions:', error);
            throw error;
        }
    }

    /**
     * Start screen sharing session
     */
    async startScreenShare(sessionId: string) {
        try {
            const response = await apiClient.post(`${this.baseURL}/sessions/${sessionId}/screen-share/start`);
            return response.data;
        } catch (error) {
            console.error('Error starting screen share:', error);
            throw error;
        }
    }

    /**
     * Stop screen sharing session
     */
    async stopScreenShare(sessionId: string) {
        try {
            const response = await apiClient.post(`${this.baseURL}/sessions/${sessionId}/screen-share/stop`);
            return response.data;
        } catch (error) {
            console.error('Error stopping screen share:', error);
            throw error;
        }
    }

    /**
     * Create communication channel
     */
    async createChannel(data: {
        channelName: string;
        channelType: 'text' | 'voice' | 'video' | 'screen_share';
        resourceId?: string;
        resourceType?: string;
        participants?: string[];
        channelConfig?: any;
    }) {
        try {
            const response = await apiClient.post(`${this.baseURL}/channels`, data);
            return response.data;
        } catch (error) {
            console.error('Error creating channel:', error);
            throw error;
        }
    }

    /**
     * Join communication channel
     */
    async joinChannel(channelId: string) {
        try {
            const response = await apiClient.post(`${this.baseURL}/channels/${channelId}/join`);
            return response.data;
        } catch (error) {
            console.error('Error joining channel:', error);
            throw error;
        }
    }

    /**
     * Leave communication channel
     */
    async leaveChannel(channelId: string) {
        try {
            const response = await apiClient.post(`${this.baseURL}/channels/${channelId}/leave`);
            return response.data;
        } catch (error) {
            console.error('Error leaving channel:', error);
            throw error;
        }
    }

    /**
     * Get active communication channels
     */
    async getChannels(resourceId?: string, resourceType?: string) {
        try {
            const response = await apiClient.get(`${this.baseURL}/channels`, {
                params: { resourceId, resourceType }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting channels:', error);
            throw error;
        }
    }

    /**
     * Send typing indicator
     */
    async sendTypingIndicator(data: {
        resourceId: string;
        resourceType: string;
        isTyping: boolean;
    }) {
        try {
            const response = await apiClient.post(`${this.baseURL}/typing`, data);
            return response.data;
        } catch (error) {
            console.error('Error sending typing indicator:', error);
            throw error;
        }
    }

    /**
     * Update cursor position
     */
    async updateCursor(data: {
        resourceId: string;
        resourceType: string;
        position: { x: number; y: number; line?: number; column?: number };
        selection?: { start: number; end: number };
    }) {
        try {
            const response = await apiClient.post(`${this.baseURL}/cursor`, data);
            return response.data;
        } catch (error) {
            console.error('Error updating cursor:', error);
            throw error;
        }
    }

    /**
     * Get collaboration analytics
     */
    async getAnalytics(resourceId?: string, resourceType?: string, timeframe = '7d') {
        try {
            const response = await apiClient.get(`${this.baseURL}/analytics`, {
                params: { resourceId, resourceType, timeframe }
            });
            return response.data;
        } catch (error) {
            console.error('Error getting analytics:', error);
            throw error;
        }
    }

    /**
     * Export collaboration history
     */
    async exportHistory(resourceId: string, resourceType: string, format = 'json') {
        try {
            const response = await apiClient.get(`${this.baseURL}/export/${resourceId}`, {
                params: { resourceType, format },
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            console.error('Error exporting history:', error);
            throw error;
        }
    }

    /**
     * Cleanup expired sessions and locks
     */
    async cleanup() {
        try {
            const response = await apiClient.post(`${this.baseURL}/cleanup`);
            return response.data;
        } catch (error) {
            console.error('Error during cleanup:', error);
            throw error;
        }
    }
}

// Create and export singleton instance
export const collaborationAPI = new CollaborationService();

// Export types for use in components
export type {
    CreateSessionRequest,
    AcquireLockRequest,
    ReleaseLockRequest,
    LogOperationRequest,
    AddCommentRequest,
    UpdatePresenceRequest
};
