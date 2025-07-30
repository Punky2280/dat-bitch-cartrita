FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY packages/backend/package*.json ./

# Install dependencies
RUN npm install

# Copy source code and environment file
COPY packages/backend/ ./

# Expose port 8000
EXPOSE 8000

# Start the application
CMD ["node", "index.js"]
