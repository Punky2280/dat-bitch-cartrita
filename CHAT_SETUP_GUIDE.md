# 💬 Cartrita Chat Functionality Setup Guide

This guide explains how to get the frontend and backend communicating properly for the chat dashboard feature.

## ✅ What Was Fixed

### 1. **API Communication Issues**
- **Fixed API Base URL**: Updated frontend to connect to Node.js backend on port 8001 (instead of Python backend on 8002)
- **Updated Docker Compose**: Corrected service names and port mappings
- **CORS Configuration**: Backend already has proper CORS setup for frontend communication

### 2. **Chat Component Improvements**
- **Real API Integration**: Replaced simulated responses with actual backend API calls
- **WebSocket Support**: Added real-time chat capabilities via Socket.IO
- **Error Handling**: Added proper error states and retry functionality
- **Loading States**: Added loading indicators and disabled states
- **Message Timestamps**: Added timestamp display for messages

### 3. **Enhanced UI/UX**
- **Connection Status**: Shows connection state to backend
- **Better Styling**: Improved chat bubble design and layout
- **Auto-scroll**: Messages auto-scroll to bottom
- **Keyboard Support**: Enter key sends messages

## 🏗️ Architecture Overview

```
Frontend (React/Next.js) ←→ Node.js Backend ←→ Python Backend
    Port 3000                  Port 8001         Port 8002
                                  ↓
                            Router Service
                            Chat History
                            WebSocket Support
```

## 🚀 How to Start the Chat System

### Option 1: Docker (Recommended)
```bash
# Start all services
docker-compose -f docker-compose.v2.yml up -d

# Check service status
docker-compose -f docker-compose.v2.yml ps

# View logs
docker-compose -f docker-compose.v2.yml logs -f
```

### Option 2: Development Mode
```bash
# Terminal 1: Start Node.js Backend
cd packages/cartrita-v2/backend
npm run dev

# Terminal 2: Start Python Backend  
cd py
python main.py

# Terminal 3: Start Frontend
cd packages/cartrita-v2/frontend
npm run dev
```

## 🧪 Testing Chat Functionality

### Automated Test
```bash
# Run the test script
./test-chat-functionality.sh
```

### Manual Testing
1. **Open Browser**: Navigate to `http://localhost:3000`
2. **Find Chat Component**: Look for the chat interface in your dashboard
3. **Test Connection**: You should see "🟢 Connected to Cartrita" 
4. **Send Message**: Type a message and press Enter
5. **Check Response**: Should get AI response from the backend

### API Endpoints for Testing
```bash
# Health checks
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:3000

# Chat router health
curl http://localhost:8001/api/router/health

# Test chat (requires auth token)
curl -X POST http://localhost:8001/api/router \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"task":"chat","prompt":"Hello!","options":{"model":"gpt-4o"}}'
```

## 🔧 Key Features Implemented

### Frontend (`useChat` Hook)
- ✅ Real-time WebSocket connection
- ✅ Message history persistence
- ✅ Conversation management
- ✅ Error handling and retry logic
- ✅ Loading states and typing indicators

### Backend API Routes
- ✅ `/api/router` - Main chat completion endpoint
- ✅ `/api/chatHistory` - Message history and conversations
- ✅ `/api/ai-hub` - AI service orchestration
- ✅ WebSocket support for real-time updates

### Chat Component Features
- ✅ Real-time messaging
- ✅ Connection status indicator
- ✅ Message timestamps
- ✅ Auto-scroll to new messages
- ✅ Loading animations
- ✅ Error handling with retry

## 🛠️ Configuration Files Updated

### Frontend Configuration
- `packages/cartrita-v2/frontend/.env` - API endpoints
- `packages/cartrita-v2/frontend/src/lib/api.ts` - API client
- `packages/cartrita-v2/frontend/src/hooks/useChat.ts` - Chat logic
- `packages/cartrita-v2/frontend/src/components/Chat.tsx` - UI component

### Docker Configuration
- `docker-compose.v2.yml` - Service orchestration and networking

## 🔍 Troubleshooting

### Chat Not Working?
1. **Check Services**: Run `./test-chat-functionality.sh`
2. **Check Logs**: `docker-compose -f docker-compose.v2.yml logs node-backend`
3. **Check Network**: Ensure ports 3000, 8001, 8002 are available
4. **Check Auth**: Make sure JWT authentication is working

### Common Issues
- **401 Unauthorized**: Need to implement user authentication first
- **CORS Errors**: Backend CORS should be configured, check browser console
- **WebSocket Failures**: Check if Socket.IO is properly initialized
- **API Errors**: Verify backend services are running and healthy

### Authentication Setup
The chat requires JWT authentication. You'll need to:
1. Set up user registration/login
2. Generate JWT tokens
3. Include tokens in API requests
4. Update the frontend to handle auth state

## 📁 File Structure

```
packages/cartrita-v2/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.tsx          # ✨ Updated - Real API integration
│   │   │   ├── ChatInput.tsx     # ✨ Updated - Enhanced props
│   │   │   └── Message.tsx       # ✨ Updated - Timestamp support
│   │   ├── hooks/
│   │   │   ├── useChat.ts        # 🆕 New - Chat logic & WebSocket
│   │   │   └── useWebSocket.ts   # Required for real-time
│   │   └── lib/
│   │       └── api.ts            # ✨ Updated - Correct port
│   └── .env                      # ✨ Updated - API endpoints
├── backend/
│   └── src/
│       ├── routes/
│       │   ├── router.js         # ✅ Chat completion endpoint
│       │   ├── chatHistory.js    # ✅ Message persistence
│       │   └── realtime.js       # ✅ WebSocket support
│       └── server.js             # ✅ CORS & routes configured
└── py/                          # ✅ Python backend for AI/ML
```

## 🎯 Next Steps

1. **Test the setup** using the provided test script
2. **Implement authentication** if not already done
3. **Customize chat UI** to match your design
4. **Add advanced features** like file uploads, typing indicators
5. **Monitor performance** and optimize as needed

The chat system is now properly configured for frontend-backend communication! 🚀