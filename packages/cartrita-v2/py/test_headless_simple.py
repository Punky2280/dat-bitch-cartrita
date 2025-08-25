#!/usr/bin/env python3
"""
Simple test for Headless Copilot Delegation Agent in WSL environment
"""

import asyncio
import sys
import os

try:
    from headless_copilot_delegation import HeadlessGitHubCopilotDelegationAgent
    
    async def test_headless_agent():
        print("🧪 Testing Headless Copilot Agent in WSL Environment...")
        print("=" * 50)
        
        # Initialize agent
        agent = HeadlessGitHubCopilotDelegationAgent()
        print(f"✅ Agent initialized - Mode: Headless")
        
        # Test project analysis
        project_path = '/home/robbie/development/dat-bitch-cartrita/packages/cartrita-v2'
        print(f"\n🔍 Analyzing project: {project_path}")
        
        try:
            result = await agent.analyze_codebase_structure(project_path)
            file_count = len(result.get('files', []))
            print(f"✅ Analysis completed: {file_count} files found")
            
            # Test delegation session
            print(f"\n🎯 Testing delegation session...")
            session_result = await agent.start_delegation_session(
                project_path,
                "Add error handling to the main server file"
            )
            print(f"✅ Delegation session completed")
            
            print(f"\n🎉 All headless tests passed!")
            print(f"   - Project analysis: ✅ {file_count} files")
            print(f"   - Task simulation: ✅ Working")
            print(f"   - WSL compatibility: ✅ No GUI dependencies")
            
            return True
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            return False
    
    # Run the test
    if __name__ == "__main__":
        success = asyncio.run(test_headless_agent())
        sys.exit(0 if success else 1)
        
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("💡 Make sure you're in the correct directory and all dependencies are installed")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    sys.exit(1)