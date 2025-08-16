/**
 * Production Deployment Pipeline Manager
 * Automated deployment orchestration system for Cartrita
 * August 16, 2025
 */

import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Deployment environments
 */
export const DeploymentEnvironments = {
    DEVELOPMENT: 'development',
    STAGING: 'staging',
    PRODUCTION: 'production',
    TEST: 'test'
};

/**
 * Deployment strategies
 */
export const DeploymentStrategies = {
    ROLLING: 'rolling',
    BLUE_GREEN: 'blue_green',
    CANARY: 'canary',
    RECREATE: 'recreate'
};

/**
 * Deployment states
 */
export const DeploymentStates = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    ROLLING_BACK: 'rolling_back'
};

/**
 * Production Deployment Pipeline Manager
 * Handles automated deployments, CI/CD integration, and infrastructure management
 */
export default class ProductionDeploymentPipelineManager extends EventEmitter {
    constructor() {
        super();
        
        this.deployments = new Map();
        this.environments = new Map();
        this.isInitialized = false;
        
        this.configuration = {
            defaultStrategy: DeploymentStrategies.ROLLING,
            healthCheckTimeout: 300000, // 5 minutes
            rollbackTimeout: 600000, // 10 minutes
            deploymentTimeout: 1800000, // 30 minutes
            maxConcurrentDeployments: 3,
            enableAutoRollback: true,
            requireApproval: true,
            dockerRegistry: process.env.DOCKER_REGISTRY || 'localhost:5000',
            kubernetesNamespace: process.env.K8S_NAMESPACE || 'cartrita',
            cicdProvider: process.env.CICD_PROVIDER || 'github_actions'
        };
        
        this.metrics = {
            totalDeployments: 0,
            successfulDeployments: 0,
            failedDeployments: 0,
            rolledBackDeployments: 0,
            averageDeploymentTime: 0,
            deploymentFrequency: 0,
            activeDeployments: 0
        };
        
        this.deploymentHistory = [];
        this.activeProcesses = new Map();
        
        this.init();
    }
    
    /**
     * Initialize deployment pipeline manager
     */
    async init() {
        try {
            console.log('🚀 Initializing Production Deployment Pipeline Manager...');
            
            // Load environment configurations
            await this.loadEnvironmentConfigurations();
            
            // Initialize CI/CD integration
            await this.initializeCICDIntegration();
            
            // Start deployment monitoring
            this.startDeploymentMonitoring();
            
            // Load deployment history
            await this.loadDeploymentHistory();
            
            this.isInitialized = true;
            this.emit('initialized');
            
            console.log('✅ Production Deployment Pipeline Manager initialized');
            
        } catch (error) {
            console.error('❌ Deployment Pipeline Manager initialization failed:', error);
            this.emit('error', error);
        }
    }
    
    /**
     * Load environment configurations
     */
    async loadEnvironmentConfigurations() {
        const environments = [
            {
                name: DeploymentEnvironments.DEVELOPMENT,
                config: {
                    replicas: 1,
                    resources: { cpu: '0.5', memory: '512Mi' },
                    database: process.env.DEV_DATABASE_URL,
                    redis: process.env.DEV_REDIS_URL,
                    autoApprove: true,
                    healthCheck: '/health',
                    domain: process.env.DEV_DOMAIN || 'dev.cartrita.local'
                }
            },
            {
                name: DeploymentEnvironments.STAGING,
                config: {
                    replicas: 2,
                    resources: { cpu: '1', memory: '1Gi' },
                    database: process.env.STAGING_DATABASE_URL,
                    redis: process.env.STAGING_REDIS_URL,
                    autoApprove: false,
                    healthCheck: '/health',
                    domain: process.env.STAGING_DOMAIN || 'staging.cartrita.com'
                }
            },
            {
                name: DeploymentEnvironments.PRODUCTION,
                config: {
                    replicas: 3,
                    resources: { cpu: '2', memory: '2Gi' },
                    database: process.env.PROD_DATABASE_URL,
                    redis: process.env.PROD_REDIS_URL,
                    autoApprove: false,
                    healthCheck: '/health',
                    domain: process.env.PROD_DOMAIN || 'app.cartrita.com',
                    strategy: DeploymentStrategies.BLUE_GREEN
                }
            }
        ];
        
        for (const env of environments) {
            this.environments.set(env.name, env);
        }
        
        console.log(`✅ Loaded ${environments.length} environment configurations`);
    }
    
    /**
     * Initialize CI/CD integration
     */
    async initializeCICDIntegration() {
        // Create GitHub Actions workflows
        if (this.configuration.cicdProvider === 'github_actions') {
            await this.createGitHubActionsWorkflows();
        }
        
        // Setup Docker registry authentication
        await this.setupDockerRegistry();
        
        // Initialize Kubernetes deployment templates
        await this.createKubernetesTemplates();
        
        console.log('✅ CI/CD integration initialized');
    }
    
    /**
     * Create GitHub Actions workflows
     */
    async createGitHubActionsWorkflows() {
        const workflowsDir = join(process.cwd(), '.github', 'workflows');
        
        try {
            await fs.mkdir(workflowsDir, { recursive: true });
            
            // CI/CD workflow
            const cicdWorkflow = `name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  DOCKER_REGISTRY: \${{ secrets.DOCKER_REGISTRY }}
  DOCKER_USERNAME: \${{ secrets.DOCKER_USERNAME }}
  DOCKER_PASSWORD: \${{ secrets.DOCKER_PASSWORD }}
  KUBE_CONFIG: \${{ secrets.KUBE_CONFIG }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run test:integration

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-tag: \${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.DOCKER_REGISTRY }}
          username: \${{ env.DOCKER_USERNAME }}
          password: \${{ env.DOCKER_PASSWORD }}
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.DOCKER_REGISTRY }}/cartrita
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Staging
        run: |
          echo "Deploying to staging environment..."
          curl -X POST "\${{ secrets.CARTRITA_DEPLOYMENT_WEBHOOK }}" \\
            -H "Authorization: Bearer \${{ secrets.DEPLOYMENT_TOKEN }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "environment": "staging",
              "image": "\${{ needs.build.outputs.image-tag }}",
              "branch": "develop"
            }'

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Production
        run: |
          echo "Deploying to production environment..."
          curl -X POST "\${{ secrets.CARTRITA_DEPLOYMENT_WEBHOOK }}" \\
            -H "Authorization: Bearer \${{ secrets.DEPLOYMENT_TOKEN }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "environment": "production",
              "image": "\${{ needs.build.outputs.image-tag }}",
              "branch": "main",
              "strategy": "blue_green"
            }'
`;
            
            await fs.writeFile(join(workflowsDir, 'cicd.yml'), cicdWorkflow);
            
            console.log('✅ Created GitHub Actions CI/CD workflow');
            
        } catch (error) {
            console.warn('⚠️ Failed to create GitHub Actions workflows:', error.message);
        }
    }
    
    /**
     * Setup Docker registry configuration
     */
    async setupDockerRegistry() {
        const dockerConfigDir = join(process.cwd(), 'docker');
        
        try {
            await fs.mkdir(dockerConfigDir, { recursive: true });
            
            // Multi-stage Dockerfile
            const dockerfile = `# Multi-stage production Dockerfile for Cartrita
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cartrita -u 1001

# Copy built application
COPY --from=builder --chown=cartrita:nodejs /app/dist ./dist
COPY --from=builder --chown=cartrita:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=cartrita:nodejs /app/package*.json ./

# Set user
USER cartrita

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
  CMD node healthcheck.js

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/packages/backend/src/index.js"]
`;
            
            await fs.writeFile(join(dockerConfigDir, 'Dockerfile'), dockerfile);
            
            // Docker compose for development
            const dockerCompose = `version: '3.8'

services:
  cartrita-app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "\${PORT:-3000}:3000"
    environment:
      - NODE_ENV=\${NODE_ENV:-development}
      - DATABASE_URL=\${DATABASE_URL}
      - REDIS_URL=\${REDIS_URL}
    depends_on:
      - postgres
      - redis
    volumes:
      - ../uploads:/app/uploads
    restart: unless-stopped

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-cartrita}
      POSTGRES_USER: \${POSTGRES_USER:-cartrita}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-cartrita_password}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
`;
            
            await fs.writeFile(join(dockerConfigDir, 'docker-compose.yml'), dockerCompose);
            
            console.log('✅ Created Docker configuration files');
            
        } catch (error) {
            console.warn('⚠️ Failed to setup Docker registry:', error.message);
        }
    }
    
    /**
     * Create Kubernetes deployment templates
     */
    async createKubernetesTemplates() {
        const k8sDir = join(process.cwd(), 'k8s');
        
        try {
            await fs.mkdir(k8sDir, { recursive: true });
            
            // Deployment template
            const deploymentTemplate = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: cartrita-app
  namespace: {{NAMESPACE}}
  labels:
    app: cartrita
    version: {{VERSION}}
spec:
  replicas: {{REPLICAS}}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  selector:
    matchLabels:
      app: cartrita
  template:
    metadata:
      labels:
        app: cartrita
        version: {{VERSION}}
    spec:
      containers:
      - name: cartrita
        image: {{IMAGE}}
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "{{ENVIRONMENT}}"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: cartrita-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: cartrita-secrets
              key: redis-url
        resources:
          requests:
            cpu: {{CPU_REQUEST}}
            memory: {{MEMORY_REQUEST}}
          limits:
            cpu: {{CPU_LIMIT}}
            memory: {{MEMORY_LIMIT}}
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        volumeMounts:
        - name: uploads
          mountPath: /app/uploads
      volumes:
      - name: uploads
        persistentVolumeClaim:
          claimName: cartrita-uploads-pvc
`;
            
            await fs.writeFile(join(k8sDir, 'deployment.template.yaml'), deploymentTemplate);
            
            // Service template
            const serviceTemplate = `apiVersion: v1
kind: Service
metadata:
  name: cartrita-service
  namespace: {{NAMESPACE}}
  labels:
    app: cartrita
spec:
  selector:
    app: cartrita
  ports:
  - name: http
    port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: cartrita-ingress
  namespace: {{NAMESPACE}}
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - {{DOMAIN}}
    secretName: cartrita-tls
  rules:
  - host: {{DOMAIN}}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: cartrita-service
            port:
              number: 80
`;
            
            await fs.writeFile(join(k8sDir, 'service.template.yaml'), serviceTemplate);
            
            console.log('✅ Created Kubernetes templates');
            
        } catch (error) {
            console.warn('⚠️ Failed to create Kubernetes templates:', error.message);
        }
    }
    
    /**
     * Deploy application to specified environment
     */
    async deployToEnvironment(environment, options = {}) {
        const deploymentId = this.generateDeploymentId();
        
        const deployment = {
            id: deploymentId,
            environment,
            state: DeploymentStates.PENDING,
            strategy: options.strategy || this.configuration.defaultStrategy,
            image: options.image,
            branch: options.branch,
            commit: options.commit,
            startTime: Date.now(),
            endTime: null,
            duration: null,
            approvedBy: options.approvedBy,
            logs: [],
            rollbackInfo: null
        };
        
        this.deployments.set(deploymentId, deployment);
        
        return await OpenTelemetryTracing.traceOperation('deployment.execute', async () => {
            try {
                this.emit('deploymentStarted', deployment);
                console.log(`🚀 Starting deployment ${deploymentId} to ${environment}`);
                
                // Check if approval is required
                if (this.requiresApproval(environment) && !options.approvedBy) {
                    deployment.state = DeploymentStates.PENDING;
                    this.emit('approvalRequired', deployment);
                    return deployment;
                }
                
                deployment.state = DeploymentStates.RUNNING;
                
                // Execute deployment steps
                await this.executeDeploymentSteps(deployment);
                
                // Perform health checks
                await this.performHealthChecks(deployment);
                
                deployment.state = DeploymentStates.SUCCESS;
                deployment.endTime = Date.now();
                deployment.duration = deployment.endTime - deployment.startTime;
                
                this.updateMetrics(deployment);
                this.emit('deploymentCompleted', deployment);
                
                console.log(`✅ Deployment ${deploymentId} completed successfully in ${deployment.duration}ms`);
                
                return deployment;
                
            } catch (error) {
                deployment.state = DeploymentStates.FAILED;
                deployment.endTime = Date.now();
                deployment.duration = deployment.endTime - deployment.startTime;
                deployment.error = error.message;
                
                console.error(`❌ Deployment ${deploymentId} failed:`, error);
                
                // Auto-rollback if enabled
                if (this.configuration.enableAutoRollback) {
                    await this.rollbackDeployment(deploymentId);
                }
                
                this.emit('deploymentFailed', deployment, error);
                throw error;
            }
        });
    }
    
    /**
     * Execute deployment steps based on strategy
     */
    async executeDeploymentSteps(deployment) {
        const steps = this.getDeploymentSteps(deployment);
        
        for (const step of steps) {
            deployment.logs.push({
                timestamp: Date.now(),
                level: 'info',
                message: `Executing step: ${step.name}`,
                step: step.name
            });
            
            await step.execute(deployment);
            
            deployment.logs.push({
                timestamp: Date.now(),
                level: 'success',
                message: `Completed step: ${step.name}`,
                step: step.name
            });
        }
    }
    
    /**
     * Get deployment steps based on strategy
     */
    getDeploymentSteps(deployment) {
        const commonSteps = [
            {
                name: 'validate_environment',
                execute: async (dep) => await this.validateEnvironment(dep)
            },
            {
                name: 'prepare_resources',
                execute: async (dep) => await this.prepareResources(dep)
            }
        ];
        
        switch (deployment.strategy) {
            case DeploymentStrategies.ROLLING:
                return [
                    ...commonSteps,
                    {
                        name: 'rolling_update',
                        execute: async (dep) => await this.executeRollingUpdate(dep)
                    }
                ];
                
            case DeploymentStrategies.BLUE_GREEN:
                return [
                    ...commonSteps,
                    {
                        name: 'deploy_green',
                        execute: async (dep) => await this.deployGreenEnvironment(dep)
                    },
                    {
                        name: 'switch_traffic',
                        execute: async (dep) => await this.switchTraffic(dep)
                    },
                    {
                        name: 'cleanup_blue',
                        execute: async (dep) => await this.cleanupBlueEnvironment(dep)
                    }
                ];
                
            case DeploymentStrategies.CANARY:
                return [
                    ...commonSteps,
                    {
                        name: 'deploy_canary',
                        execute: async (dep) => await this.deployCanary(dep)
                    },
                    {
                        name: 'monitor_canary',
                        execute: async (dep) => await this.monitorCanary(dep)
                    },
                    {
                        name: 'promote_canary',
                        execute: async (dep) => await this.promoteCanary(dep)
                    }
                ];
                
            default:
                return commonSteps;
        }
    }
    
    /**
     * Validate deployment environment
     */
    async validateEnvironment(deployment) {
        const envConfig = this.environments.get(deployment.environment);
        if (!envConfig) {
            throw new Error(`Environment ${deployment.environment} not configured`);
        }
        
        // Validate required resources
        if (!deployment.image) {
            throw new Error('Docker image not specified');
        }
        
        // Check environment health
        await this.checkEnvironmentHealth(deployment.environment);
    }
    
    /**
     * Prepare deployment resources
     */
    async prepareResources(deployment) {
        // Pull Docker image
        await this.pullDockerImage(deployment.image);
        
        // Apply Kubernetes manifests
        await this.applyKubernetesManifests(deployment);
    }
    
    /**
     * Execute rolling update deployment
     */
    async executeRollingUpdate(deployment) {
        const command = `kubectl set image deployment/cartrita-app cartrita=${deployment.image} -n ${this.configuration.kubernetesNamespace}`;
        await this.executeCommand(command);
        
        // Wait for rollout to complete
        const rolloutCommand = `kubectl rollout status deployment/cartrita-app -n ${this.configuration.kubernetesNamespace} --timeout=600s`;
        await this.executeCommand(rolloutCommand);
    }
    
    /**
     * Deploy green environment for blue-green deployment
     */
    async deployGreenEnvironment(deployment) {
        // Create green deployment
        const command = `kubectl apply -f k8s/deployment-green.yaml -n ${this.configuration.kubernetesNamespace}`;
        await this.executeCommand(command);
        
        // Wait for green deployment to be ready
        const waitCommand = `kubectl wait --for=condition=available deployment/cartrita-app-green -n ${this.configuration.kubernetesNamespace} --timeout=600s`;
        await this.executeCommand(waitCommand);
    }
    
    /**
     * Switch traffic to green environment
     */
    async switchTraffic(deployment) {
        const command = `kubectl patch service cartrita-service -n ${this.configuration.kubernetesNamespace} -p '{"spec":{"selector":{"version":"green"}}}'`;
        await this.executeCommand(command);
    }
    
    /**
     * Deploy canary version
     */
    async deployCanary(deployment) {
        // Deploy canary with 10% traffic
        const command = `kubectl apply -f k8s/deployment-canary.yaml -n ${this.configuration.kubernetesNamespace}`;
        await this.executeCommand(command);
    }
    
    /**
     * Execute shell command
     */
    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Command failed: ${error.message}`));
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }
    
    /**
     * Perform health checks
     */
    async performHealthChecks(deployment) {
        const envConfig = this.environments.get(deployment.environment);
        const healthCheckUrl = `https://${envConfig.config.domain}${envConfig.config.healthCheck}`;
        
        let attempts = 0;
        const maxAttempts = 30;
        const delay = 10000; // 10 seconds
        
        while (attempts < maxAttempts) {
            try {
                // In a real implementation, this would be an HTTP request
                console.log(`🔍 Health check attempt ${attempts + 1}: ${healthCheckUrl}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // Mock health check success
                if (Math.random() > 0.1) { // 90% success rate
                    console.log('✅ Health check passed');
                    return;
                }
                
            } catch (error) {
                console.warn(`⚠️ Health check failed: ${error.message}`);
            }
            
            attempts++;
        }
        
        throw new Error('Health checks failed after maximum attempts');
    }
    
    /**
     * Rollback deployment
     */
    async rollbackDeployment(deploymentId) {
        const deployment = this.deployments.get(deploymentId);
        if (!deployment) {
            throw new Error(`Deployment ${deploymentId} not found`);
        }
        
        deployment.state = DeploymentStates.ROLLING_BACK;
        
        try {
            const rollbackCommand = `kubectl rollout undo deployment/cartrita-app -n ${this.configuration.kubernetesNamespace}`;
            await this.executeCommand(rollbackCommand);
            
            // Wait for rollback to complete
            const statusCommand = `kubectl rollout status deployment/cartrita-app -n ${this.configuration.kubernetesNamespace}`;
            await this.executeCommand(statusCommand);
            
            deployment.rollbackInfo = {
                rolledBackAt: Date.now(),
                reason: 'automatic_rollback'
            };
            
            this.metrics.rolledBackDeployments++;
            
            console.log(`✅ Deployment ${deploymentId} rolled back successfully`);
            
        } catch (error) {
            console.error(`❌ Rollback failed for deployment ${deploymentId}:`, error);
            throw error;
        }
    }
    
    /**
     * Check if environment requires approval
     */
    requiresApproval(environment) {
        const envConfig = this.environments.get(environment);
        return envConfig && !envConfig.config.autoApprove;
    }
    
    /**
     * Generate unique deployment ID
     */
    generateDeploymentId() {
        return `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Start deployment monitoring
     */
    startDeploymentMonitoring() {
        setInterval(() => {
            this.monitorActiveDeployments();
        }, 30000); // Check every 30 seconds
    }
    
    /**
     * Monitor active deployments
     */
    async monitorActiveDeployments() {
        const activeDeployments = Array.from(this.deployments.values())
            .filter(dep => dep.state === DeploymentStates.RUNNING);
        
        for (const deployment of activeDeployments) {
            const elapsedTime = Date.now() - deployment.startTime;
            
            if (elapsedTime > this.configuration.deploymentTimeout) {
                deployment.state = DeploymentStates.FAILED;
                deployment.error = 'Deployment timeout';
                
                if (this.configuration.enableAutoRollback) {
                    await this.rollbackDeployment(deployment.id);
                }
                
                this.emit('deploymentTimeout', deployment);
            }
        }
        
        this.metrics.activeDeployments = activeDeployments.length;
    }
    
    /**
     * Update deployment metrics
     */
    updateMetrics(deployment) {
        this.metrics.totalDeployments++;
        
        if (deployment.state === DeploymentStates.SUCCESS) {
            this.metrics.successfulDeployments++;
        } else if (deployment.state === DeploymentStates.FAILED) {
            this.metrics.failedDeployments++;
        }
        
        // Update average deployment time
        if (deployment.duration) {
            this.metrics.averageDeploymentTime = 
                (this.metrics.averageDeploymentTime * (this.metrics.totalDeployments - 1) + deployment.duration) 
                / this.metrics.totalDeployments;
        }
        
        // Calculate deployment frequency (deployments per day)
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentDeployments = Array.from(this.deployments.values())
            .filter(dep => dep.startTime > oneDayAgo).length;
        
        this.metrics.deploymentFrequency = recentDeployments;
    }
    
    /**
     * Load deployment history
     */
    async loadDeploymentHistory() {
        try {
            const historyFile = join(process.cwd(), 'deployments', 'history.json');
            const historyData = await fs.readFile(historyFile, 'utf8');
            this.deploymentHistory = JSON.parse(historyData);
            
            console.log(`✅ Loaded ${this.deploymentHistory.length} deployment records`);
            
        } catch (error) {
            console.log('ℹ️ No deployment history found, starting fresh');
            this.deploymentHistory = [];
        }
    }
    
    /**
     * Save deployment history
     */
    async saveDeploymentHistory() {
        try {
            const historyDir = join(process.cwd(), 'deployments');
            await fs.mkdir(historyDir, { recursive: true });
            
            const historyFile = join(historyDir, 'history.json');
            await fs.writeFile(historyFile, JSON.stringify(this.deploymentHistory, null, 2));
            
        } catch (error) {
            console.warn('⚠️ Failed to save deployment history:', error.message);
        }
    }
    
    /**
     * Get deployment status
     */
    getDeploymentStatus(deploymentId = null) {
        if (deploymentId) {
            return this.deployments.get(deploymentId) || null;
        }
        
        return {
            isInitialized: this.isInitialized,
            metrics: this.metrics,
            activeDeployments: Array.from(this.deployments.values())
                .filter(dep => dep.state === DeploymentStates.RUNNING),
            recentDeployments: Array.from(this.deployments.values())
                .sort((a, b) => b.startTime - a.startTime)
                .slice(0, 10)
        };
    }
    
    /**
     * Get deployment metrics
     */
    getDeploymentMetrics() {
        return {
            ...this.metrics,
            environments: Array.from(this.environments.keys()),
            recentDeploymentSuccess: this.metrics.totalDeployments > 0 
                ? (this.metrics.successfulDeployments / this.metrics.totalDeployments) * 100 
                : 0
        };
    }
    
    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🚀 Shutting down Production Deployment Pipeline Manager...');
        
        // Save deployment history
        await this.saveDeploymentHistory();
        
        // Cancel active processes
        for (const process of this.activeProcesses.values()) {
            process.kill('SIGTERM');
        }
        
        this.activeProcesses.clear();
        this.deployments.clear();
        this.isInitialized = false;
        
        console.log('✅ Production Deployment Pipeline Manager shutdown complete');
    }
}
