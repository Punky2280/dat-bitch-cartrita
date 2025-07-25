# Use an official Node.js runtime as a parent image
FROM node:22-alpine

# Set the working directory for the entire build
WORKDIR /usr/src/app

# Copy all package manifests first to leverage Docker cache
COPY package.json package-lock.json* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/robotics/package.json ./packages/robotics/

# Install all monorepo dependencies
RUN npm install --omit=dev --workspaces

# Copy the rest of the source code
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Define the command to run the specific backend workspace from the root
CMD ["npm", "run", "start:backend"]
