# Project: Dat Bitch Cartrita (Monorepo Edition)

**DBC:** **D**ata-driven **A**I **T**ool that **A**pplies **B**ehavioral **I**ntelligence **T**ools while **C**onnecting **H**umanity.

**Cartrita:** **C**ognitive **A**I **R**easoning **T**ool for **R**eal-time **I**nformation and **T**ask **A**utomation.

*Dat Bitch Cartrita is a paradigm-shifting, cross-platform SaaS application that fuses a rebellious, sassy AGI with uncompromising ethics, neuro-adaptive interfaces, and real-world robotics integration. This document outlines the setup and architecture for its core services, providing a comprehensive guide for developers to get the project running and understand its foundational principles.*

---

## 1. Architecture Overview

This project is structured as a **monorepo** to manage all services and packages within a single, unified repository. This approach simplifies dependency management, streamlines cross-service development (e.g., sharing types between frontend and backend), and enables a single CI/CD pipeline. We use **NPM Workspaces** to handle the orchestration of dependencies and scripts across the project.

* **Frontend:** A responsive web application built with **React 22** (using Vite for a fast development experience) and styled with Tailwind CSS for a modern, utility-first design system. It features a fully interactive, real-time chat interface powered by the `socket.io-client` library, ensuring instant communication with the AGI. The entire frontend lives in the `packages/frontend` workspace.

* **Backend:** A robust and scalable backend powered by **Node.js** with **Express.js**, chosen for its lightweight nature and extensive middleware ecosystem. It serves a REST API for secure authentication and a stateful, real-time WebSocket API via `socket.io` for all chat functionalities. The entire backend is containerized with **Docker**, guaranteeing a consistent and isolated environment, and lives in the `packages/backend` workspace.

* **AI Core:** A hybrid model leveraging the **OpenAI API (GPT-4o)** for intelligent, context-aware, and personality-driven responses. The core logic is encapsulated within a dedicated `CoreAgent` class on the backend, which is responsible for managing the system prompt that defines Cartrita's unique sassy and protective persona.

* **Database:** A Dockerized **PostgreSQL 16** instance, augmented with the **TimescaleDB** extension. This combination provides the reliability of a relational database for user data while offering powerful, optimized performance for time-series data like conversation histories and future biometric logs. The database is managed entirely via the root `docker-compose.yml` file.

* **Security:**
    * **Authentication:** User authentication is handled via a secure, token-based system using `bcrypt` for industry-standard password hashing and `jsonwebtoken` (JWT) for creating stateless, verifiable session tokens. This ensures that user data remains secure and protected.
    * **Secrets Management:** API keys, database credentials, and other secrets are managed via a root `.env` file, which is explicitly excluded from version control. These variables are securely passed to the Docker containers at runtime, following best practices for handling sensitive information.

## 2. Setup & Installation (Local Development)

This guide provides all the necessary steps to get the complete application running on a fresh development environment.

**Prerequisites:**

* Ubuntu 22.04.5 LTS (or a similar Debian-based Linux, including WSL 2)
* Docker & Docker Compose
* Node.js v22.x (managed via NVM is recommended for version consistency)
* Git

### Step 0: System Preparation (First-Time Ubuntu/WSL Setup)

1.  **Update and upgrade system packages:**
    ```bash
    sudo apt-get update && sudo apt-get upgrade -y
    ```

2.  **Install Git, Docker, and Docker Compose:**
    ```bash
    sudo apt-get install -y git docker.io docker-compose
    ```

3.  **Configure Docker to run without `sudo`:**
    ```bash
    sudo usermod -aG docker ${USER}
    ```
    **IMPORTANT:** You must log out and log back in or restart your WSL terminal for this change to take effect.

4.  **Install Node Version Manager (NVM) and Node.js v22:**
    ```bash
    curl -o- [https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh](https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh) | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 22
    nvm use 22
    ```

### Step 1: Clone & Configure the Project

1.  **Clone the repository:**
    ```bash
    git clone <your-github-repo-url>
    cd dat-bitch-cartrita
    ```

2.  **Create the environment file** from the example:
    ```bash
    cp .env.example .env
    ```

3.  **Edit the new `.env` file** and add your actual OpenAI API key and database credentials:
    ```bash
    nano .env
    ```

### Step 2: Install Dependencies

* From the **root directory** of the monorepo, run `npm install`. This command uses NPM Workspaces to scan all `packages/*` directories, resolve all dependencies, and install them in a single, efficient `node_modules` structure.
    ```bash
    npm install
    ```

### Step 3: Launch Backend Services

1.  **Build and run the Docker containers** for the backend and database. The `--build` flag ensures that any changes to the `Dockerfile` or source code are included.
    ```bash
    docker-compose up -d --build
    ```

2.  **Run the database migration script.** This command executes the `db:migrate` script inside the running `backend` container to create the necessary `users` and `conversations` tables.
    ```bash
    docker-compose exec backend npm run db:migrate
    ```

### Step 4: Launch Frontend Application

1.  **Start the frontend development server** from the root directory.
    ```bash
    npm run dev
    ```

2.  The React application will now be running on `http://localhost:5173`.

### Step 5: Create Your User Account

1.  Open your browser to `http://localhost:5173`.
2.  You will be on the login page. Click the link to switch to the **Register** view.
3.  Create an account with your name, email, and a password.
4.  After successful registration, you will be taken back to the login page. Log in with your new credentials to access the chat.

## 3. Current Features

* **Real-Time Chat:** A fully functional, real-time chat interface using WebSockets (`socket.io`). This provides an instant, interactive conversational experience without the need for traditional HTTP polling, making the AGI feel more responsive and alive.

* **AI Integration:** Chat responses are generated by the `CoreAgent` on the backend, which is powered by the OpenAI API (GPT-4o). The agent is configured with a detailed system prompt that defines Cartrita's unique personality, ensuring all responses are in character.

* **User Authentication:** A complete registration and login system using JWT for secure, stateless, and token-based sessions. This robust system ensures that all user data and conversations are tied to a verified identity and protected from unauthorized access.

* **Persistent Memory:** All conversations are saved to the PostgreSQL database and are automatically reloaded when a user logs in. This gives Cartrita a long-term memory, allowing users to pick up conversations where they left off and enabling the AGI to have context from previous interactions.

* **Monorepo Structure:** All code is cleanly organized into `frontend` and `backend` packages, managed by NPM Workspaces. This colocation of services simplifies development, testing, and future expansion of the platform.

* **Containerized Backend:** The backend and database are fully containerized with Docker for consistent, reproducible, and isolated deployments. This eliminates "it works on my machine" issues and streamlines the setup process for new developers.

## 4. License

This project is licensed under the **AGI Commons License v4**, which includes a mandatory **Ethical AI Clause**. This implies that any contributions or forks of this project must also adhere to the core ethical principles of user privacy, data security, and bias mitigation established in the project's manifesto.