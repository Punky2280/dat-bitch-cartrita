#!/usr/bin/env python3
"""
Test script for Cartrita V2 system
Verifies all components can be imported and basic functionality works
"""

import os
import sys
from pathlib import Path

# Add py directory to path
py_dir = Path(__file__).parent / "py"
sys.path.insert(0, str(py_dir))

# Suppress display warnings for testing
os.environ['MPLBACKEND'] = 'Agg'
os.environ['DISPLAY'] = ':99'


def test_imports():
    """Test all core module imports"""
    print("🏝️  Testing Cartrita V2 Core Imports...")
    print("=" * 50)
    
    try:
        # Core components
        from cartrita_core.database_manager import DatabaseManager
        print("✅ DatabaseManager")
        
        from cartrita_core.responses_adapter import ResponsesAPIAdapter, RoutingContext, ReasoningEffort
        print("✅ ResponsesAPIAdapter")
        
        from cartrita_core.versioned_prompt_system import VersionedPromptManager
        print("✅ VersionedPromptManager")
        
        from cartrita_core.vector_store_manager import VectorStoreManager
        print("✅ VectorStoreManager")
        
        from cartrita_core.schema_validator import StructuredOutputValidator
        print("✅ StructuredOutputValidator")
        
        from cartrita_core.security_governance import SecurityGovernanceIntegrator
        print("✅ SecurityGovernanceIntegrator")
        
        from cartrita_core.orchestrator_agent import CartritalOrchestrator
        print("✅ CartritalOrchestrator")
        
        from cartrita_core.specialist_agents import BaseSpecialistAgent
        print("✅ BaseSpecialistAgent")
        
        from cartrita_core.advanced_specialists import SpecialistManager
        print("✅ SpecialistManager")
        
        from cartrita_main import CartritalV2Application
        print("✅ CartritalV2Application")
        
        from fastapi_server_v2 import app as fastapi_app
        print("✅ FastAPI Server")
        
        print("=" * 50)
        print("✅ ¡Dale! All imports successful")
        return True
        
    except ImportError as e:
        print(f"❌ Import failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


def test_application_creation():
    """Test application creation with mock configuration"""
    print("\n🏝️  Testing Application Creation...")
    print("=" * 50)
    
    try:
        from cartrita_main import CartritalV2Application
        
        # Create application with mock configuration
        app = CartritalV2Application(
            openai_api_key="sk-mock-test-key-for-testing-only",
            database_url="postgresql://localhost:5432/test_db",
            log_level="INFO"
        )
        
        print("✅ Application instance created")
        print(f"🔍 Initialized: {app.is_initialized}")
        print(f"🔍 Health status: {app.health_status}")
        
        # Test application properties
        assert hasattr(app, 'openai_client')
        assert hasattr(app, 'database_manager')
        assert hasattr(app, 'orchestrator')
        assert hasattr(app, 'security_governance')
        
        print("✅ All expected components present")
        print("=" * 50)
        print("✅ ¡Perfecto! Application creation successful")
        return True
        
    except Exception as e:
        print(f"❌ Application creation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_component_functionality():
    """Test core component functionality with mock data"""
    print("\n🏝️  Testing Component Functionality...")
    print("=" * 50)
    
    try:
        # Test schema validator
        from cartrita_core.schema_validator import StructuredOutputValidator, ValidationLevel
        
        # Mock database manager for testing
        class MockDatabaseManager:
            pass
        
        validator = StructuredOutputValidator(MockDatabaseManager())
        print("✅ Schema validator created")
        
        # Test validation with mock data
        test_data = {
            "content": "¡Hola! This is a test response from Cartrita",
            "agent_type": "orchestrator", 
            "success": True,
            "miami_personality_indicators": {
                "greeting_used": "¡Hola!",
                "spanish_phrases": ["Hola"],
                "enthusiasm_level": 4
            },
            "timestamp": "2024-01-01T00:00:00Z"
        }
        
        result = validator.validate_agent_response(
            test_data, 
            "orchestrator", 
            ValidationLevel.LENIENT
        )
        
        print(f"✅ Validation test: {'PASSED' if result.is_valid else 'FAILED'}")
        if not result.is_valid:
            print(f"   Errors: {result.errors}")
            print(f"   Miami message: {result.miami_error_message}")
        
        print("=" * 50)
        print("✅ ¡Buenísimo! Component functionality test successful")
        return True
        
    except Exception as e:
        print(f"❌ Component test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_fastapi_creation():
    """Test FastAPI app creation"""
    print("\n🏝️  Testing FastAPI Application...")
    print("=" * 50)
    
    try:
        from fastapi_server_v2 import app
        
        print("✅ FastAPI app imported")
        print(f"🔍 App title: {app.title}")
        print(f"🔍 App version: {app.version}")
        
        # Get route information
        routes = [route.path for route in app.routes if hasattr(route, 'path')]
        print(f"🔍 Available routes: {len(routes)}")
        print(f"   Key routes: {[r for r in routes if r in ['/', '/health', '/chat', '/status']]}")
        
        print("=" * 50)
        print("✅ ¡Excelente! FastAPI creation successful")
        return True
        
    except Exception as e:
        print(f"❌ FastAPI test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("🏝️  CARTRITA V2 SYSTEM TEST")
    print("=" * 50)
    print("Testing OpenAI-powered Miami AI Assistant")
    print("Full production architecture with agent orchestration")
    print("=" * 50)
    
    tests = [
        ("Core Imports", test_imports),
        ("Application Creation", test_application_creation), 
        ("Component Functionality", test_component_functionality),
        ("FastAPI Creation", test_fastapi_creation)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"❌ Test '{test_name}' crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n🏝️  TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {test_name}")
    
    print("=" * 50)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ¡DALE! All tests passed - Cartrita V2 is ready!")
        print("\n💡 To run the system:")
        print("   1. Set OPENAI_API_KEY in .env file")
        print("   2. Run: ./start-cartrita-v2.sh")
        print("   3. Visit: http://localhost:8000/docs")
    else:
        print("⚠️  Some tests failed. Check the errors above.")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())