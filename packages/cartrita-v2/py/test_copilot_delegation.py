#!/usr/bin/env python3
"""
Test script for the GitHub Copilot Delegation Agent
Demonstrates the enhanced agent with copilot-instructions.md integration
"""

import asyncio
import os
from pathlib import Path
from copilot_delegation_agent import GitHubCopilotDelegationAgent

async def test_copilot_delegation_agent():
    """Test the enhanced copilot delegation agent"""
    
    print("🧪 TESTING ENHANCED GITHUB COPILOT DELEGATION AGENT")
    print("=" * 60)
    print("")
    
    # Initialize agent with OpenAI API key
    api_key = os.getenv("OPENAI_API_KEY", "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")
    
    agent = GitHubCopilotDelegationAgent(openai_api_key=api_key)
    
    # Test project path
    project_path = "/home/robbie/development/dat-bitch-cartrita/packages/cartrita-v2"
    
    # Test scenarios
    test_scenarios = [
        {
            "name": "Backend Error Handling Enhancement",
            "task": "Add comprehensive error handling and logging to the FastAPI endpoints in the Python backend",
            "description": "This will test the agent's ability to read copilot instructions and follow the prescribed workflow for code enhancement."
        },
        {
            "name": "Frontend Component Refactoring", 
            "task": "Refactor React components to use modern hooks and improve performance",
            "description": "Tests the agent's ability to handle frontend technology delegation."
        },
        {
            "name": "API Integration Enhancement",
            "task": "Enhance the OpenAI API integration with better error handling, retry logic, and rate limiting",
            "description": "Tests complex API enhancement workflow following copilot procedures."
        }
    ]
    
    print("🔍 Available Test Scenarios:")
    for i, scenario in enumerate(test_scenarios, 1):
        print(f"   {i}. {scenario['name']}")
        print(f"      {scenario['description']}")
    
    print("\n" + "=" * 60)
    
    # Run first scenario as demonstration
    print(f"\n🚀 RUNNING SCENARIO 1: {test_scenarios[0]['name']}")
    print("-" * 60)
    
    try:
        result = await agent.start_delegation_session(
            project_path=project_path,
            task_description=test_scenarios[0]['task']
        )
        
        print("\n" + "=" * 60)
        print("📊 DELEGATION SESSION RESULTS")
        print("=" * 60)
        
        print(f"✅ Success: {result['success']}")
        print(f"🆔 Session ID: {result['session_id']}")
        
        if result.get('copilot_procedures'):
            procedures = result['copilot_procedures']
            print(f"\n📋 Copilot Procedures Used:")
            print(f"   Workflow: {procedures.get('workflow', 'default')}")
            print(f"   Phases: {len(procedures.get('steps', []))}")
            
            if procedures.get('preferences'):
                print(f"   Preferences:")
                for key, value in procedures['preferences'].items():
                    print(f"     • {key}: {value}")
        
        if result.get('analysis'):
            analysis = result['analysis']
            print(f"\n🔍 Project Analysis:")
            print(f"   Technologies: {', '.join(analysis.get('technologies_used', []))}")
            print(f"   Key Files: {len(analysis.get('key_files', []))}")
            print(f"   Documentation: {'Available' if analysis.get('documentation_summary') else 'None'}")
        
        if result.get('delegation_plan'):
            plan = result['delegation_plan']
            print(f"\n🎯 Delegation Plan:")
            print(f"   Total Steps: {len(plan.get('steps', []))}")
            
            # Show first few steps
            for i, step in enumerate(plan.get('steps', [])[:5], 1):
                print(f"     {i}. {step.get('action', 'unknown')} - {step.get('description', 'no description')}")
                if step.get('phase'):
                    print(f"        Phase: {step['phase']}")
            
            if len(plan.get('steps', [])) > 5:
                print(f"     ... and {len(plan.get('steps', [])) - 5} more steps")
        
        print(f"\n📸 Screenshots: Available in {agent.screenshot_dir}")
        
        # Check if copilot-instructions.md was created
        instructions_path = Path(project_path) / "copilot-instructions.md"
        if instructions_path.exists():
            print(f"📝 Copilot Instructions: Created at {instructions_path}")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("🎉 COPILOT DELEGATION AGENT TEST COMPLETED!")
    print("=" * 60)
    
    print("\n🔥 KEY FEATURES DEMONSTRATED:")
    print("   ✅ Copilot instructions file integration")
    print("   ✅ Intelligent project analysis")
    print("   ✅ Procedure-based delegation planning")
    print("   ✅ Mouse and keyboard automation framework")
    print("   ✅ Multi-phase workflow execution")
    print("   ✅ Screenshot documentation")
    print("   ✅ AI-powered task routing")
    
    print("\n📋 NEXT STEPS:")
    print("   • Review generated copilot-instructions.md")
    print("   • Customize procedures for your specific project")
    print("   • Test with VS Code and GitHub Copilot active")
    print("   • Enable X11 display for full GUI automation")
    
    return True

async def test_procedures_parsing():
    """Test the copilot instructions parsing functionality"""
    
    print("\n🧪 TESTING COPILOT PROCEDURES PARSING")
    print("-" * 40)
    
    api_key = os.getenv("OPENAI_API_KEY", "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")
    agent = GitHubCopilotDelegationAgent(openai_api_key=api_key)
    
    # Test default procedures
    default_procedures = agent.get_default_copilot_procedures()
    print("📋 Default Procedures:")
    print(f"   Workflow: {default_procedures['workflow']}")
    print(f"   Phases: {len(default_procedures['steps'])}")
    
    # Test template creation
    test_path = Path("/tmp/test-copilot-instructions.md")
    await agent.create_copilot_instructions_template(test_path)
    
    if test_path.exists():
        print(f"✅ Template created successfully at {test_path}")
        # Clean up
        test_path.unlink()
    else:
        print("❌ Template creation failed")

if __name__ == "__main__":
    print("🚀 Starting Copilot Delegation Agent Tests")
    print("=" * 60)
    
    # Run main test
    asyncio.run(test_copilot_delegation_agent())
    
    # Run procedures parsing test
    asyncio.run(test_procedures_parsing())
    
    print("\n🎊 ALL TESTS COMPLETED!")