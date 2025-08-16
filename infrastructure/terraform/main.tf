# Terraform configuration for Cartrita Multi-Agent OS infrastructure
# Provider requirements and backend configuration

terraform {
  required_version = ">= 1.0"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }

  # Backend configuration for state storage
  backend "gcs" {
    bucket = var.tf_state_bucket
    prefix = "cartrita/terraform.tfstate"
  }
}

# Local variables
locals {
  common_labels = {
    project     = "cartrita"
    environment = var.environment
    managed_by  = "terraform"
  }

  namespace = "cartrita-${var.environment}"
}

# Random password generation
resource "random_password" "postgres_password" {
  length  = 32
  special = true
}

resource "random_password" "redis_password" {
  length  = 32
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}

# Kubernetes namespace
resource "kubernetes_namespace" "cartrita" {
  metadata {
    name   = local.namespace
    labels = local.common_labels
  }
}

# Secrets
resource "kubernetes_secret" "cartrita_secrets" {
  metadata {
    name      = "cartrita-secrets"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = local.common_labels
  }

  data = {
    DATABASE_URL        = "postgresql://cartrita:${random_password.postgres_password.result}@cartrita-postgres:5432/cartrita"
    REDIS_URL          = "redis://:${random_password.redis_password.result}@cartrita-redis:6379"
    JWT_SECRET         = random_password.jwt_secret.result
    OPENAI_API_KEY     = var.openai_api_key
    HUGGINGFACE_API_KEY = var.huggingface_api_key
    DEEPGRAM_API_KEY   = var.deepgram_api_key
    ANTHROPIC_API_KEY  = var.anthropic_api_key
    GROQ_API_KEY       = var.groq_api_key
    REPLICATE_API_KEY  = var.replicate_api_key
    LANGCHAIN_API_KEY  = var.langchain_api_key
  }

  type = "Opaque"
}

# ConfigMap
resource "kubernetes_config_map" "cartrita_config" {
  metadata {
    name      = "cartrita-config"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = local.common_labels
  }

  data = {
    NODE_ENV                = var.environment
    PORT                   = "3000"
    OTEL_RESOURCE_ATTRIBUTES = "service.name=cartrita-backend,service.version=${var.app_version},environment=${var.environment}"
    LOG_LEVEL             = var.log_level
  }
}

# Persistent Volume Claims
resource "kubernetes_persistent_volume_claim" "uploads" {
  metadata {
    name      = "cartrita-uploads"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    access_modes = ["ReadWriteMany"]
    
    resources {
      requests = {
        storage = var.uploads_storage_size
      }
    }

    storage_class_name = var.storage_class_name
  }
}

resource "kubernetes_persistent_volume_claim" "logs" {
  metadata {
    name      = "cartrita-logs"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    access_modes = ["ReadWriteMany"]
    
    resources {
      requests = {
        storage = var.logs_storage_size
      }
    }

    storage_class_name = var.storage_class_name
  }
}

# Output values
output "namespace" {
  description = "Kubernetes namespace name"
  value       = kubernetes_namespace.cartrita.metadata[0].name
}

output "postgres_password" {
  description = "Generated PostgreSQL password"
  value       = random_password.postgres_password.result
  sensitive   = true
}

output "redis_password" {
  description = "Generated Redis password"
  value       = random_password.redis_password.result
  sensitive   = true
}

output "jwt_secret" {
  description = "Generated JWT secret"
  value       = random_password.jwt_secret.result
  sensitive   = true
}
