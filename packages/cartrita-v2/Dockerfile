# Cartrita V2 Backend Dockerfile
FROM node:20-alpine as base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git

WORKDIR /usr/src/app

# Copy workspace configuration
COPY package*.json ./
COPY packages/cartrita-v2/package*.json ./packages/cartrita-v2/

# Development stage
FROM base as development

# Install all dependencies for development
RUN npm install --include=dev

# Copy V2 source code
COPY packages/cartrita-v2/ ./packages/cartrita-v2/

# Set working directory to V2
WORKDIR /usr/src/app/packages/cartrita-v2

# Expose V2 port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Development command
CMD ["npm", "run", "dev"]

# Production stage
FROM base as production

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy V2 source code
COPY packages/cartrita-v2/ ./packages/cartrita-v2/

# Set working directory to V2
WORKDIR /usr/src/app/packages/cartrita-v2

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cartrita -u 1001

# Create necessary directories and set permissions
RUN mkdir -p uploads logs && \
    chown -R cartrita:nodejs . && \
    chmod -R 755 .

USER cartrita

# Expose V2 port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Production command
CMD ["npm", "start"]