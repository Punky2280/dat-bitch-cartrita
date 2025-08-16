/**
 * Infrastructure as Code Manager
 * Manages infrastructure provisioning and configuration for Cartrita
 * August 16, 2025
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Infrastructure providers
 */
export const InfrastructureProviders = {
    KUBERNETES: 'kubernetes',
    DOCKER: 'docker',
    TERRAFORM: 'terraform',
    ANSIBLE: 'ansible',
    HELM: 'helm'
};

/**
 * Resource types
 */
export const ResourceTypes = {
    COMPUTE: 'compute',
    STORAGE: 'storage',
    NETWORK: 'network',
    DATABASE: 'database',
    CACHE: 'cache',
    MONITORING: 'monitoring'
};

/**
 * Infrastructure as Code Manager
 * Handles infrastructure provisioning, configuration management, and orchestration
 */
export default class InfrastructureAsCodeManager extends EventEmitter {
    constructor() {
        super();
        
        this.resources = new Map();
        this.templates = new Map();
        this.providers = new Map();
        this.isInitialized = false;
        
        this.configuration = {
            terraformVersion: '1.6.0',
            kubernetesVersion: '1.28',
            helmVersion: '3.13.0',
            ansibleVersion: '2.15.0',
            defaultProvider: InfrastructureProviders.KUBERNETES,
            templateDirectory: 'infrastructure/templates',
            stateDirectory: 'infrastructure/state',
            backupRetention: 30
        };
        
        this.metrics = {
            totalResources: 0,
            provisionedResources: 0,
            failedResources: 0,
            terraformApplies: 0,
            kubernetesDeployments: 0,
            helmReleases: 0
        };
        
        this.init();
    }
    
    /**
     * Initialize Infrastructure as Code Manager
     */
    async init() {
        try {
            console.log('🏗️ Initializing Infrastructure as Code Manager...');
            
            // Setup directory structure
            await this.setupDirectoryStructure();
            
            // Initialize providers
            await this.initializeProviders();
            
            // Load existing templates
            await this.loadInfrastructureTemplates();
            
            // Create default templates
            await this.createDefaultTemplates();
            
            this.isInitialized = true;
            this.emit('initialized');
            
            console.log('✅ Infrastructure as Code Manager initialized');
            
        } catch (error) {
            console.error('❌ Infrastructure Manager initialization failed:', error);
            this.emit('error', error);
        }
    }
    
    /**
     * Setup directory structure for infrastructure management
     */
    async setupDirectoryStructure() {
        const directories = [
            'infrastructure',
            'infrastructure/templates',
            'infrastructure/terraform',
            'infrastructure/kubernetes',
            'infrastructure/helm',
            'infrastructure/ansible',
            'infrastructure/state',
            'infrastructure/backups'
        ];
        
        for (const dir of directories) {
            await fs.mkdir(join(process.cwd(), dir), { recursive: true });
        }
        
        console.log('✅ Infrastructure directory structure created');
    }
    
    /**
     * Initialize infrastructure providers
     */
    async initializeProviders() {
        // Kubernetes provider
        this.providers.set(InfrastructureProviders.KUBERNETES, {
            name: 'Kubernetes',
            executable: 'kubectl',
            configFile: '~/.kube/config',
            namespace: process.env.K8S_NAMESPACE || 'cartrita',
            initialized: await this.checkProviderAvailability('kubectl')
        });
        
        // Terraform provider
        this.providers.set(InfrastructureProviders.TERRAFORM, {
            name: 'Terraform',
            executable: 'terraform',
            configFile: 'terraform.tf',
            stateFile: 'terraform.tfstate',
            initialized: await this.checkProviderAvailability('terraform')
        });
        
        // Helm provider
        this.providers.set(InfrastructureProviders.HELM, {
            name: 'Helm',
            executable: 'helm',
            configFile: 'Chart.yaml',
            repository: 'https://charts.helm.sh/stable',
            initialized: await this.checkProviderAvailability('helm')
        });
        
        // Docker provider
        this.providers.set(InfrastructureProviders.DOCKER, {
            name: 'Docker',
            executable: 'docker',
            configFile: 'docker-compose.yml',
            registry: process.env.DOCKER_REGISTRY || 'localhost:5000',
            initialized: await this.checkProviderAvailability('docker')
        });
        
        // Ansible provider
        this.providers.set(InfrastructureProviders.ANSIBLE, {
            name: 'Ansible',
            executable: 'ansible-playbook',
            configFile: 'ansible.cfg',
            inventory: 'inventory.yml',
            initialized: await this.checkProviderAvailability('ansible-playbook')
        });
        
        console.log('✅ Infrastructure providers initialized');
    }
    
    /**
     * Check if provider is available
     */
    async checkProviderAvailability(executable) {
        try {
            await this.executeCommand(`which ${executable}`);
            return true;
        } catch (error) {
            console.warn(`⚠️ Provider ${executable} not available`);
            return false;
        }
    }
    
    /**
     * Create default infrastructure templates
     */
    async createDefaultTemplates() {
        await this.createKubernetesTemplates();
        await this.createTerraformTemplates();
        await this.createHelmTemplates();
        await this.createAnsibleTemplates();
    }
    
    /**
     * Create Kubernetes templates
     */
    async createKubernetesTemplates() {
        const k8sTemplatesDir = join(process.cwd(), 'infrastructure', 'kubernetes');
        
        // Namespace template
        const namespaceTemplate = `apiVersion: v1
kind: Namespace
metadata:
  name: {{NAMESPACE}}
  labels:
    app: cartrita
    environment: {{ENVIRONMENT}}
---
apiVersion: v1
kind: Secret
metadata:
  name: cartrita-secrets
  namespace: {{NAMESPACE}}
type: Opaque
stringData:
  database-url: {{DATABASE_URL}}
  redis-url: {{REDIS_URL}}
  jwt-secret: {{JWT_SECRET}}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: cartrita-config
  namespace: {{NAMESPACE}}
data:
  NODE_ENV: {{ENVIRONMENT}}
  LOG_LEVEL: {{LOG_LEVEL}}
`;
        
        await fs.writeFile(join(k8sTemplatesDir, 'namespace.yaml'), namespaceTemplate);
        
        // PostgreSQL template
        const postgresTemplate = `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: {{NAMESPACE}}
spec:
  serviceName: postgres-service
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg16
        env:
        - name: POSTGRES_DB
          value: {{POSTGRES_DB}}
        - name: POSTGRES_USER
          value: {{POSTGRES_USER}}
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: cartrita-secrets
              key: postgres-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: {{NAMESPACE}}
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  clusterIP: None
`;
        
        await fs.writeFile(join(k8sTemplatesDir, 'postgres.yaml'), postgresTemplate);
        
        // Redis template
        const redisTemplate = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: {{NAMESPACE}}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 1Gi
      volumes:
      - name: redis-storage
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: {{NAMESPACE}}
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: {{NAMESPACE}}
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
`;
        
        await fs.writeFile(join(k8sTemplatesDir, 'redis.yaml'), redisTemplate);
        
        console.log('✅ Created Kubernetes templates');
    }
    
    /**
     * Create Terraform templates
     */
    async createTerraformTemplates() {
        const terraformDir = join(process.cwd(), 'infrastructure', 'terraform');
        
        // Main Terraform configuration
        const mainTf = `terraform {
  required_version = ">= ${this.configuration.terraformVersion}"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }
  
  backend "local" {
    path = "../state/terraform.tfstate"
  }
}

provider "kubernetes" {
  config_path = "~/.kube/config"
}

provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
  }
}

variable "namespace" {
  description = "Kubernetes namespace for Cartrita"
  type        = string
  default     = "cartrita"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "development"
}

variable "replicas" {
  description = "Number of application replicas"
  type        = number
  default     = 2
}

variable "database_url" {
  description = "Database connection URL"
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Redis connection URL"
  type        = string
  sensitive   = true
}
`;
        
        await fs.writeFile(join(terraformDir, 'main.tf'), mainTf);
        
        // Kubernetes resources
        const k8sResourcesTf = `resource "kubernetes_namespace" "cartrita" {
  metadata {
    name = var.namespace
    
    labels = {
      app         = "cartrita"
      environment = var.environment
    }
  }
}

resource "kubernetes_secret" "cartrita_secrets" {
  metadata {
    name      = "cartrita-secrets"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
  }
  
  data = {
    database-url = var.database_url
    redis-url    = var.redis_url
  }
  
  type = "Opaque"
}

resource "kubernetes_config_map" "cartrita_config" {
  metadata {
    name      = "cartrita-config"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
  }
  
  data = {
    NODE_ENV  = var.environment
    LOG_LEVEL = "info"
  }
}

resource "kubernetes_deployment" "cartrita_app" {
  metadata {
    name      = "cartrita-app"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    
    labels = {
      app = "cartrita"
    }
  }
  
  spec {
    replicas = var.replicas
    
    selector {
      match_labels = {
        app = "cartrita"
      }
    }
    
    template {
      metadata {
        labels = {
          app = "cartrita"
        }
      }
      
      spec {
        container {
          name  = "cartrita"
          image = "cartrita:latest"
          
          port {
            container_port = 3000
          }
          
          env_from {
            secret_ref {
              name = kubernetes_secret.cartrita_secrets.metadata[0].name
            }
          }
          
          env_from {
            config_map_ref {
              name = kubernetes_config_map.cartrita_config.metadata[0].name
            }
          }
          
          resources {
            requests = {
              cpu    = "500m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "2000m"
              memory = "2Gi"
            }
          }
          
          liveness_probe {
            http_get {
              path = "/health"
              port = 3000
            }
            initial_delay_seconds = 60
            period_seconds        = 10
          }
          
          readiness_probe {
            http_get {
              path = "/health/ready"
              port = 3000
            }
            initial_delay_seconds = 10
            period_seconds        = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "cartrita_service" {
  metadata {
    name      = "cartrita-service"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
  }
  
  spec {
    selector = {
      app = "cartrita"
    }
    
    port {
      name        = "http"
      port        = 80
      target_port = 3000
    }
    
    type = "ClusterIP"
  }
}
`;
        
        await fs.writeFile(join(terraformDir, 'kubernetes.tf'), k8sResourcesTf);
        
        // Outputs
        const outputsTf = `output "namespace" {
  value = kubernetes_namespace.cartrita.metadata[0].name
}

output "service_name" {
  value = kubernetes_service.cartrita_service.metadata[0].name
}

output "deployment_name" {
  value = kubernetes_deployment.cartrita_app.metadata[0].name
}
`;
        
        await fs.writeFile(join(terraformDir, 'outputs.tf'), outputsTf);
        
        console.log('✅ Created Terraform templates');
    }
    
    /**
     * Create Helm templates
     */
    async createHelmTemplates() {
        const helmDir = join(process.cwd(), 'infrastructure', 'helm', 'cartrita');
        await fs.mkdir(helmDir, { recursive: true });
        await fs.mkdir(join(helmDir, 'templates'), { recursive: true });
        
        // Chart.yaml
        const chartYaml = `apiVersion: v2
name: cartrita
description: A Helm chart for Cartrita Multi-Agent OS
type: application
version: 0.1.0
appVersion: "1.0.0"
keywords:
  - multi-agent
  - ai
  - node.js
maintainers:
  - name: Cartrita Team
    email: team@cartrita.com
`;
        
        await fs.writeFile(join(helmDir, 'Chart.yaml'), chartYaml);
        
        // values.yaml
        const valuesYaml = `# Default values for cartrita
replicaCount: 2

image:
  repository: cartrita
  pullPolicy: IfNotPresent
  tag: "latest"

nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations: {}

podSecurityContext:
  fsGroup: 2000

securityContext:
  capabilities:
    drop:
    - ALL
  readOnlyRootFilesystem: false
  runAsNonRoot: true
  runAsUser: 1000

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: false
  className: ""
  annotations: {}
  hosts:
    - host: cartrita.local
      paths:
        - path: /
          pathType: Prefix
  tls: []

resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity: {}

# Database configuration
database:
  enabled: true
  host: postgres-service
  port: 5432
  name: cartrita
  username: cartrita
  existingSecret: cartrita-secrets
  existingSecretKey: database-url

# Redis configuration  
redis:
  enabled: true
  host: redis-service
  port: 6379
  existingSecret: cartrita-secrets
  existingSecretKey: redis-url
`;
        
        await fs.writeFile(join(helmDir, 'values.yaml'), valuesYaml);
        
        // Deployment template
        const deploymentTemplate = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "cartrita.fullname" . }}
  labels:
    {{- include "cartrita.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "cartrita.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      {{- with .Values.podAnnotations }}
      annotations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      labels:
        {{- include "cartrita.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "cartrita.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 60
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 10
            periodSeconds: 5
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.database.existingSecret }}
                  key: {{ .Values.database.existingSecretKey }}
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.redis.existingSecret }}
                  key: {{ .Values.redis.existingSecretKey }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
`;
        
        await fs.writeFile(join(helmDir, 'templates', 'deployment.yaml'), deploymentTemplate);
        
        console.log('✅ Created Helm templates');
    }
    
    /**
     * Create Ansible templates
     */
    async createAnsibleTemplates() {
        const ansibleDir = join(process.cwd(), 'infrastructure', 'ansible');
        
        // Inventory template
        const inventoryYaml = `---
all:
  children:
    kubernetes:
      hosts:
        k8s-master:
          ansible_host: {{ K8S_MASTER_IP }}
          ansible_user: {{ K8S_USER }}
          ansible_ssh_private_key_file: {{ SSH_KEY_PATH }}
        k8s-worker-1:
          ansible_host: {{ K8S_WORKER_1_IP }}
          ansible_user: {{ K8S_USER }}
          ansible_ssh_private_key_file: {{ SSH_KEY_PATH }}
        k8s-worker-2:
          ansible_host: {{ K8S_WORKER_2_IP }}
          ansible_user: {{ K8S_USER }}
          ansible_ssh_private_key_file: {{ SSH_KEY_PATH }}
`;
        
        await fs.writeFile(join(ansibleDir, 'inventory.yaml'), inventoryYaml);
        
        // Main playbook
        const playbookYaml = `---
- name: Deploy Cartrita to Kubernetes
  hosts: k8s-master
  gather_facts: false
  vars:
    namespace: cartrita
    image_tag: "{{ cartrita_version | default('latest') }}"
    replicas: "{{ cartrita_replicas | default(2) }}"
    
  tasks:
    - name: Create namespace
      kubernetes.core.k8s:
        name: "{{ namespace }}"
        api_version: v1
        kind: Namespace
        state: present
        
    - name: Apply secrets
      kubernetes.core.k8s:
        definition:
          apiVersion: v1
          kind: Secret
          metadata:
            name: cartrita-secrets
            namespace: "{{ namespace }}"
          type: Opaque
          stringData:
            database-url: "{{ database_url }}"
            redis-url: "{{ redis_url }}"
            
    - name: Deploy application
      kubernetes.core.k8s:
        definition:
          apiVersion: apps/v1
          kind: Deployment
          metadata:
            name: cartrita-app
            namespace: "{{ namespace }}"
          spec:
            replicas: "{{ replicas }}"
            selector:
              matchLabels:
                app: cartrita
            template:
              metadata:
                labels:
                  app: cartrita
              spec:
                containers:
                - name: cartrita
                  image: "cartrita:{{ image_tag }}"
                  ports:
                  - containerPort: 3000
                  envFrom:
                  - secretRef:
                      name: cartrita-secrets
                      
    - name: Create service
      kubernetes.core.k8s:
        definition:
          apiVersion: v1
          kind: Service
          metadata:
            name: cartrita-service
            namespace: "{{ namespace }}"
          spec:
            selector:
              app: cartrita
            ports:
            - port: 80
              targetPort: 3000
`;
        
        await fs.writeFile(join(ansibleDir, 'deploy.yaml'), playbookYaml);
        
        console.log('✅ Created Ansible templates');
    }
    
    /**
     * Load existing infrastructure templates
     */
    async loadInfrastructureTemplates() {
        try {
            const templatesDir = join(process.cwd(), this.configuration.templateDirectory);
            const templates = await fs.readdir(templatesDir, { withFileTypes: true });
            
            for (const template of templates) {
                if (template.isFile() && (template.name.endsWith('.yaml') || template.name.endsWith('.yml'))) {
                    const templateContent = await fs.readFile(
                        join(templatesDir, template.name), 
                        'utf8'
                    );
                    
                    this.templates.set(template.name, {
                        name: template.name,
                        content: templateContent,
                        provider: this.detectProvider(templateContent),
                        resourceType: this.detectResourceType(templateContent)
                    });
                }
            }
            
            console.log(`✅ Loaded ${this.templates.size} infrastructure templates`);
            
        } catch (error) {
            console.log('ℹ️ No existing templates found, using defaults');
        }
    }
    
    /**
     * Detect provider from template content
     */
    detectProvider(content) {
        if (content.includes('apiVersion:') && content.includes('kind:')) {
            return InfrastructureProviders.KUBERNETES;
        }
        if (content.includes('terraform {') || content.includes('resource "')) {
            return InfrastructureProviders.TERRAFORM;
        }
        if (content.includes('Chart.yaml') || content.includes('helm')) {
            return InfrastructureProviders.HELM;
        }
        if (content.includes('docker-compose') || content.includes('services:')) {
            return InfrastructureProviders.DOCKER;
        }
        if (content.includes('hosts:') && content.includes('tasks:')) {
            return InfrastructureProviders.ANSIBLE;
        }
        
        return 'unknown';
    }
    
    /**
     * Detect resource type from template content
     */
    detectResourceType(content) {
        const contentLower = content.toLowerCase();
        
        if (contentLower.includes('database') || contentLower.includes('postgres') || contentLower.includes('mysql')) {
            return ResourceTypes.DATABASE;
        }
        if (contentLower.includes('redis') || contentLower.includes('cache') || contentLower.includes('memcached')) {
            return ResourceTypes.CACHE;
        }
        if (contentLower.includes('deployment') || contentLower.includes('service') || contentLower.includes('pod')) {
            return ResourceTypes.COMPUTE;
        }
        if (contentLower.includes('persistentvolume') || contentLower.includes('storage')) {
            return ResourceTypes.STORAGE;
        }
        if (contentLower.includes('ingress') || contentLower.includes('loadbalancer') || contentLower.includes('network')) {
            return ResourceTypes.NETWORK;
        }
        if (contentLower.includes('prometheus') || contentLower.includes('grafana') || contentLower.includes('monitoring')) {
            return ResourceTypes.MONITORING;
        }
        
        return 'general';
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
     * Get infrastructure status
     */
    getInfrastructureStatus() {
        return {
            isInitialized: this.isInitialized,
            providers: Array.from(this.providers.entries()).map(([name, config]) => ({
                name,
                available: config.initialized,
                executable: config.executable
            })),
            templates: this.templates.size,
            resources: this.resources.size,
            metrics: this.metrics
        };
    }
    
    /**
     * Get infrastructure metrics
     */
    getInfrastructureMetrics() {
        return {
            ...this.metrics,
            providersAvailable: Array.from(this.providers.values()).filter(p => p.initialized).length,
            totalProviders: this.providers.size,
            templatesLoaded: this.templates.size
        };
    }
    
    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🏗️ Shutting down Infrastructure as Code Manager...');
        
        this.resources.clear();
        this.templates.clear();
        this.providers.clear();
        this.isInitialized = false;
        
        console.log('✅ Infrastructure as Code Manager shutdown complete');
    }
}
