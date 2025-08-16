# Variable definitions for Cartrita Terraform configuration

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "development"
}

variable "app_version" {
  description = "Application version/tag"
  type        = string
  default     = "latest"
}

variable "tf_state_bucket" {
  description = "GCS bucket for Terraform state storage"
  type        = string
}

variable "backend_image" {
  description = "Docker image for backend application"
  type        = string
  default     = "ghcr.io/cartrita/cartrita:latest"
}

variable "backend_replicas" {
  description = "Number of backend replicas"
  type        = number
  default     = 3
}

variable "storage_class_name" {
  description = "Storage class for persistent volumes"
  type        = string
  default     = "fast-ssd"
}

variable "uploads_storage_size" {
  description = "Storage size for uploads PVC"
  type        = string
  default     = "10Gi"
}

variable "logs_storage_size" {
  description = "Storage size for logs PVC"
  type        = string
  default     = "5Gi"
}

variable "postgres_storage_size" {
  description = "Storage size for PostgreSQL PVC"
  type        = string
  default     = "20Gi"
}

variable "redis_storage_size" {
  description = "Storage size for Redis PVC"
  type        = string
  default     = "5Gi"
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

# API Keys - marked as sensitive
variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
}

variable "huggingface_api_key" {
  description = "HuggingFace API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "deepgram_api_key" {
  description = "Deepgram API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "groq_api_key" {
  description = "Groq API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "replicate_api_key" {
  description = "Replicate API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "langchain_api_key" {
  description = "LangChain API key"
  type        = string
  sensitive   = true
  default     = ""
}

# Ingress configuration
variable "domain_name" {
  description = "Domain name for ingress"
  type        = string
  default     = "app.cartrita.ai"
}

variable "enable_tls" {
  description = "Enable TLS/SSL for ingress"
  type        = bool
  default     = true
}

variable "cert_manager_issuer" {
  description = "Cert-manager cluster issuer name"
  type        = string
  default     = "letsencrypt-prod"
}

# Monitoring configuration
variable "enable_monitoring" {
  description = "Enable Prometheus monitoring"
  type        = bool
  default     = true
}

variable "enable_jaeger" {
  description = "Enable Jaeger tracing"
  type        = bool
  default     = true
}

# Auto-scaling configuration
variable "enable_hpa" {
  description = "Enable Horizontal Pod Autoscaler"
  type        = bool
  default     = true
}

variable "min_replicas" {
  description = "Minimum number of replicas for HPA"
  type        = number
  default     = 2
}

variable "max_replicas" {
  description = "Maximum number of replicas for HPA"
  type        = number
  default     = 10
}

variable "cpu_utilization_threshold" {
  description = "CPU utilization threshold for HPA"
  type        = number
  default     = 70
}

variable "memory_utilization_threshold" {
  description = "Memory utilization threshold for HPA"
  type        = number
  default     = 80
}
