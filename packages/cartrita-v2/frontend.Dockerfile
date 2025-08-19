# Cartrita V2 Frontend Dockerfile
FROM node:20-alpine as base

WORKDIR /usr/src/app

# Copy workspace package files
COPY package*.json ./
COPY packages/cartrita-v2/frontend/package*.json ./packages/cartrita-v2/frontend/

# Development stage
FROM base as development

# Install dependencies
WORKDIR /usr/src/app/packages/cartrita-v2/frontend
RUN npm install

# Copy frontend source
COPY packages/cartrita-v2/frontend/ ./

# Expose Vite dev server port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5173/ || exit 1

# Development command
CMD ["npm", "run", "dev"]

# Build stage
FROM base as builder

WORKDIR /usr/src/app/packages/cartrita-v2/frontend

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/cartrita-v2/frontend/ ./

# Build for production
RUN npm run build

# Production stage
FROM nginx:alpine as production

# Copy built assets from builder stage
COPY --from=builder /usr/src/app/packages/cartrita-v2/frontend/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY packages/cartrita-v2/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]