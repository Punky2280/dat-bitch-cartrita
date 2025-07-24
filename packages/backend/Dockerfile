# Use an official Node.js runtime as a parent image
FROM node:22-alpine
# Set the working directory
WORKDIR /usr/src/app
# Copy all package manifests first.
# This allows Docker to cache the npm install layer.
# Using a wildcard handles cases where package-lock.json doesn't exist yet.
COPY package*.json ./
COPY packages/ ./packages/
# Install all monorepo dependencies
# Using --omit=dev to only install production dependencies
RUN npm install --omit=dev --workspaces
# Set the final working directory to the specific package we want to run
WORKDIR /usr/src/app/packages/backend
# Expose the port
EXPOSE 8000
# Run the application
CMD ["npm", "start"]
