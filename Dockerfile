FROM node:22

WORKDIR /usr/src/app

# Update package index and install necessary packages
RUN apt-get update && apt-get install -y git python3 make g++ wget && rm -rf /var/lib/apt/lists/*

# Copy package manifests for workspaces
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/robotics/package*.json ./packages/robotics/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies at workspace level
RUN npm install --workspaces --ignore-scripts

# Copy all application source code
COPY . .

# Change to backend directory
WORKDIR /usr/src/app/packages/backend

# Create necessary directories
RUN mkdir -p uploads logs

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8001

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8001/health || exit 1

EXPOSE 8001

# Use the npm start script
CMD ["npm", "start"]