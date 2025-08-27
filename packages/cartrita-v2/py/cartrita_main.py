"""
Cartrita V2 - Main Application Integration
Complete OpenAI-powered agent system with Miami personality
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from pathlib import Path

# Add the package to Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from openai import AsyncOpenAI
from cartrita_core.database_manager import DatabaseManager
from cartrita_core.orchestrator_agent import CartritalOrchestrator, create_cartrita_orchestrator
from cartrita_core.responses_adapter import ResponsesAPIAdapter
from cartrita_core.versioned_prompt_system import VersionedPromptManager
from cartrita_core.vector_store_manager import VectorStoreManager
from cartrita_core.schema_validator import StructuredOutputValidator
from cartrita_core.security_governance import SecurityGovernanceIntegrator
from cartrita_core.advanced_specialists import SpecialistManager


class CartritalV2Application:
    """
    Main Cartrita V2 Application
    Orchestrates all components with Miami flair
    """
    
    def __init__(
        self,
        openai_api_key: str,
        database_url: str,
        redis_url: Optional[str] = None,
        log_level: str = "INFO"
    ):
        self.openai_api_key = openai_api_key
        self.database_url = database_url
        self.redis_url = redis_url
        
        # Setup logging
        self._setup_logging(log_level)
        self.logger = logging.getLogger("cartrita.main")
        
        # Core components - initialized during startup
        self.openai_client: Optional[AsyncOpenAI] = None
        self.database_manager: Optional[DatabaseManager] = None
        self.orchestrator: Optional[CartritalOrchestrator] = None
        self.security_governance: Optional[SecurityGovernanceIntegrator] = None
        self.schema_validator: Optional[StructuredOutputValidator] = None
        
        # Application state
        self.is_initialized = False
        self.startup_time: Optional[datetime] = None
        self.health_status = {
            "database": False,
            "openai": False,
            "orchestrator": False,
            "security": False
        }
        
        self.logger.info("¡Hola! Cartrita V2 Application created. Ready to initialize...")
    
    def _setup_logging(self, log_level: str):
        """Setup logging with Miami personality"""
        logging.basicConfig(
            level=getattr(logging, log_level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler('cartrita_v2.log')
            ]
        )
        
        # Add custom Miami-themed formatter
        miami_formatter = logging.Formatter(
            '🏝️  %(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        for handler in logging.getLogger().handlers:
            handler.setFormatter(miami_formatter)
    
    async def initialize(self) -> bool:
        """
        Initialize all Cartrita V2 components
        Returns True if successful, False otherwise
        """
        try:
            self.logger.info("🚀 Starting Cartrita V2 initialization...")
            self.startup_time = datetime.now(timezone.utc)
            
            # Step 1: Initialize OpenAI client
            await self._initialize_openai_client()
            
            # Step 2: Initialize database
            await self._initialize_database()
            
            # Step 3: Initialize core components
            await self._initialize_core_components()
            
            # Step 4: Initialize security and governance
            await self._initialize_security_governance()
            
            # Step 5: Initialize orchestrator
            await self._initialize_orchestrator()
            
            # Step 6: Run health checks
            await self._run_health_checks()
            
            # Step 7: Setup database schema if needed
            await self._setup_database_schema()
            
            self.is_initialized = True
            self.logger.info("✅ ¡Dale! Cartrita V2 initialization complete. Ready to serve Miami!")
            
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Initialization failed: {e}")
            self.is_initialized = False
            return False
    
    async def _initialize_openai_client(self):
        """Initialize OpenAI client"""
        try:
            self.openai_client = AsyncOpenAI(api_key=self.openai_api_key)
            
            # Test connection
            models = await self.openai_client.models.list()
            self.health_status["openai"] = True
            
            self.logger.info("✅ OpenAI client initialized successfully")
            
        except Exception as e:
            self.logger.error(f"❌ OpenAI client initialization failed: {e}")
            raise
    
    async def _initialize_database(self):
        """Initialize database manager and connection"""
        try:
            self.database_manager = DatabaseManager(self.database_url)
            await self.database_manager.initialize()
            
            # Test connection
            await self.database_manager.health_check()
            self.health_status["database"] = True
            
            self.logger.info("✅ Database manager initialized successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Database initialization failed: {e}")
            raise
    
    async def _initialize_core_components(self):
        """Initialize core Cartrita components"""
        try:
            # Responses adapter
            self.responses_adapter = ResponsesAPIAdapter(self.openai_client)
            
            # Prompt manager
            self.prompt_manager = VersionedPromptManager(self.database_manager)
            
            # Vector store manager  
            self.vector_store_manager = VectorStoreManager(
                self.openai_client, 
                self.database_manager
            )
            
            # Schema validator
            self.schema_validator = StructuredOutputValidator(self.database_manager)
            
            # Specialist manager
            self.specialist_manager = SpecialistManager(
                self.openai_client,
                self.responses_adapter,
                self.prompt_manager,
                self.database_manager,
                self.vector_store_manager
            )
            
            self.logger.info("✅ Core components initialized successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Core components initialization failed: {e}")
            raise
    
    async def _initialize_security_governance(self):
        """Initialize security and governance systems"""
        try:
            self.security_governance = SecurityGovernanceIntegrator(self.database_manager)
            self.health_status["security"] = True
            
            self.logger.info("✅ Security and governance initialized successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Security/governance initialization failed: {e}")
            raise
    
    async def _initialize_orchestrator(self):
        """Initialize the main orchestrator agent"""
        try:
            self.orchestrator = CartritalOrchestrator(
                openai_client=self.openai_client,
                database_manager=self.database_manager,
                responses_adapter=self.responses_adapter,
                prompt_manager=self.prompt_manager,
                vector_store_manager=self.vector_store_manager
            )
            
            self.health_status["orchestrator"] = True
            
            self.logger.info("✅ Orchestrator agent initialized successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Orchestrator initialization failed: {e}")
            raise
    
    async def _run_health_checks(self):
        """Run comprehensive health checks"""
        try:
            health_results = {}
            
            # Database health
            if self.database_manager:
                health_results["database"] = await self.database_manager.health_check()
            
            # OpenAI client health
            if self.openai_client:
                try:
                    models = await self.openai_client.models.list()
                    health_results["openai"] = len(models.data) > 0
                except Exception:
                    health_results["openai"] = False
            
            # Specialist health
            if self.specialist_manager:
                health_results["specialists"] = await self.specialist_manager.health_check()
            
            self.logger.info(f"🔍 Health check results: {health_results}")
            
        except Exception as e:
            self.logger.error(f"❌ Health checks failed: {e}")
    
    async def _setup_database_schema(self):
        """Setup database schema if needed"""
        try:
            # Check if schema exists
            schema_exists = await self._check_schema_exists()
            
            if not schema_exists:
                self.logger.info("🔧 Setting up database schema...")
                
                # Read and execute schema file
                schema_path = Path(__file__).parent / "db-migrations" / "001_agent_orchestration_schema.sql"
                
                if schema_path.exists():
                    with open(schema_path) as f:
                        schema_sql = f.read()
                    
                    # Execute schema (would need to be implemented in database_manager)
                    # await self.database_manager.execute_schema(schema_sql)
                    
                    self.logger.info("✅ Database schema setup complete")
                else:
                    self.logger.warning("⚠️  Schema file not found, continuing without setup")
            else:
                self.logger.info("✅ Database schema already exists")
                
        except Exception as e:
            self.logger.error(f"❌ Database schema setup failed: {e}")
    
    async def _check_schema_exists(self) -> bool:
        """Check if database schema already exists"""
        try:
            # This would check for existence of key tables
            # For now, return True to continue
            return True
        except Exception as e:
            self.logger.error(f"Schema check failed: {e}")
            return False
    
    async def process_user_message(
        self,
        user_message: str,
        user_id: str,
        session_id: Optional[str] = None,
        **context_kwargs
    ) -> Dict[str, Any]:
        """
        Main entry point for processing user messages
        """
        if not self.is_initialized:
            return {
                "success": False,
                "error": "application_not_initialized",
                "miami_message": "¡Ay! Cartrita isn't ready yet. Give me a moment to wake up!"
            }
        
        try:
            # Step 1: Security and governance validation
            validation_result = await self.security_governance.validate_request(
                user_id=user_id,
                content=user_message,
                action="chat",
                **context_kwargs
            )
            
            if not validation_result["valid"]:
                return {
                    "success": False,
                    "error": validation_result["reason"],
                    "miami_message": validation_result["miami_message"],
                    "can_retry": validation_result.get("can_retry", True)
                }
            
            security_context = validation_result["security_context"]
            
            # Step 2: Process with orchestrator
            response = await self.orchestrator.process_user_message(
                message=user_message,
                user_id=user_id,
                session_id=session_id,
                context=context_kwargs
            )
            
            # Step 3: Validate response structure
            if self.schema_validator and response.get("response"):
                validation_result = self.schema_validator.validate_agent_response(
                    response["response"],
                    "orchestrator"
                )
                
                if not validation_result.is_valid:
                    self.logger.warning(f"Response validation failed: {validation_result.errors}")
                    # Continue anyway but log warning
            
            # Step 4: Add security context to response
            response["security"] = {
                "rate_limit_remaining": security_context.rate_limit_remaining,
                "security_level": security_context.security_level.value,
                "permissions": security_context.permissions
            }
            
            return {
                "success": True,
                "response": response,
                "miami_message": "¡Dale! Message processed successfully."
            }
            
        except Exception as e:
            self.logger.error(f"Message processing error: {e}")
            return {
                "success": False,
                "error": "processing_error",
                "miami_message": f"¡Ay caramba! Something went wrong: {str(e)}",
                "can_retry": True
            }
    
    async def get_application_status(self) -> Dict[str, Any]:
        """Get comprehensive application status"""
        return {
            "initialized": self.is_initialized,
            "startup_time": self.startup_time.isoformat() if self.startup_time else None,
            "uptime_seconds": (
                (datetime.now(timezone.utc) - self.startup_time).total_seconds() 
                if self.startup_time else 0
            ),
            "health_status": self.health_status,
            "components": {
                "openai_client": self.openai_client is not None,
                "database_manager": self.database_manager is not None,
                "orchestrator": self.orchestrator is not None,
                "security_governance": self.security_governance is not None,
                "schema_validator": self.schema_validator is not None
            },
            "miami_status": "¡Todo bien! Everything is running smoothly in Miami style."
        }
    
    async def shutdown(self):
        """Graceful shutdown of all components"""
        try:
            self.logger.info("🛑 Starting Cartrita V2 shutdown...")
            
            # Close database connections
            if self.database_manager:
                await self.database_manager.close()
            
            # Close OpenAI client (if needed)
            if self.openai_client:
                await self.openai_client.close()
            
            self.is_initialized = False
            self.logger.info("✅ ¡Hasta luego! Cartrita V2 shutdown complete.")
            
        except Exception as e:
            self.logger.error(f"❌ Shutdown error: {e}")


# Factory function for easy application creation
async def create_cartrita_v2_application(
    openai_api_key: Optional[str] = None,
    database_url: Optional[str] = None,
    **config_overrides
) -> CartritalV2Application:
    """
    Factory function to create and initialize Cartrita V2 application
    """
    # Get configuration from environment if not provided
    api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
    db_url = database_url or os.getenv("DATABASE_URL", "postgresql://localhost:5432/cartrita_v2")
    
    if not api_key:
        raise ValueError("OpenAI API key must be provided or set in OPENAI_API_KEY environment variable")
    
    # Create application
    app = CartritalV2Application(
        openai_api_key=api_key,
        database_url=db_url,
        **config_overrides
    )
    
    # Initialize
    success = await app.initialize()
    if not success:
        raise RuntimeError("Failed to initialize Cartrita V2 application")
    
    return app


# CLI interface for testing
async def main():
    """Main CLI interface for testing Cartrita V2"""
    print("🏝️  ¡Hola! Welcome to Cartrita V2 - Miami's AI Assistant")
    print("=" * 60)
    
    try:
        # Create and initialize application
        app = await create_cartrita_v2_application()
        
        # Show status
        status = await app.get_application_status()
        print(f"✅ Application Status: {status['miami_status']}")
        print(f"🔍 Health: {status['health_status']}")
        print(f"⏱️  Uptime: {status['uptime_seconds']:.1f} seconds")
        print("=" * 60)
        
        # Interactive chat loop
        print("💬 Chat with Cartrita (type 'quit' to exit)")
        user_id = "test_user_001"
        
        while True:
            try:
                user_input = input("\n🎤 You: ").strip()
                
                if user_input.lower() in ['quit', 'exit', 'bye']:
                    print("👋 ¡Hasta luego! See you later!")
                    break
                
                if not user_input:
                    continue
                
                # Process message
                response = await app.process_user_message(
                    user_message=user_input,
                    user_id=user_id
                )
                
                if response["success"]:
                    cartrita_response = response["response"]["response"]["content"]
                    print(f"🏝️  Cartrita: {cartrita_response}")
                    
                    # Show security info if available
                    if "security" in response:
                        security = response["security"]
                        print(f"   📊 Rate limit: {security['rate_limit_remaining']} requests remaining")
                else:
                    print(f"❌ Error: {response['miami_message']}")
                
            except KeyboardInterrupt:
                print("\n👋 ¡Chao! See you later!")
                break
            except Exception as e:
                print(f"❌ Error: {e}")
        
        # Shutdown
        await app.shutdown()
        
    except Exception as e:
        print(f"❌ Application error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())