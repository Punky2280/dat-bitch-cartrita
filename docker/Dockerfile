# Multi-stage Docker build for Cartrita Multi-Agent OS
# Optimized for production deployment with security hardening

# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/

# Install dependencies
RUN npm ci --only=production && \
    cd packages/backend && npm ci --only=production && \
    cd ../frontend && npm ci --only=production

# Copy source code
COPY . .

# Build frontend
RUN cd packages/frontend && npm run build

# Build backend (if needed)
RUN cd packages/backend && npm run build || true

# Production stage
FROM node:20-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S cartrita && \
    adduser -S cartrita -u 1001

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    postgresql-client \
    redis

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=cartrita:cartrita /app/node_modules ./node_modules
COPY --from=builder --chown=cartrita:cartrita /app/packages/backend ./packages/backend
COPY --from=builder --chown=cartrita:cartrita /app/packages/frontend/dist ./packages/frontend/dist
COPY --from=builder --chown=cartrita:cartrita /app/package*.json ./
COPY --from=builder --chown=cartrita:cartrita /app/db-init ./db-init
COPY --from=builder --chown=cartrita:cartrita /app/config ./config

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs /app/temp && \
    chown -R cartrita:cartrita /app/uploads /app/logs /app/temp

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOADS_DIR=/app/uploads
ENV LOGS_DIR=/app/logs
ENV TEMP_DIR=/app/temp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:$PORT/api/health || exit 1

# Expose port
EXPOSE 3000

# Switch to non-root user
USER cartrita

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "packages/backend/src/index.js"]
