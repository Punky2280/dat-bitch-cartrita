# packages/backend/Dockerfile
FROM node:22-alpine
WORKDIR /usr/src/app
COPY package*.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/robotics/package.json ./packages/robotics/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --omit=dev --workspaces
COPY . .
WORKDIR /usr/src/app/packages/backend
CMD ["node", "index.js"]
