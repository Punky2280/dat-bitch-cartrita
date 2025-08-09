## Development Environment

- Backend is already up on 8001 for backend and 3000 for directory
- PostgreSQL is running on ports 5432-5434

## Architecture Notes

### Agent System

- **CoreAgent Implementation**: The system uses `EnhancedCoreAgent` class, not `CoreAgent`
- **Location**: `/packages/backend/src/agi/consciousness/EnhancedCoreAgent.js`
- **Usage**: All imports referencing `CoreAgent` should use `EnhancedCoreAgent` instead
- **Entry Point**: Backend uses `index.js` as main entry point, not `app.js`

### Cartrita Iteration 21 Services

- **Speech-to-Text**: Deepgram integration with wake word detection
- **Voice Chat**: Live voice interaction with "Cartrita!" activation
- **Text-to-Speech**: OpenAI TTS with feminine urban personality
- **Visual Analysis**: OpenAI Vision API for scene understanding
- **Ambient Listening**: Environmental sound classification
- **Multi-Modal Fusion**: Cross-service sensory integration

### Service Architecture

- **Service Initializer**: `/packages/backend/src/services/ServiceInitializer.js`
- **Routes**:
  - Voice chat: `/api/voice-chat`
  - Vision: `/api/vision`
  - Voice-to-text: `/api/voice-to-text`
- **Dependencies**: OpenAI API key and Deepgram API key required for full functionality
