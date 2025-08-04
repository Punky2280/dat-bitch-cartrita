FROM node:20-alpine

WORKDIR /usr/src/app

# Copy .npmrc first to handle peer dependencies
COPY .npmrc ./

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/
COPY packages/robotics/package*.json ./packages/robotics/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies with legacy peer deps
RUN npm install --workspaces

# Install the missing langchain community package specifically
RUN npm install @langchain/community --workspace=backend

# Copy source code
COPY . .

# Create directories
RUN mkdir -p uploads logs

EXPOSE 8000

CMD ["npm", "run", "start:backend"]
