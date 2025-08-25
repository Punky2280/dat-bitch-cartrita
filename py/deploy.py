#!/usr/bin/env python3
"""
Cartrita Hybrid System Deployment Script
Comprehensive deployment automation for the Node.js/Python hybrid architecture
"""

import os
import sys
import subprocess
import time
import logging
import signal
from pathlib import Path
from typing import Dict, List, Optional
import json

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/cartrita_deployment.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('cartrita-deploy')


class CartritaDeployer:
    """Deployment orchestrator for Cartrita hybrid architecture."""
    
    def __init__(self, project_root: str = "/home/robbie/development/dat-bitch-cartrita"):
        self.project_root = Path(project_root)
        self.processes: Dict[str, subprocess.Popen] = {}
        self.deployment_status = {
            'database': False,
            'redis': False,
            'nodejs_backend': False,
            'python_backend': False,
            'frontend': False,
            'nginx': False
        }
        
    def check_prerequisites(self) -> bool:
        """Check system prerequisites and dependencies."""
        logger.info("🔍 Checking system prerequisites...")
        
        required_commands = ['docker', 'docker-compose', 'node', 'npm', 'python3', 'pip']
        missing_commands = []
        
        for cmd in required_commands:
            if subprocess.run(['which', cmd], capture_output=True).returncode != 0:
                missing_commands.append(cmd)
        
        if missing_commands:
            logger.error(f"❌ Missing required commands: {', '.join(missing_commands)}")
            return False
        
        # Check Docker daemon
        try:
            subprocess.run(['docker', 'info'], capture_output=True, check=True)
            logger.info("✅ Docker daemon is running")
        except subprocess.CalledProcessError:
            logger.error("❌ Docker daemon is not running")
            return False
        
        logger.info("✅ All prerequisites satisfied")
        return True
    
    def setup_environment(self) -> bool:
        """Setup environment files and configurations."""
        logger.info("⚙️  Setting up environment configuration...")
        
        try:
            # Setup Python environment
            py_env_path = self.project_root / "py" / ".env"
            py_env_example = self.project_root / "py" / ".env.example"
            
            if not py_env_path.exists() and py_env_example.exists():
                py_env_path.write_text(py_env_example.read_text())
                logger.info("✅ Created Python .env file")
            
            # Setup Node.js environment
            node_env_path = self.project_root / "packages" / "backend" / ".env"
            if not node_env_path.exists():
                env_content = """
DATABASE_URL=postgresql://robert:punky1@postgres:5432/dat-bitch-cartrita
REDIS_URL=redis://redis:6379/0
OPENAI_API_KEY=sk-proj-bF1fvxRLlkLJYpN6Yld6gWjr1Z4lH2e8kxXSBvKjdPLJA_hgTpz1rVHLe8YqpHGpJ8K6Lz0-2F_9bR5dN3pE6wJ8YlT3-vU7Q2sW8z
ANTHROPIC_API_KEY=sk-ant-api03-8n5YUmHb75lNPbqhJXdIWwOgV2nqL6m7qzE-0YxkJl3mvzsN1SrKe6zBGpPJQn3xqH
HUGGINGFACE_API_KEY=hf_SdJhqRmbNXKQvzOLfG3RpK7xYcpVZq2C8K
NODE_ENV=development
PORT=8000
PYTHON_SERVICE_URL=http://python-backend:8002
MCP_SOCKET_PATH=/tmp/cartrita_mcp.sock
"""
                node_env_path.write_text(env_content.strip())
                logger.info("✅ Created Node.js .env file")
            
            return True
        except Exception as e:
            logger.error(f"❌ Failed to setup environment: {e}")
            return False
    
    def install_dependencies(self) -> bool:
        """Install Node.js and Python dependencies."""
        logger.info("📦 Installing dependencies...")
        
        try:
            # Install Node.js dependencies
            logger.info("Installing Node.js dependencies...")
            subprocess.run(['npm', 'install'], cwd=self.project_root, check=True)
            subprocess.run(['npm', 'run', 'install:all'], cwd=self.project_root, check=True)
            
            # Install Python dependencies
            logger.info("Installing Python dependencies...")
            subprocess.run([
                'pip', 'install', '-r', 'requirements.txt'
            ], cwd=self.project_root / "py", check=True)
            
            logger.info("✅ Dependencies installed successfully")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Failed to install dependencies: {e}")
            return False
    
    def run_database_migrations(self) -> bool:
        """Run database migrations."""
        logger.info("🗄️  Running database migrations...")
        
        try:
            # Wait for database to be ready
            time.sleep(5)
            
            # Run database initialization script
            init_script = self.project_root / "init-database.sh"
            if init_script.exists():
                subprocess.run(['bash', str(init_script)], check=True)
                logger.info("✅ Database migrations completed")
                return True
            else:
                logger.warning("⚠️  No database initialization script found")
                return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Database migration failed: {e}")
            return False
    
    def start_docker_services(self) -> bool:
        """Start Docker Compose services."""
        logger.info("🐳 Starting Docker services...")
        
        try:
            compose_file = self.project_root / "docker-compose.hybrid-v2.yml"
            
            # Stop any existing services
            subprocess.run([
                'docker-compose', '-f', str(compose_file), 'down'
            ], cwd=self.project_root, capture_output=True)
            
            # Start services
            subprocess.run([
                'docker-compose', '-f', str(compose_file), 'up', '-d'
            ], cwd=self.project_root, check=True)
            
            logger.info("✅ Docker services started")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ Failed to start Docker services: {e}")
            return False
    
    def verify_services(self) -> bool:
        """Verify that all services are healthy."""
        logger.info("🔍 Verifying service health...")
        
        services = {
            'PostgreSQL': ('localhost', 5432),
            'Redis': ('localhost', 6379),
            'Node.js Backend': ('localhost', 8000),
            'Python Backend': ('localhost', 8002),
            'Frontend': ('localhost', 3000),
        }
        
        for service, (host, port) in services.items():
            if self._check_service_health(host, port):
                logger.info(f"✅ {service} is healthy")
                self.deployment_status[service.lower().replace(' ', '_').replace('.js', 'js')] = True
            else:
                logger.warning(f"⚠️  {service} is not responding")
        
        return all(self.deployment_status.values())
    
    def _check_service_health(self, host: str, port: int, timeout: int = 5) -> bool:
        """Check if a service is responding on the given host:port."""
        import socket
        
        try:
            with socket.create_connection((host, port), timeout):
                return True
        except (socket.error, socket.timeout):
            return False
    
    def display_status(self):
        """Display deployment status and useful information."""
        logger.info("📊 Deployment Status:")
        logger.info("=" * 50)
        
        for service, status in self.deployment_status.items():
            status_icon = "✅" if status else "❌"
            logger.info(f"{status_icon} {service.replace('_', ' ').title()}")
        
        logger.info("\n🌐 Service URLs:")
        logger.info("- Frontend: http://localhost:3000")
        logger.info("- Node.js API: http://localhost:8000")
        logger.info("- Python API: http://localhost:8002")
        logger.info("- Grafana: http://localhost:3001")
        logger.info("- Jaeger: http://localhost:16686")
        
        logger.info("\n📋 Useful Commands:")
        logger.info("- View logs: docker-compose -f docker-compose.hybrid-v2.yml logs -f")
        logger.info("- Stop services: docker-compose -f docker-compose.hybrid-v2.yml down")
        logger.info("- Restart: python deploy.py")
    
    def deploy(self) -> bool:
        """Execute full deployment pipeline."""
        logger.info("🚀 Starting Cartrita Hybrid System Deployment")
        logger.info("=" * 60)
        
        steps = [
            ("Prerequisites Check", self.check_prerequisites),
            ("Environment Setup", self.setup_environment),
            ("Dependencies Installation", self.install_dependencies),
            ("Docker Services", self.start_docker_services),
            ("Database Migrations", self.run_database_migrations),
            ("Service Verification", self.verify_services),
        ]
        
        for step_name, step_func in steps:
            logger.info(f"\n📋 Step: {step_name}")
            if not step_func():
                logger.error(f"❌ Deployment failed at step: {step_name}")
                return False
            time.sleep(2)  # Brief pause between steps
        
        logger.info("\n🎉 Deployment completed successfully!")
        self.display_status()
        return True
    
    def cleanup(self):
        """Cleanup deployment resources."""
        logger.info("🧹 Cleaning up deployment resources...")
        
        try:
            compose_file = self.project_root / "docker-compose.hybrid-v2.yml"
            subprocess.run([
                'docker-compose', '-f', str(compose_file), 'down', '--volumes'
            ], cwd=self.project_root, capture_output=True)
            logger.info("✅ Cleanup completed")
        except Exception as e:
            logger.error(f"❌ Cleanup failed: {e}")


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    logger.info("🛑 Received shutdown signal, cleaning up...")
    deployer.cleanup()
    sys.exit(0)


def main():
    """Main deployment entry point."""
    global deployer
    
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    deployer = CartritaDeployer()
    
    if len(sys.argv) > 1 and sys.argv[1] == 'cleanup':
        deployer.cleanup()
        return
    
    if not deployer.deploy():
        logger.error("💥 Deployment failed!")
        sys.exit(1)
    
    logger.info("\n🎯 Deployment successful! Services are running.")
    logger.info("Press Ctrl+C to stop and cleanup services.")
    
    # Keep the script running to maintain logs
    try:
        while True:
            time.sleep(60)
            # Optional: Periodic health checks
            deployer.verify_services()
    except KeyboardInterrupt:
        signal_handler(signal.SIGINT, None)


if __name__ == "__main__":
    main()