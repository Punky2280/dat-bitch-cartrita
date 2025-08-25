FROM node:22-alpine

# Install system dependencies needed for native packages
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm install --production --legacy-peer-deps

# Copy all application files
COPY . .

# Expose port
EXPOSE 8001

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8001/health || exit 1

# Use the npm start script
CMD ["npm", "start"]
