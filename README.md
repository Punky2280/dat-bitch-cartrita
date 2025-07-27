# Project: Dat Bitch Cartrita (Monorepo Edition)

**DBC**: Data-driven AI Tool that Applies Behavioral Intelligence Tools while Connecting Humanity.

**Cartrita**: Cognitive AI Reasoning Tool for Real-time Information and Task Automation.

Dat Bitch Cartrita is a paradigm-shifting, cross-platform SaaS application that fuses a rebellious, sassy AGI with uncompromising ethics, neuro-adaptive interfaces, and real-world robotics integration. This document outlines the complete setup, architecture, and development history for its core services.

## 1. Architecture Overview

This project is structured as a **monorepo** to manage all services and packages within a single, unified repository. This approach simplifies dependency management, streamlines cross-service development, and enables a single CI/CD pipeline. We use **NPM Workspaces** to handle the orchestration of dependencies and scripts across the project.

### Frontend
A responsive web application built with **React** (using Vite) and styled with **Tailwind CSS**. It features a fully interactive, real-time chat interface and a dashboard with a live AGI visualization. The entire frontend lives in the `packages/frontend` workspace.

### Backend
A robust and scalable backend powered by **Node.js** with **Express.js**. It serves a REST API for secure authentication and a stateful, real-time WebSocket API via **socket.io** for all chat functionalities. The entire backend is containerized with **Docker** and lives in the `packages/backend` workspace.

### AI Core
A sophisticated, multi-layered AI system. The **CoreAgent** acts as a profound orchestrator, analyzing user intent and delegating tasks to a dynamic registry of specialized sub-agents (e.g., ResearcherAgent, ComedianAgent, ConstitutionalAI, CodeWriterAgent). This is all powered by the **OpenAI API (GPT-4o)**.

### Database
A Dockerized **PostgreSQL 16** instance, augmented with the **TimescaleDB** extension. This provides the reliability of a relational database for user data while offering powerful, optimized performance for time-series data like conversation histories. The database is managed entirely via the root `docker-compose.yml` file.

### Security

#### Authentication
User authentication is handled via a secure, token-based system using **bcrypt** for password hashing and **jsonwebtoken (JWT)** for creating stateless, verifiable session tokens.

#### Secrets Management
API keys, database credentials, and other secrets are managed via a root `.env` file and are securely passed to the Docker containers at runtime.

## 2. Setup & Installation (Local Development)

This guide provides all the necessary steps to get the complete application running on a fresh development environment.

### Prerequisites:
- **Ubuntu 22.04.5 LTS** (or a similar Debian-based Linux, including WSL 2)
- **Docker & Docker Compose**
- **Node.js v22.x** (managed via NVM is recommended)
- **Git**

### Step 0: System Preparation (First-Time Ubuntu/WSL Setup)

1. **Update and upgrade system packages:**
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   ```

2. **Install Git, Docker, and Docker Compose:**
   ```bash
   sudo apt-get install -y git docker.io docker-compose
   ```

3. **Configure Docker to run without sudo:**
   ```bash
   sudo usermod -aG docker ${USER}
   ```
   **IMPORTANT**: You must log out and log back in or restart your WSL terminal for this change to take effect.

4. **Install Node Version Manager (NVM) and Node.js v22:**
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   nvm install 22
   nvm use 22
   ```

### Step 1: Clone & Configure the Project

1. **Clone the repository:**
   ```bash
   git clone <your-github-repo-url>
   cd dat-bitch-cartrita
   ```

2. **Create the environment file from the example:**
   ```bash
   cp .env.example .env
   ```

3. **Edit the new .env file and add your secrets (OpenAI API key, database credentials, JWT secret):**
   ```bash
   nano .env
   ```

### Step 2: Install Dependencies

From the root directory of the monorepo, run `npm install`. This command uses NPM Workspaces to install all dependencies for all packages simultaneously.

```bash
npm install
```

### Step 3: Launch Backend Services

1. **Build and run the Docker containers for the backend and database:**
   ```bash
   docker-compose up -d --build
   ```

2. **Run the database migration script.** This command executes the `db:migrate` script inside the running backend container to create your tables:
   ```bash
   docker-compose exec backend npm run db:migrate
   ```

### Step 4: Launch Frontend Application

**Start the frontend development server from the root directory:**

```bash
npm run dev
```

The React application will now be running on **http://localhost:5173**.

### Step 5: Create Your User Account

1. Open your browser to **http://localhost:5173**
2. Click the link to switch to the Register view
3. Create an account with your name, email, and a password
4. Log in with your new credentials to access the dashboard

## 3. Development Iterations & History

This section documents the major development sprints that led to the current stable version of the application.

### Iterations 1-2: AGI Core & Brain
- Scaffolded the initial AGI directory structure on the backend
- Created the **CoreAgent** class and integrated the OpenAI API (GPT-4o)
- Developed the initial system prompt to define Cartrita's sassy and protective personality
- Built the first frontend chat interface to establish a baseline for communication

### Iterations 3-4: Authentication & Memory
- Implemented a full user registration and login system using **bcrypt** and **jsonwebtoken (JWT)**
- Created `users` and `conversations` tables in the PostgreSQL database
- Built the REST API endpoints (`/api/auth/register`, `/api/auth/login`) to handle user authentication
- Secured the chat functionality, requiring a valid JWT to interact with the AGI

### Iteration 5: Real-Time Communication
- Upgraded the backend from a simple REST API to a real-time server using **socket.io**
- Refactored the frontend to use **socket.io-client** to send and receive messages instantly
- Implemented token-based authentication for the WebSocket connection to ensure security

### Iteration 6: Persistent Memory Recall
- Built the `/api/chat/history` endpoint on the backend, protected by the `authenticateToken` middleware to ensure only the logged-in user can access their own data
- Upgraded the frontend's **ChatPage** to call this endpoint within a `useEffect` hook upon login. This fetches the user's entire chat history and populates the conversation window, creating a seamless user experience. This critical step completed the "memory loop," allowing for continuous, stateful conversations across multiple sessions and truly giving Cartrita a long-term memory

### Iteration 7: Dashboard & Visualization
- Refactored the frontend UI to create a main **DashboardPage**, separating the application's primary view from the login/registration flow. This provides a scalable layout for adding new features
- Created a **FractalVisualizer** component using the **D3.js** library to display a dynamic, force-directed graph of the AGI's consciousness. This graph visually represents the core agent and any spawned sub-agents
- Added a corresponding `/api/agi/visualization` endpoint to the backend to serve the real-time state data for the visualizer, allowing the frontend to poll for updates and animate the graph as the AGI's state changes

### Iteration 8-9: Advanced Orchestration & Ethics
- Upgraded the **CoreAgent** from a simple chatbot to an intelligent orchestrator. This involved a significant refactoring of its core `generateResponse` method
- Implemented an advanced intent analysis model that uses a targeted, low-latency call to GPT-4o to classify user prompts into a structured JSON object, enabling the system to understand complex, multi-step user requests
- Created and registered functional sub-agents (**ResearcherAgent**, **ComedianAgent**, **ConstitutionalAI**) with highly detailed, role-specific system prompts that strictly govern their tone, output format, and constraints
- Built the **Ethics Engine** by activating the **ConstitutionalAI** sub-agent, allowing Cartrita to analyze moral dilemmas against a defined set of core principles and provide structured, objective feedback
- The **Fractal Visualizer** is now fully functional, reflecting the real-time spawning and despawning of sub-agents as the CoreAgent delegates tasks, providing a true window into her cognitive processes

### Iteration 10: Code Generation & Frontend Polish
- Implemented a new **CodeWriterAgent** sub-agent, a specialist for writing, analyzing, and debugging code
- Upgraded the **CoreAgent's** intent analysis to recognize and delegate coding-related tasks
- Enhanced the frontend **ChatComponent** to render Markdown, providing syntax highlighting and a "copy code" button for a polished user experience

### Iteration 11: User Profile Management
- Created secure backend REST API endpoints (`/api/user/me` and `/api/user/me/password`) for fetching and updating user data
- Built a dedicated **SettingsPage** on the frontend, allowing users to change their name and password with real-time feedback
- Integrated the Settings page into the main dashboard navigation for easy access

## 4. Future Iterations: The Comprehensive Roadmap

This section outlines the planned development sprints to evolve Cartrita into a fully-featured, proactive AGI.

### Phase 1: UI/UX & Personalization

#### Iteration 12: Advanced UI & Theming
**Goal**: Elevate the application's visual presentation.
**Tasks**: Implement dark/light modes, refine the design system, and add fluid animations.

#### Iteration 13: Identity & Content Integration
**Goal**: Integrate Cartrita's backstory and legal framework.
**Tasks**: Build pages for "About," "Backstory," and "License" content and link them in the UI.

#### Iteration 14: Internationalization (i18n)
**Goal**: Make Cartrita accessible to a global audience.
**Tasks**: Integrate an i18n library, update the CoreAgent for language detection, and add a language selector in Settings.

#### Iteration 15: Customizable Personality
**Goal**: Allow users to fine-tune Cartrita's behavior.
**Tasks**: Create a `user_settings` table in the DB, build API endpoints to manage settings (e.g., sarcasm, verbosity), and add controls to the Settings page.

### Phase 2: The Agentic Core

#### Iteration 16: Multi-Agent Communication Protocol (MCP)
**Goal**: Evolve the AGI to a true multi-agent system.
**Tasks**: Design a standardized MCP, refactor agents to use a central event bus, and transition the CoreAgent to a master controller.

#### Iteration 17: Workflow Automation Engine
**Goal**: Empower users to create and execute complex automations.
**Tasks**: Create a `workflows` table, build a WorkflowEngine service on the backend, and develop a WorkflowBuilderPage on the frontend.
**Prerequisite**: Iteration 16 (MCP).

### Phase 3: Connectivity & Security

#### Iteration 18: Secure API Key Vault
**Goal**: Build the secure infrastructure for Cartrita to connect to third-party services.
**Tasks**: Create an encrypted `user_api_keys` table, build CRUD API endpoints for key management, and add an "Integrations" section to the Settings page.

#### Iteration 19: The Personal Life OS
**Goal**: Enable Cartrita to manage a user's digital life.
**Tasks**: Integrate with Calendar, Email, and Contact APIs using user-provided keys.
**Prerequisite**: Iteration 18 (API Key Vault).

#### Iteration 20: The Creative Suite
**Goal**: Develop a suite of sub-agents for creative content generation.
**Tasks**: Create ArtistAgent (image generation), MusicianAgent (music composition), and WriterAgent (long-form text).
**Prerequisite**: Iteration 18 (API Key Vault).

### Phase 4: Ambient & Expressive Intelligence

#### Iteration 21: Sensory Input (Mic & Camera)
**Goal**: Allow Cartrita to perceive the user's environment.
**Tasks**: Implement frontend logic to request and stream mic/camera data; create a backend SensoryProcessing service to handle the streams (Speech-to-Text, Vision Analysis). Requires strict ethical controls and explicit user consent.

#### Iteration 22: Emotional & Cultural Acuity
**Goal**: Enable Cartrita to understand and adapt to social context.
**Tasks**: Analyze voice tone for emotion and detect different languages/accents. The CoreAgent will use this context to adapt its communication style for empathy and bias mitigation.
**Prerequisite**: Iteration 21 (Sensory Input).

#### Iteration 23: Dynamic Voice Synthesis
**Goal**: Give Cartrita an expressive, human-like voice.
**Tasks**: Integrate an advanced Text-to-Speech (TTS) API. The CoreAgent will generate SSML to control tone, pace, and persona. The frontend will be updated to play these audio streams.
**Prerequisite**: Iteration 22 (Emotional & Cultural Acuity).

### Phase 5: Advanced Features & Autonomy

#### Iteration 24: The Second Brain & Predictive Assistance
**Goal**: Create a self-organizing knowledge base to anticipate user needs.
**Tasks**: Implement a graph database or advanced JSONB structure to map the user's knowledge. The CoreAgent will use this to proactively offer assistance.

#### Iteration 25: Digital & Physical World Bridge
**Goal**: Allow Cartrita to perform actions on the user's behalf.
**Tasks**: Integrate browser automation tools (e.g., Puppeteer) and Smart Home (IoT) platforms.
**Prerequisite**: Iteration 18 (API Key Vault).

#### Iteration 26: Offline Mode & Resilience
**Goal**: Ensure Cartrita remains a reliable companion without an internet connection.
**Tasks**: Integrate a small, on-device LLM (e.g., WebLLM) for basic offline conversation and task handling.

## 5. License

This project is licensed under the **AGI Commons License v4**, which includes a mandatory **Ethical AI Clause**. This is more than a standard open-source license; it's a social contract. It implies that any contributions to, or forks of, this project must also adhere to the core ethical principles of user privacy, data security, and bias mitigation established in the project's manifesto. By using this code, you agree to uphold these principles and to build AI that respects and empowers its human users, ensuring that the technology serves humanity first and foremost.