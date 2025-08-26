#!/usr/bin/env python3
"""
Test script to verify enhanced agent system prompts
"""
import sys
import os
import asyncio

# Add the py directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'py'))

from cartrita_core.agent_manager import AgentManager
from cartrita_core.agent_types import AgentType

async def test_enhanced_agents():
    """Test that agents have enhanced capabilities"""
    print("🚀 Testing Enhanced Agent System Prompts...")
    
    try:
        # Create agent manager (without API key for this test)
        manager = AgentManager(
            client=None,  # We won't need the client for this test
            tools_registry=None
        )
        
        # Check agent configurations
        print(f"✅ Agent Manager initialized")
        print(f"📊 Total agent configs loaded: {len(manager.agent_configs)}")
        
        if len(manager.agent_configs) == 0:
            print("⚠️ No agent configs found - this is expected without full initialization")
            return
        
        # Check if we have the expected enhanced agents
        expected_agents = [
            "supervisor_cartrita_v2",
            "research_agent_v2", 
            "writer_agent_v2",
            "vision_agent_v2",
            "computer_use_agent_v2",
            "code_writer_agent_v2"
        ]
        
        for agent_id in expected_agents:
            if agent_id in manager.agent_configs:
                config = manager.agent_configs[agent_id]
                prompt_length = len(config.system_prompt)
                capabilities_count = len(config.capabilities)
                
                print(f"✅ {agent_id}:")
                print(f"   📝 System prompt length: {prompt_length} chars")
                print(f"   🎯 Capabilities: {capabilities_count}")
                
                # Check for enhanced content indicators
                enhanced_indicators = [
                    "CORE RESPONSIBILITIES:",
                    "ADVANCED CAPABILITIES:",
                    "EXPERTISE:",
                    "SPECIALIZATIONS:",
                    "METHODOLOGY:"
                ]
                
                found_indicators = [ind for ind in enhanced_indicators 
                                  if ind in config.system_prompt]
                
                if found_indicators:
                    print(f"   🌟 Enhanced sections: {len(found_indicators)}")
                else:
                    print(f"   ⚠️ No enhanced content detected")
            else:
                print(f"❌ {agent_id} not found in configs")
        
        print("\n🎉 Agent Enhancement Test Complete!")
        
    except Exception as e:
        print(f"❌ Error testing enhanced agents: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_enhanced_agents())