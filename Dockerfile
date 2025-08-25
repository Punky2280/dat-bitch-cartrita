FROM node:20-alpine

WORKDIR /usr/src/app

# Install git and other necessary packages
RUN apk add --no-cache git python3 make g++

# Copy package manifests
COPY package*.json ./

RUN npm install --ignore-scripts --legacy-peer-deps

# Copy the cartrita-v2 source code
COPY packages/cartrita-v2/ ./

# Create necessary directories
RUN mkdir -p uploads logs

# Set environment to production
ENV NODE_ENV=production

EXPOSE 8001

CMD ["npm", "start"]