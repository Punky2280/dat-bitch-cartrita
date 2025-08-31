# Development-friendly Docker build for Next.js frontend
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Development image for hot reloading
FROM base AS development
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create user first
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Set environment variables for development
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV development
ENV TURBOPACK 1

# Copy source code and ensure proper permissions
COPY --chown=nextjs:nodejs . .

# Create .next directory with proper permissions
RUN mkdir -p .next && chown -R nextjs:nodejs .next
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next/cache
RUN mkdir -p .next/static && chown -R nextjs:nodejs .next/static

# Ensure all files are owned by nextjs user
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Default command - will be overridden by docker-compose
CMD ["npm", "run", "dev"]