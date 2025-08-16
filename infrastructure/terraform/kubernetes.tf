# Kubernetes deployment configurations for Cartrita

# PostgreSQL Database
resource "kubernetes_deployment" "postgres" {
  metadata {
    name      = "cartrita-postgres"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = merge(local.common_labels, { app = "postgres" })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "postgres"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, { app = "postgres" })
      }

      spec {
        security_context {
          run_as_user  = 999
          run_as_group = 999
          fs_group     = 999
        }

        container {
          name  = "postgres"
          image = "postgres:15-alpine"

          env {
            name  = "POSTGRES_DB"
            value = "cartrita"
          }

          env {
            name  = "POSTGRES_USER"
            value = "cartrita"
          }

          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.cartrita_secrets.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          env {
            name  = "POSTGRES_INITDB_ARGS"
            value = "--auth-host=scram-sha-256"
          }

          port {
            container_port = 5432
          }

          volume_mount {
            name       = "postgres-data"
            mount_path = "/var/lib/postgresql/data"
          }

          volume_mount {
            name       = "init-scripts"
            mount_path = "/docker-entrypoint-initdb.d"
          }

          resources {
            requests = {
              memory = "256Mi"
              cpu    = "250m"
            }
            limits = {
              memory = "1Gi"
              cpu    = "1000m"
            }
          }

          liveness_probe {
            exec {
              command = ["pg_isready", "-U", "cartrita", "-d", "cartrita"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            exec {
              command = ["pg_isready", "-U", "cartrita", "-d", "cartrita"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 1
            failure_threshold     = 3
          }
        }

        volume {
          name = "postgres-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.postgres_data.metadata[0].name
          }
        }

        volume {
          name = "init-scripts"
          config_map {
            name = kubernetes_config_map.postgres_init.metadata[0].name
          }
        }
      }
    }
  }
}

# Redis Cache
resource "kubernetes_deployment" "redis" {
  metadata {
    name      = "cartrita-redis"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = merge(local.common_labels, { app = "redis" })
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "redis"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, { app = "redis" })
      }

      spec {
        security_context {
          run_as_user  = 999
          run_as_group = 999
          fs_group     = 999
        }

        container {
          name  = "redis"
          image = "redis:7-alpine"

          command = [
            "redis-server",
            "--appendonly",
            "yes",
            "--requirepass",
            "$(REDIS_PASSWORD)"
          ]

          env {
            name = "REDIS_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.cartrita_secrets.metadata[0].name
                key  = "REDIS_PASSWORD"
              }
            }
          }

          port {
            container_port = 6379
          }

          volume_mount {
            name       = "redis-data"
            mount_path = "/data"
          }

          resources {
            requests = {
              memory = "128Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "512Mi"
              cpu    = "500m"
            }
          }

          liveness_probe {
            exec {
              command = ["redis-cli", "--no-auth-warning", "-a", "$(REDIS_PASSWORD)", "ping"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "--no-auth-warning", "-a", "$(REDIS_PASSWORD)", "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 1
            failure_threshold     = 3
          }
        }

        volume {
          name = "redis-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.redis_data.metadata[0].name
          }
        }
      }
    }
  }
}

# Backend Application
resource "kubernetes_deployment" "backend" {
  metadata {
    name      = "cartrita-backend"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = merge(local.common_labels, { app = "backend" })
  }

  spec {
    replicas = var.backend_replicas

    selector {
      match_labels = {
        app = "backend"
      }
    }

    template {
      metadata {
        labels = merge(local.common_labels, { app = "backend" })
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "3000"
          "prometheus.io/path"   = "/api/metrics"
        }
      }

      spec {
        security_context {
          run_as_non_root = true
          run_as_user     = 1001
          fs_group        = 1001
        }

        container {
          name  = "backend"
          image = var.backend_image

          port {
            container_port = 3000
            name          = "http"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.cartrita_config.metadata[0].name
            }
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.cartrita_secrets.metadata[0].name
            }
          }

          volume_mount {
            name       = "uploads"
            mount_path = "/app/uploads"
          }

          volume_mount {
            name       = "logs"
            mount_path = "/app/logs"
          }

          resources {
            requests = {
              memory = "512Mi"
              cpu    = "250m"
            }
            limits = {
              memory = "2Gi"
              cpu    = "1000m"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 60
            period_seconds        = 30
            timeout_seconds       = 10
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = 3000
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          security_context {
            allow_privilege_escalation = false
            read_only_root_filesystem  = false
            capabilities {
              drop = ["ALL"]
            }
          }
        }

        volume {
          name = "uploads"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.uploads.metadata[0].name
          }
        }

        volume {
          name = "logs"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.logs.metadata[0].name
          }
        }
      }
    }
  }
}

# Services
resource "kubernetes_service" "postgres" {
  metadata {
    name      = "cartrita-postgres"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = merge(local.common_labels, { app = "postgres" })
  }

  spec {
    selector = {
      app = "postgres"
    }

    port {
      port        = 5432
      target_port = 5432
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_service" "redis" {
  metadata {
    name      = "cartrita-redis"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = merge(local.common_labels, { app = "redis" })
  }

  spec {
    selector = {
      app = "redis"
    }

    port {
      port        = 6379
      target_port = 6379
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_service" "backend" {
  metadata {
    name      = "cartrita-backend"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = merge(local.common_labels, { app = "backend" })
  }

  spec {
    selector = {
      app = "backend"
    }

    port {
      port        = 3000
      target_port = 3000
      name        = "http"
    }

    type = "ClusterIP"
  }
}

# Additional PVCs for database storage
resource "kubernetes_persistent_volume_claim" "postgres_data" {
  metadata {
    name      = "postgres-data"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    
    resources {
      requests = {
        storage = var.postgres_storage_size
      }
    }

    storage_class_name = var.storage_class_name
  }
}

resource "kubernetes_persistent_volume_claim" "redis_data" {
  metadata {
    name      = "redis-data"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = local.common_labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    
    resources {
      requests = {
        storage = var.redis_storage_size
      }
    }

    storage_class_name = var.storage_class_name
  }
}

# ConfigMap for PostgreSQL initialization scripts
resource "kubernetes_config_map" "postgres_init" {
  metadata {
    name      = "postgres-init-scripts"
    namespace = kubernetes_namespace.cartrita.metadata[0].name
    labels    = local.common_labels
  }

  data = {
    "00-setup-pgvector.sql" = file("../../db-init/00_setup_pgvector.sql")
    "01-schema.sql"         = file("../../db-init/06_comprehensive_cartrita_schema.sql")
  }
}
