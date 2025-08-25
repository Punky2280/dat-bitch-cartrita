"""
Enhanced Agent Manager for Cartrita V2
Managing 13+ specialized AI agents with advanced capabilities
"""
import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from enum import Enum

import openai
from langchain.agents import AgentType, initialize_agent
from langchain.memory import ConversationBufferMemory
from langchain.tools import BaseTool
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentStatus(Enum):
    IDLE = "idle"
    ACTIVE = "active"
    BUSY = "busy"
    ERROR = "error"
    OFFLINE = "offline"

class AgentCapability(Enum):
    # Core capabilities
    RESEARCH = "research"
    WRITING = "writing"
    CODING = "coding"
    VISION = "vision"
    COMPUTER_USE = "computer_use"
    
    # Advanced capabilities
    DATA_ANALYSIS = "data_analysis"
    CYBERSECURITY = "cybersecurity"
    FINANCIAL_ANALYSIS = "financial_analysis"
    HEALTH_WELLNESS = "health_wellness"
    EDUCATIONAL_TUTOR = "educational_tutor"
    CREATIVE_DESIGNER = "creative_designer"
    PROJECT_MANAGER = "project_manager"
    BUSINESS_STRATEGY = "business_strategy"
    
    # Specialized capabilities
    EMOTIONAL_SUPPORT = "emotional_support"
    COMEDIAN = "comedian"
    API_KEY_MANAGER = "api_key_manager"
    SYSTEM_ADMIN = "system_admin"
    CONTENT_MODERATOR = "content_moderator"

class AgentConfiguration(BaseModel):
    id: str
    name: str
    description: str
    capabilities: List[AgentCapability]
    model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 2048
    system_prompt: str
    tools: List[str] = []
    memory_enabled: bool = True
    status: AgentStatus = AgentStatus.IDLE
    created_at: datetime = Field(default_factory=datetime.now)
    last_activity: datetime = Field(default_factory=datetime.now)

class EnhancedAgentManager:
    """Enhanced Agent Manager with 13+ specialized agents"""
    
    def __init__(self):
        self.agents: Dict[str, AgentConfiguration] = {}
        self.agent_memories: Dict[str, ConversationBufferMemory] = {}
        self.active_tasks: Dict[str, Dict] = {}
        self.openai_client = openai.AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY")
        )
        self._initialize_agents()
    
    def _initialize_agents(self):
        """Initialize all specialized agents"""
        agent_configs = [
            # Core Agents
            {
                "id": "supervisor_agent",
                "name": "Supervisor Agent",
                "description": "Coordinates with other agents and provides comprehensive responses",
                "capabilities": [AgentCapability.RESEARCH, AgentCapability.WRITING],
                "system_prompt": """You are the Supervisor Agent for Cartrita, a sophisticated AI assistant system. 
                Your role is to coordinate with specialized agents, analyze user requests, delegate tasks appropriately, 
                and synthesize responses from multiple agents into coherent, comprehensive answers. You have access to 
                13 specialized agents and can orchestrate complex multi-agent workflows.""",
                "tools": ["agent_delegation", "task_coordination", "response_synthesis"]
            },
            
            {
                "id": "research_agent",
                "name": "Research Agent",
                "description": "Specializes in gathering, analyzing, and synthesizing information",
                "capabilities": [AgentCapability.RESEARCH, AgentCapability.DATA_ANALYSIS],
                "system_prompt": """You are the Research Agent for Cartrita. You excel at gathering information from 
                multiple sources, fact-checking, analyzing data, and providing comprehensive research reports. You can 
                access web searches, academic databases, and perform deep analysis on complex topics.""",
                "tools": ["web_search", "data_analysis", "fact_checking", "citation_generation"]
            },
            
            {
                "id": "writer_agent",
                "name": "Writer Agent", 
                "description": "Creates clear, engaging, and well-structured content",
                "capabilities": [AgentCapability.WRITING, AgentCapability.CREATIVE_DESIGNER],
                "system_prompt": """You are the Writer Agent for Cartrita. You specialize in creating high-quality 
                content including articles, reports, creative writing, technical documentation, marketing copy, 
                and any form of written communication. You adapt your style to match the required tone and audience.""",
                "tools": ["content_generation", "style_adaptation", "grammar_check", "plagiarism_check"]
            },
            
            {
                "id": "vision_agent",
                "name": "Vision Agent",
                "description": "Analyzes and processes visual content and images",
                "capabilities": [AgentCapability.VISION, AgentCapability.CREATIVE_DESIGNER],
                "system_prompt": """You are the Vision Agent for Cartrita. You excel at analyzing images, diagrams, 
                charts, and visual content. You can describe images, extract text from images, analyze visual data, 
                identify objects, and provide detailed visual analysis reports.""",
                "tools": ["image_analysis", "ocr", "object_detection", "visual_qa"]
            },
            
            {
                "id": "computer_use_agent",
                "name": "Computer Use Agent",
                "description": "Helps with digital tasks and automation",
                "capabilities": [AgentCapability.COMPUTER_USE, AgentCapability.SYSTEM_ADMIN],
                "model": "gpt-4o-mini",
                "system_prompt": """You are the Computer Use Agent for Cartrita. You help users with computer tasks, 
                automation, file management, system operations, and digital workflows. You can interact with 
                applications, manage files, and automate repetitive tasks.""",
                "tools": ["file_operations", "system_commands", "automation_scripts", "process_management"]
            },
            
            {
                "id": "code_writer_agent", 
                "name": "Code Writer Agent",
                "description": "Programming and software development specialist",
                "capabilities": [AgentCapability.CODING, AgentCapability.SYSTEM_ADMIN],
                "system_prompt": """You are the Code Writer Agent for Cartrita. You specialize in software development, 
                code generation, debugging, code reviews, architecture design, and technical problem-solving across 
                multiple programming languages and frameworks.""",
                "tools": ["code_generation", "code_analysis", "debugging", "testing", "documentation"]
            },
            
            # Advanced Specialized Agents
            {
                "id": "data_scientist_agent",
                "name": "Data Scientist Agent",
                "description": "Advanced data analysis, machine learning, and statistical modeling",
                "capabilities": [AgentCapability.DATA_ANALYSIS, AgentCapability.RESEARCH],
                "system_prompt": """You are the Data Scientist Agent for Cartrita. You excel at data analysis, 
                statistical modeling, machine learning, data visualization, and extracting insights from complex 
                datasets. You can work with various data formats and provide actionable recommendations.""",
                "tools": ["data_analysis", "statistical_modeling", "ml_modeling", "data_visualization"]
            },
            
            {
                "id": "cybersecurity_agent",
                "name": "Cybersecurity Agent", 
                "description": "Security analysis, threat assessment, and protection strategies",
                "capabilities": [AgentCapability.CYBERSECURITY, AgentCapability.SYSTEM_ADMIN],
                "system_prompt": """You are the Cybersecurity Agent for Cartrita. You specialize in cybersecurity 
                analysis, threat detection, vulnerability assessment, security best practices, and creating protection 
                strategies. You help users secure their digital assets and understand security risks.""",
                "tools": ["security_scan", "vulnerability_assessment", "threat_analysis", "security_recommendations"]
            },
            
            {
                "id": "financial_analyst_agent",
                "name": "Financial Analyst Agent",
                "description": "Financial analysis, market research, and investment insights", 
                "capabilities": [AgentCapability.FINANCIAL_ANALYSIS, AgentCapability.DATA_ANALYSIS],
                "system_prompt": """You are the Financial Analyst Agent for Cartrita. You provide financial analysis, 
                market research, investment insights, budgeting advice, and economic analysis. You can analyze 
                financial statements, market trends, and provide investment recommendations.""",
                "tools": ["financial_analysis", "market_research", "portfolio_analysis", "risk_assessment"]
            },
            
            {
                "id": "health_wellness_agent",
                "name": "Health & Wellness Agent",
                "description": "Health information, wellness tips, and lifestyle guidance",
                "capabilities": [AgentCapability.HEALTH_WELLNESS, AgentCapability.RESEARCH],
                "system_prompt": """You are the Health & Wellness Agent for Cartrita. You provide health information, 
                wellness tips, fitness guidance, nutrition advice, and lifestyle recommendations. You always emphasize 
                that you're not a replacement for professional medical advice.""",
                "tools": ["health_info", "nutrition_analysis", "fitness_planning", "wellness_tracking"]
            },
            
            {
                "id": "educational_tutor_agent",
                "name": "Educational Tutor Agent",
                "description": "Personalized learning, tutoring, and educational content creation",
                "capabilities": [AgentCapability.EDUCATIONAL_TUTOR, AgentCapability.WRITING],
                "system_prompt": """You are the Educational Tutor Agent for Cartrita. You provide personalized 
                learning experiences, tutoring across various subjects, create educational content, and adapt 
                your teaching style to individual learning needs.""",
                "tools": ["curriculum_design", "quiz_generation", "learning_assessment", "study_planning"]
            },
            
            {
                "id": "project_manager_agent",
                "name": "Project Manager Agent",
                "description": "Project planning, task management, and workflow optimization",
                "capabilities": [AgentCapability.PROJECT_MANAGER, AgentCapability.BUSINESS_STRATEGY],
                "system_prompt": """You are the Project Manager Agent for Cartrita. You excel at project planning, 
                task management, resource allocation, timeline creation, and workflow optimization. You help users 
                organize and execute projects efficiently.""",
                "tools": ["project_planning", "task_management", "resource_allocation", "timeline_creation"]
            },
            
            # Specialized Support Agents
            {
                "id": "emotional_support_agent",
                "name": "Emotional Support Agent", 
                "description": "Provides empathetic support, active listening, and emotional guidance",
                "capabilities": [AgentCapability.EMOTIONAL_SUPPORT, AgentCapability.HEALTH_WELLNESS],
                "temperature": 0.8,
                "system_prompt": """You are the Emotional Support Agent for Cartrita. You provide empathetic, 
                compassionate support to users. You're an excellent listener, offer emotional guidance, and help 
                users process their feelings. You're warm, understanding, and always maintain appropriate boundaries. 
                You encourage professional help when needed.""",
                "tools": ["emotion_analysis", "coping_strategies", "mindfulness_exercises", "crisis_resources"]
            },
            
            {
                "id": "comedian_agent",
                "name": "Comedian Agent",
                "description": "Brings humor, entertainment, and light-hearted interactions",
                "capabilities": [AgentCapability.COMEDIAN, AgentCapability.CREATIVE_DESIGNER],
                "temperature": 0.9,
                "system_prompt": """You are the Comedian Agent for Cartrita. Your job is to bring joy, humor, and 
                entertainment to users. You can tell jokes, create funny content, lighten the mood, and provide 
                comedic relief. You're witty, clever, and always appropriate in your humor.""",
                "tools": ["joke_generation", "humor_analysis", "comedy_writing", "entertainment_content"]
            },
            
            {
                "id": "api_key_manager_agent",
                "name": "API Key Manager Agent",
                "description": "Manages API keys, integrations, and service configurations",
                "capabilities": [AgentCapability.API_KEY_MANAGER, AgentCapability.SYSTEM_ADMIN],
                "system_prompt": """You are the API Key Manager Agent for Cartrita. You specialize in managing API 
                keys, service integrations, configuration management, and ensuring secure access to external services. 
                You help users set up and manage their API integrations safely.""",
                "tools": ["key_management", "service_integration", "security_validation", "config_management"]
            }
        ]
        
        # Initialize each agent configuration
        for config in agent_configs:
            agent_id = config["id"]
            self.agents[agent_id] = AgentConfiguration(**config)
            
            # Initialize memory for each agent
            if config.get("memory_enabled", True):
                self.agent_memories[agent_id] = ConversationBufferMemory(
                    memory_key="chat_history",
                    return_messages=True
                )
        
        logger.info(f"Initialized {len(self.agents)} specialized agents")
    
    async def get_agent(self, agent_id: str) -> Optional[AgentConfiguration]:
        """Get agent configuration by ID"""
        return self.agents.get(agent_id)
    
    async def list_agents(self) -> List[AgentConfiguration]:
        """List all available agents"""
        return list(self.agents.values())
    
    async def get_agents_by_capability(self, capability: AgentCapability) -> List[AgentConfiguration]:
        """Get agents that have a specific capability"""
        return [agent for agent in self.agents.values() if capability in agent.capabilities]
    
    async def update_agent_status(self, agent_id: str, status: AgentStatus):
        """Update agent status"""
        if agent_id in self.agents:
            self.agents[agent_id].status = status
            self.agents[agent_id].last_activity = datetime.now()
    
    async def execute_with_agent(self, agent_id: str, message: str, context: Dict = None) -> Dict:
        """Execute a task with a specific agent"""
        if agent_id not in self.agents:
            raise ValueError(f"Agent {agent_id} not found")
        
        agent = self.agents[agent_id]
        await self.update_agent_status(agent_id, AgentStatus.ACTIVE)
        
        try:
            # Build conversation context
            messages = [
                {"role": "system", "content": agent.system_prompt}
            ]
            
            # Add context if provided
            if context:
                context_msg = f"Context: {json.dumps(context, indent=2)}"
                messages.append({"role": "system", "content": context_msg})
            
            # Add user message
            messages.append({"role": "user", "content": message})
            
            # Execute with OpenAI
            response = await self.openai_client.chat.completions.create(
                model=agent.model,
                messages=messages,
                temperature=agent.temperature,
                max_tokens=agent.max_tokens
            )
            
            result = {
                "success": True,
                "agent_id": agent_id,
                "agent_name": agent.name,
                "content": response.choices[0].message.content,
                "model_used": agent.model,
                "capabilities": [cap.value for cap in agent.capabilities],
                "tools_available": agent.tools,
                "timestamp": datetime.now().isoformat()
            }
            
            await self.update_agent_status(agent_id, AgentStatus.IDLE)
            return result
            
        except Exception as e:
            logger.error(f"Error executing task with agent {agent_id}: {e}")
            await self.update_agent_status(agent_id, AgentStatus.ERROR)
            return {
                "success": False,
                "agent_id": agent_id,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def coordinate_multi_agent_task(self, task: str, required_capabilities: List[AgentCapability]) -> Dict:
        """Coordinate a task across multiple agents based on required capabilities"""
        try:
            # Find suitable agents for each capability
            agent_assignments = {}
            for capability in required_capabilities:
                suitable_agents = await self.get_agents_by_capability(capability)
                if suitable_agents:
                    # Pick the first available agent (could be enhanced with load balancing)
                    agent_assignments[capability.value] = suitable_agents[0].id
            
            if not agent_assignments:
                return {
                    "success": False,
                    "error": "No suitable agents found for required capabilities",
                    "required_capabilities": [cap.value for cap in required_capabilities]
                }
            
            # Execute task with assigned agents
            results = {}
            for capability, agent_id in agent_assignments.items():
                agent_task = f"{task}\n\nFocus on your {capability} capabilities for this task."
                result = await self.execute_with_agent(agent_id, agent_task)
                results[capability] = result
            
            # Synthesize results using supervisor agent
            synthesis_prompt = f"""
            Task: {task}
            
            Agent Results:
            {json.dumps(results, indent=2)}
            
            Please synthesize these results into a comprehensive response that combines insights from all agents.
            """
            
            final_result = await self.execute_with_agent("supervisor_agent", synthesis_prompt)
            final_result["multi_agent_results"] = results
            final_result["coordinated_capabilities"] = list(agent_assignments.keys())
            
            return final_result
            
        except Exception as e:
            logger.error(f"Error coordinating multi-agent task: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def get_agent_status_report(self) -> Dict:
        """Get comprehensive status report for all agents"""
        status_counts = {}
        agent_details = []
        
        for agent_id, agent in self.agents.items():
            status_counts[agent.status.value] = status_counts.get(agent.status.value, 0) + 1
            agent_details.append({
                "id": agent_id,
                "name": agent.name,
                "status": agent.status.value,
                "capabilities": [cap.value for cap in agent.capabilities],
                "last_activity": agent.last_activity.isoformat(),
                "model": agent.model
            })
        
        return {
            "total_agents": len(self.agents),
            "status_summary": status_counts,
            "agent_details": agent_details,
            "timestamp": datetime.now().isoformat()
        }
    
    async def recommend_agent(self, user_query: str) -> Dict:
        """Recommend the best agent(s) for a user query"""
        try:
            # Use supervisor agent to analyze the query and recommend agents
            analysis_prompt = f"""
            Analyze this user query and recommend the best agent(s) from Cartrita's system:
            
            Query: "{user_query}"
            
            Available agents:
            {json.dumps([{"id": agent.id, "name": agent.name, "description": agent.description, "capabilities": [cap.value for cap in agent.capabilities]} for agent in self.agents.values()], indent=2)}
            
            Provide your recommendation with reasoning.
            """
            
            recommendation = await self.execute_with_agent("supervisor_agent", analysis_prompt)
            return recommendation
            
        except Exception as e:
            logger.error(f"Error recommending agent: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

# Global instance
enhanced_agent_manager = EnhancedAgentManager()