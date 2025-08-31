#!/usr/bin/env python3
"""
Cartrita V2 - Comprehensive Python-Only Build System
====================================================

Complete build, setup, test, and deployment automation for Cartrita V2
using only Python backend with FastAPI, AI agents, and MCP integration.

Features:
- Environment validation and setup
- Python dependency management with constraints
- Database initialization and migrations
- Docker container orchestration
- Health checks and monitoring
- Development and production modes
- Automated testing and validation
- Comprehensive logging and error handling

Usage:
    python build.py --help
    python build.py setup
    python build.py dev
    python build.py prod
    python build.py test
    python build.py docker
    python build.py clean
"""

import os
import sys
import subprocess
import argparse
import json
import time
import logging
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional

# Configure comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('build.log')
    ]
)
logger = logging.getLogger(__name__)

class CartritaBuilder:
    """Comprehensive build orchestrator for Cartrita V2 Python-only system"""
    
    def __init__(self, root_path: Optional[Path] = None):
        self.root_path = root_path or Path(__file__).parent
        self.py_path = self.root_path / "py"
        self.frontend_path = self.root_path / "frontend"
        self.db_init_path = self.root_path / "db-init"
        self.docker_compose_file = self.root_path / "docker-compose.yml"
        # Determine docker compose command (v2 preferred)
        self.compose_cmd = self._detect_compose_command()
        self.required_env_vars = [
            "OPENAI_API_KEY",
            "POSTGRES_PASSWORD",
        ]
        # Attempt to eagerly load environment on init so subsequent steps see variables
        self._loaded_env = False
        self._load_env_file(self.root_path / ".env")

    def _http_health_check(self, name: str, url: str, retries: int = 5, delay: float = 3.0, timeout: float = 5.0) -> bool:
        """HTTP health check with retries for services that may take time to warm up."""
        try:
            import requests
        except Exception:
            logger.error("requests package not available for HTTP health checks")
            return False
        for attempt in range(1, retries + 1):
            try:
                resp = requests.get(url, timeout=timeout)
                if 200 <= resp.status_code < 400:
                    logger.info(f"✅ {name} is healthy")
                    return True
                else:
                    logger.error(f"❌ {name} returned HTTP {resp.status_code}")
            except Exception as e:
                logger.info(f"Waiting for {name}... ({attempt}/{retries}) - {e}")
            time.sleep(delay)
        logger.error(f"❌ {name} health check failed after {retries} attempts")
        return False

    def _detect_compose_command(self) -> List[str]:
        """Detect whether to use `docker compose` (v2) or `docker-compose` (v1)."""
        # Prefer docker compose v2 if available
        if shutil.which("docker"):
            try:
                result = subprocess.run(
                    ["docker", "compose", "version"],
                    cwd=self.root_path,
                    capture_output=True,
                    text=True,
                )
                if result.returncode == 0:
                    return ["docker", "compose"]
            except Exception:
                pass
        # Fallback to docker-compose v1
        return ["docker-compose"]

    def _load_env_file(self, env_path: Path) -> None:
        """Load environment variables from a .env file if present.
        Uses python-dotenv if available; otherwise, falls back to a minimal parser.
        """
        if self._loaded_env:
            return
        try:
            if env_path.exists():
                # Try python-dotenv first
                try:
                    from dotenv import load_dotenv  # type: ignore
                    load_dotenv(dotenv_path=str(env_path), override=True)
                    logger.info(f"Loaded environment from {env_path} (python-dotenv)")
                except Exception:
                    # Minimal fallback parser: KEY=VALUE lines, ignore comments and blanks
                    with env_path.open("r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if not line or line.startswith("#"):
                                continue
                            if "=" not in line:
                                continue
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip('"').strip("'")
                            os.environ[key] = val
                    logger.info(f"Loaded environment from {env_path} (fallback parser)")
                self._loaded_env = True
            else:
                logger.debug(f"No .env file found at {env_path}")
        except Exception as e:
            logger.warning(f"Failed to load .env file: {e}")
        
    def run_command(self, cmd: List[str], cwd: Optional[Path] = None, shell: bool = False) -> bool:
        """Run a command with comprehensive error handling and logging."""
        cmd_str = ' '.join(cmd)
        try:
            logger.info(f"Running: {cmd_str}")
            if cwd:
                logger.info(f"Working directory: {cwd}")
            
            if shell:
                result = subprocess.run(
                    cmd_str,
                    shell=True,
                    cwd=cwd or self.root_path,
                    capture_output=True,
                    text=True,
                    check=True
                )
            else:
                result = subprocess.run(
                    cmd,
                    cwd=cwd or self.root_path,
                    capture_output=True,
                    text=True,
                    check=True
                )
                
            if result.stdout:
                logger.debug(f"Output: {result.stdout}")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Command failed with exit code {e.returncode}: {cmd_str}")
            if e.stderr:
                logger.error(f"Error output: {e.stderr}")
            return False
        except FileNotFoundError:
            logger.error(f"Command not found: {cmd[0]}")
            return False
    
    def check_prerequisites(self) -> bool:
        """Check if all required tools and dependencies are available."""
        logger.info("Checking system prerequisites...")
        
        # Check Python version
        if sys.version_info < (3, 8):
            logger.error("Python 3.8+ required")
            return False
        
        required_tools = [
            ("python3", ["--version"]),
            ("pip", ["--version"]),
            ("docker", ["--version"]),
        ]
        # Compose check: if v2 is available, we don't require v1
        compose_v2_ok = False
        if shutil.which("docker"):
            try:
                result = subprocess.run(
                    ["docker", "compose", "version"],
                    cwd=self.root_path,
                    capture_output=True,
                    text=True,
                )
                compose_v2_ok = (result.returncode == 0)
            except Exception:
                compose_v2_ok = False
        if not compose_v2_ok:
            required_tools.append(("docker-compose", ["--version"]))
        
        # Add Node.js tools if frontend exists
        if self.frontend_path.exists():
            required_tools.extend([
                ("npm", ["--version"]),
                ("node", ["--version"]),
            ])
        
        all_ok = True
        for tool, version_cmd in required_tools:
            if not shutil.which(tool):
                logger.error(f"Required tool not found: {tool}")
                all_ok = False
            elif not self.run_command([tool] + version_cmd):
                all_ok = False
        
        if all_ok:
            logger.info("✅ All prerequisites satisfied")
        
        return all_ok
    
    def setup_environment(self) -> bool:
        """Setup environment variables and configuration files."""
        logger.info("Setting up environment...")
        
        env_file = self.root_path / ".env"
        env_example = self.root_path / ".env.example"
        
        # Create .env from example if it doesn't exist
        if not env_file.exists() and env_example.exists():
            shutil.copy(env_example, env_file)
            logger.info("Created .env from .env.example")
        elif not env_file.exists():
            logger.warning("No .env or .env.example file found")
        
        # Ensure we (re)load .env before validating
        self._load_env_file(env_file)

        # Validate required environment variables
        missing_vars = []
        for var in self.required_env_vars:
            if not os.getenv(var):
                missing_vars.append(var)
        
        if missing_vars:
            logger.warning(f"Missing environment variables: {', '.join(missing_vars)}")
            logger.warning("Please configure these in .env file")
        else:
            logger.info("All required environment variables are set")
        
        return True
    
    def install_python_dependencies(self) -> bool:
        """Install Python backend dependencies with constraints."""
        logger.info("Installing Python dependencies...")
        
        if not self.py_path.exists():
            logger.error(f"Python directory not found: {self.py_path}")
            return False
            
        requirements_file = self.py_path / "requirements.txt"
        if not requirements_file.exists():
            logger.error(f"Requirements file not found: {requirements_file}")
            return False
        
        # Use constraints if available for better dependency resolution
        constraints_file = self.py_path / "constraints.txt"
        cmd = ["pip", "install", "-r", str(requirements_file)]
        if constraints_file.exists():
            cmd.extend(["--constraint", str(constraints_file)])
            logger.info("Using constraints file for dependency resolution")
        
        # Add upgrade and quiet flags for cleaner output
        cmd.extend(["--upgrade", "--quiet"])
            
        return self.run_command(cmd, cwd=self.py_path)
    
    def install_frontend_dependencies(self) -> bool:
        """Install frontend dependencies if frontend exists."""
        if not self.frontend_path.exists():
            logger.info("Frontend directory not found, skipping frontend dependencies")
            return True
            
        logger.info("Installing frontend dependencies...")
        package_json = self.frontend_path / "package.json"
        if not package_json.exists():
            logger.error(f"Frontend package.json not found: {package_json}")
            return False
            
        return self.run_command(["npm", "install"], cwd=self.frontend_path)
    
    def setup_database(self) -> bool:
        """Setup database services and run migrations."""
        logger.info("Setting up database...")
        
        # Start database services only
        if not self.run_command(self.compose_cmd + ["up", "-d", "postgres", "redis"]):
            return False
        
        # Wait for database to be ready
        logger.info("Waiting for database to be ready...")
        max_retries = 30
        for i in range(max_retries):
            if self.run_command(self.compose_cmd + ["exec", "-T", "postgres",
                               "pg_isready", "-U", "robert", "-d", "dat-bitch-cartrita"]):
                logger.info("Database is ready")
                break
            time.sleep(2)
            logger.info(f"Waiting for database... ({i+1}/{max_retries})")
        else:
            logger.error("Database failed to start within timeout")
            return False
        
        # Run database migrations
        return self.run_migrations()
    
    def run_migrations(self) -> bool:
        """Run all database migrations in order."""
        logger.info("Running database migrations...")
        
        if not self.db_init_path.exists():
            logger.warning("No database initialization directory found")
            return True
        
        migration_files = sorted(self.db_init_path.glob("*.sql"))
        if not migration_files:
            logger.warning("No migration files found")
            return True
        
        # Get database URL from environment or use default
        db_url = os.getenv("DATABASE_URL", 
                          "postgresql://robert:secure_password@localhost:5432/dat-bitch-cartrita")
        
        success = True
        for migration_file in migration_files:
            logger.info(f"Running migration: {migration_file.name}")
            if not self.run_command(["psql", db_url, "-f", str(migration_file)]):
                logger.warning(f"Migration {migration_file.name} failed, continuing...")
                # Don't fail the entire process for migration failures
        
        return success
    
    def run_python_tests(self) -> bool:
        """Run comprehensive Python test suite."""
        logger.info("Running Python tests...")
        
        # Check if pytest is available
        if not self.run_command(["python3", "-m", "pytest", "--version"]):
            logger.info("pytest not available, installing...")
            if not self.run_command(["pip", "install", "pytest", "pytest-asyncio"], 
                                  cwd=self.py_path):
                return False
        
        # Find test files
        test_files = (
            list(self.py_path.glob("test_*.py")) + 
            list(self.py_path.glob("*_test.py")) +
            list(self.py_path.glob("tests/*.py"))
        )
        
        if not test_files:
            logger.info("No test files found, skipping tests")
            return True
        
        # Run tests with verbose output
        return self.run_command([
            "python3", "-m", "pytest", "-v", "--tb=short"
        ], cwd=self.py_path)
    
    def lint_python_code(self) -> bool:
        """Lint and format Python code using available tools."""
        logger.info("Linting Python code...")
        
        success = True
        
        # Check Black formatting
        if shutil.which("black"):
            logger.info("Checking Black formatting...")
            if not self.run_command([
                "python3", "-m", "black", "--check", "--diff", "."
            ], cwd=self.py_path):
                logger.warning("Black formatting issues found. Run 'black .' to fix.")
                success = False
        else:
            logger.info("Black not available, skipping formatting check")
        
        # Check flake8 linting
        if shutil.which("flake8"):
            logger.info("Running flake8 linting...")
            if not self.run_command([
                "python3", "-m", "flake8", "--max-line-length=88", "."
            ], cwd=self.py_path):
                success = False
        else:
            logger.info("flake8 not available, skipping lint check")
        
        return success
    
    def build_frontend(self) -> bool:
        """Build frontend application if it exists."""
        if not self.frontend_path.exists():
            logger.info("Frontend directory not found, skipping frontend build")
            return True
            
        logger.info("Building frontend...")
        return self.run_command(["npm", "run", "build"], cwd=self.frontend_path)
    
    def build_docker_images(self) -> bool:
        """Build all Docker images."""
        logger.info("Building Docker images...")
        
        if not self.docker_compose_file.exists():
            logger.error(f"Docker Compose file not found: {self.docker_compose_file}")
            return False
        
        return self.run_command(self.compose_cmd + ["build"])
    
    def start_services(self, mode: str = "development") -> bool:
        """Start all services in specified mode."""
        logger.info(f"Starting services in {mode} mode...")
        
        if not self.docker_compose_file.exists():
            logger.error(f"Docker Compose file not found: {self.docker_compose_file}")
            return False
        
        if mode == "development":
            return self.run_command(self.compose_cmd + ["up", "-d"])
        elif mode == "production":
            return self.run_command(self.compose_cmd + ["-f", "docker-compose.yml", "up", "-d"])
        else:
            logger.error(f"Unknown mode: {mode}")
            return False
    
    def health_check(self) -> bool:
        """Perform comprehensive health checks on all services."""
        logger.info("Performing health checks...")
        
        # Wait for services to fully start
        logger.info("Waiting for services to start...")
        time.sleep(15)
        
        # Define health check endpoints
        checks = [
            ("Python Backend", "http://localhost:8002/health"),
            ("Database", self.compose_cmd + ["exec", "-T", "postgres", "pg_isready", "-U", "robert"]),
            ("Redis", self.compose_cmd + ["exec", "-T", "redis", "redis-cli", "ping"]),
        ]
        
        if self.frontend_path.exists():
            checks.append(("Frontend", "http://localhost:3000/"))
        
        all_healthy = True
        for name, check in checks:
            try:
                if isinstance(check, str):
                    # HTTP health check; allow extra time for Frontend on first compile
                    if name == "Frontend":
                        ok = self._http_health_check(name, check, retries=10, delay=3.0, timeout=15.0)
                    else:
                        ok = self._http_health_check(name, check, retries=5, delay=2.0, timeout=5.0)
                    if not ok:
                        all_healthy = False
                else:
                    # Command-based health check
                    if self.run_command(check):
                        logger.info(f"✅ {name} is healthy")
                    else:
                        logger.error(f"❌ {name} health check failed")
                        all_healthy = False
            except Exception as e:
                logger.error(f"❌ {name} health check failed: {e}")
                all_healthy = False
        
        return all_healthy
    
    def clean_build_artifacts(self) -> bool:
        """Clean all build artifacts and caches."""
        logger.info("Cleaning build artifacts...")
        
        # Python artifacts
        python_patterns = ["__pycache__", ".pytest_cache", "*.pyc", "*.pyo", ".coverage"]
        for pattern in python_patterns:
            self.run_command(["find", ".", "-name", pattern, "-delete"])
        
        # Frontend artifacts
        if self.frontend_path.exists():
            frontend_dirs = [".next", "dist", "build", "node_modules"]
            for dir_name in frontend_dirs:
                dir_path = self.frontend_path / dir_name
                if dir_path.exists():
                    shutil.rmtree(dir_path, ignore_errors=True)
                    logger.info(f"Removed {dir_path}")
        
        # Docker cleanup
        self.run_command(self.compose_cmd + ["down", "--remove-orphans"])
        self.run_command(["docker", "system", "prune", "-f"])
        
        logger.info("✅ Cleanup completed")
        return True

def main():
    parser = argparse.ArgumentParser(
        description="Cartrita V2 Comprehensive Python Build System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  setup          Complete initial setup
  dev            Development mode with live reload
  prod           Production deployment
  test           Run comprehensive test suite
  docker         Docker-only build and deployment
  clean          Clean build artifacts
  install        Install dependencies only
  lint           Run code linting
  build          Build frontend assets
  start          Start services in development mode
  start-prod     Start services in production mode
  health         Run health checks
  all            Complete build pipeline

Examples:
  python build.py setup          # Initial setup
  python build.py dev            # Development mode
  python build.py prod           # Production deployment
  python build.py test           # Run tests
  python build.py docker         # Docker-only deployment
  python build.py clean          # Clean artifacts
        """
    )
    
    parser.add_argument(
        "command",
        choices=[
            "setup", "dev", "prod", "test", "docker", "clean",
            "install", "lint", "build", "start", "start-prod", "health", "all"
        ],
        help="Build command to execute"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    builder = CartritaBuilder()
    
    logger.info("🎯 Cartrita V2 - Comprehensive Python Build System")
    logger.info("=" * 50)
    
    success = True
    
    try:
        if args.command == "setup":
            # Complete setup process
            steps = [
                ("Prerequisites", builder.check_prerequisites),
                ("Environment", builder.setup_environment),
                ("Python Dependencies", builder.install_python_dependencies),
                ("Frontend Dependencies", builder.install_frontend_dependencies),
            ]
            
            for step_name, step_func in steps:
                logger.info(f"📋 Step: {step_name}")
                if not step_func():
                    logger.error(f"❌ Setup failed at step: {step_name}")
                    success = False
                    break
                logger.info(f"✅ Step completed: {step_name}")
            
        elif args.command == "dev":
            # Development mode
            if not builder.check_prerequisites():
                success = False
            elif not builder.setup_environment():
                success = False
            elif not builder.install_python_dependencies():
                success = False
            elif not builder.install_frontend_dependencies():
                success = False
            elif not builder.setup_database():
                success = False
            elif not builder.build_docker_images():
                success = False
            elif not builder.start_services("development"):
                success = False
            elif not builder.health_check():
                success = False
            else:
                logger.info("🎉 Development environment ready!")
                logger.info("📊 Services running at:")
                logger.info("   • Frontend: http://localhost:3000")
                logger.info("   • Python API: http://localhost:8002")
                logger.info("   • Database: localhost:5432")
                logger.info("   • Redis: localhost:6379")
            
        elif args.command == "prod":
            # Production deployment
            if not builder.check_prerequisites():
                success = False
            elif not builder.setup_environment():
                success = False
            elif not builder.install_python_dependencies():
                success = False
            elif not builder.install_frontend_dependencies():
                success = False
            elif not builder.run_python_tests():
                logger.error("❌ Tests failed, aborting production deployment")
                success = False
            elif not builder.lint_python_code():
                logger.warning("⚠️ Linting issues found, continuing anyway...")
            elif not builder.setup_database():
                success = False
            elif not builder.build_docker_images():
                success = False
            elif not builder.start_services("production"):
                success = False
            elif not builder.health_check():
                success = False
            else:
                logger.info("🎉 Production deployment completed!")
                
        elif args.command == "test":
            success = builder.run_python_tests()
            
        elif args.command == "docker":
            # Docker-only deployment
            if not builder.check_prerequisites():
                success = False
            elif not builder.build_docker_images():
                success = False
            elif not builder.start_services("development"):
                success = False
            elif not builder.health_check():
                success = False
            else:
                logger.info("🎉 Docker deployment completed!")
                
        elif args.command == "clean":
            success = builder.clean_build_artifacts()
            
        elif args.command == "install":
            success = (
                builder.install_python_dependencies() and 
                builder.install_frontend_dependencies()
            )
            
        elif args.command == "lint":
            success = builder.lint_python_code()
            
        elif args.command == "build":
            success = builder.build_frontend()
            
        elif args.command == "start":
            success = builder.start_services("development")
            
        elif args.command == "start-prod":
            success = builder.start_services("production")
            
        elif args.command == "health":
            success = builder.health_check()
            
        elif args.command == "all":
            # Complete build pipeline
            steps = [
                ("Prerequisites Check", builder.check_prerequisites),
                ("Clean Artifacts", builder.clean_build_artifacts),
                ("Environment Setup", builder.setup_environment),
                ("Install Python Dependencies", builder.install_python_dependencies),
                ("Install Frontend Dependencies", builder.install_frontend_dependencies),
                ("Lint Code", builder.lint_python_code),
                ("Run Tests", builder.run_python_tests),
                ("Build Frontend", builder.build_frontend),
                ("Setup Database", builder.setup_database),
                ("Build Docker Images", builder.build_docker_images),
                ("Start Services", lambda: builder.start_services("development")),
                ("Health Check", builder.health_check),
            ]
            
            for step_name, step_func in steps:
                logger.info(f"🔄 {step_name}...")
                if not step_func():
                    logger.error(f"❌ {step_name} failed")
                    success = False
                    break
                logger.info(f"✅ {step_name} completed")
            
            if success:
                logger.info("🎉 Complete build pipeline finished successfully!")
                logger.info("📊 All services are running and healthy")
        
        # Final status
        logger.info("=" * 50)
        if success:
            logger.info(f"✅ Command '{args.command}' completed successfully!")
            sys.exit(0)
        else:
            logger.error(f"❌ Command '{args.command}' failed!")
            sys.exit(1)
    
    except KeyboardInterrupt:
        logger.info("🛑 Build interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"💥 Unexpected error: {e}")
        logger.exception("Full error traceback:")
        sys.exit(1)

if __name__ == "__main__":
    main()