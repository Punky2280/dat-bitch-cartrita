# Environment Setup

This repository uses environment variables for configuration. 

## Setup Instructions

1. Copy the example environment files:
   ```bash
   cp .env.example .env
   cp packages/backend/.env.example packages/backend/.env
   ```

2. Edit the `.env` files and replace placeholder values with your actual credentials:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `DEEPGRAM_API_KEY`: Your Deepgram API key  
   - `POSTGRES_USER/POSTGRES_PASSWORD`: Your database credentials
   - `JWT_SECRET`: A secure random string for JWT signing
   - `ENCRYPTION_KEY`: A 64-character hex string for encryption

## Security Notes

- Never commit actual API keys or secrets to version control
- The `.env` files are excluded from git tracking
- Use `.env.example` files as templates for required environment variables