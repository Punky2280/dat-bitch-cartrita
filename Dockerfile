FROM node:20-alpine

WORKDIR /usr/src/app

# Install git and other necessary packages
RUN apk add --no-cache git python3 make g++

# Copy package manifests for workspaces
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/

# Install dependencies without running prepare scripts (to avoid husky issues)
RUN npm install --workspaces=false --ignore-scripts

# Change to backend directory and install backend-specific dependencies
WORKDIR /usr/src/app/packages/backend
COPY packages/backend/package*.json ./
RUN npm install --ignore-scripts

# Copy the backend source code
COPY packages/backend/ ./

# Create necessary directories
RUN mkdir -p uploads logs

# Set environment to production
ENV NODE_ENV=production

EXPOSE 8000

CMD ["npm", "start"]