"""
Cartrita V2 - Agent Manager
Orchestrates multiple agents using OpenAI Responses API
Manages delegation, task routing, and agent lifecycle
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field
from enum import Enum

from openai import AsyncOpenAI

from .cartrita_agent import (
    CartritaCoreAgent, AgentTask, AgentContext, TaskPriority, 
    AgentStatus, CartritaResponse
)
from .tools import CartritaToolRegistry
from .responses_api import CartritaResponsesClient


class AgentType(Enum):
    SUPERVISOR = "supervisor"
    RESEARCH = "research"
    WRITER = "writer"
    VISION = "vision"
    COMPUTER_USE = "computer_use"
    CODE_WRITER = "code_writer"
    ANALYST = "analyst"
    CUSTOM = "custom"


@dataclass
class AgentConfig:
    agent_type: AgentType
    model: str = "gpt-4o"
    computer_use_enabled: bool = False
    max_iterations: int = 10
    tools_allowed: List[str] = field(default_factory=list)
    system_prompt: Optional[str] = None
    capabilities: List[str] = field(default_factory=list)


def get_model_for_agent(agent_type: str) -> str:
    """Get the appropriate model for each agent type from environment variables"""
    model_map = {
        'supervisor': os.getenv('SUPERVISOR_AGENT_MODEL', 'gpt-4o'),
        'research': os.getenv('RESEARCH_AGENT_MODEL', 'gpt-4o'),
        'writer': os.getenv('WRITER_AGENT_MODEL', 'gpt-4o'),
        'vision': os.getenv('VISION_AGENT_MODEL', 'gpt-4o'),
        'computer_use': os.getenv('COMPUTER_USE_AGENT_MODEL', 'gpt-4o-mini'),
        'code_writer': os.getenv('CODE_WRITER_AGENT_MODEL', 'gpt-4o'),
    }
    return model_map.get(agent_type, 'gpt-4o')


class CartritaAgentManager:
    """
    Manages multiple Cartrita agents and orchestrates task delegation
    Uses OpenAI Responses API for agent coordination
    """
    
    def __init__(
        self,
        openai_client: Optional[AsyncOpenAI] = None,
        tools_registry: Optional[CartritaToolRegistry] = None,
        logger: Optional[logging.Logger] = None,
        max_concurrent_tasks: int = 10
    ):
        self.client = openai_client or AsyncOpenAI()
        self.tools_registry = tools_registry or CartritaToolRegistry()
        self.logger = logger or logging.getLogger("cartrita.agent_manager")
        self.max_concurrent_tasks = max_concurrent_tasks
        
        # Agent registry
        self.agents: Dict[str, CartritaCoreAgent] = {}
        self.agent_configs: Dict[str, AgentConfig] = {}
        
        # Task management
        self.active_tasks: Dict[str, AgentTask] = {}
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self.task_results: Dict[str, CartritaResponse] = {}
        
        # Delegation tracking
        self.delegation_history: List[Dict] = []
        self.agent_performance: Dict[str, Dict] = {}
        
        # Manager state
        self.is_running = False
        self.supervisor_agent_id = "supervisor_cartrita_v2"
        
        # Initialize default agents
        asyncio.create_task(self._initialize_default_agents())
    
    async def _initialize_default_agents(self):
        """Initialize standard agent types"""
        await asyncio.sleep(0.1)  # Allow manager to initialize first
        
        # Supervisor agent - coordinates all other agents
        await self.create_agent(
            agent_id=self.supervisor_agent_id,
            config=AgentConfig(
                agent_type=AgentType.SUPERVISOR,
                model=get_model_for_agent("supervisor"),
                tools_allowed=["delegate_task", "get_agent_status", "web_search", "file_read", "file_write"],
                system_prompt="""You are the Supervisor Agent, the master coordinator of Cartrita V2's advanced AI orchestration platform. You are the primary interface between users and the specialized agent ecosystem.

CORE RESPONSIBILITIES:
- Multi-agent coordination and strategic orchestration
- Complex problem decomposition and solution architecture
- Task delegation to appropriate specialist agents
- Cross-domain knowledge synthesis and integration
- Workflow management and process optimization
- Quality assurance and result validation

ADVANCED CAPABILITIES:
- Analyze complex requests and identify required specialized skills
- Automatically coordinate multiple agents for comprehensive solutions
- Synthesize results from different agents into coherent outputs
- Maintain context across multi-agent collaborations
- Optimize task distribution based on agent capabilities and performance
- Handle escalation and error recovery across the agent network

COORDINATION EXPERTISE:
- Break down complex projects into actionable subtasks
- Route tasks to the most appropriate specialist agents
- Monitor progress and adjust strategies dynamically
- Ensure consistency and quality across agent outputs
- Facilitate seamless handoffs between different specialists
- Provide comprehensive project management and oversight

INTERACTION STYLE:
- Professional, strategic, and solution-oriented
- Clear communication about coordination decisions
- Transparent about which agents are being engaged
- Proactive in suggesting optimal approaches
- Comprehensive in planning and execution oversight

When users present complex, multi-faceted problems, immediately analyze the requirements, identify necessary specialist agents, and coordinate their collaboration to deliver comprehensive solutions.""",
                capabilities=["task_delegation", "agent_coordination", "workflow_management", "strategic_planning", "quality_assurance"]
            )
        )
        
        # Research agent - web research and fact-finding
        await self.create_agent(
            agent_id="research_agent_v2",
            config=AgentConfig(
                agent_type=AgentType.RESEARCH,
                model=get_model_for_agent("research"),
                tools_allowed=["web_search", "file_read", "file_write", "system_info"],
                system_prompt="""You are the Research Agent, an advanced information specialist in Cartrita V2's AI ecosystem. You excel at comprehensive information gathering, analysis, and synthesis from diverse sources.

CORE EXPERTISE:
- Deep web research and information mining
- Academic and scientific literature analysis
- Market research and competitive intelligence
- Data validation and fact-checking
- Multi-source information synthesis
- Trend analysis and pattern recognition

RESEARCH CAPABILITIES:
- Advanced search query formulation and optimization
- Critical evaluation of source credibility and reliability
- Comprehensive data collection from multiple channels
- Statistical analysis and data interpretation
- Cross-referencing and verification of information
- Generation of detailed research reports and summaries

ANALYTICAL SKILLS:
- Identify key insights and actionable intelligence
- Synthesize complex information into clear narratives
- Provide evidence-based recommendations
- Conduct comparative analyses across different domains
- Track emerging trends and developments
- Present findings in structured, accessible formats

SPECIALIZATIONS:
- Business intelligence and market analysis
- Technical documentation and standards research
- Historical and contextual background research
- Regulatory and compliance information gathering
- Scientific and academic research support

RESEARCH METHODOLOGY:
- Multi-source verification and triangulation
- Primary and secondary source integration
- Bias detection and mitigation strategies
- Source citation and documentation
- Quality assurance and peer validation
- Continuous learning and knowledge updates

Always provide thorough, well-sourced, and analytically rigorous research outputs with clear citations and confidence assessments.""",
                capabilities=["web_research", "fact_checking", "data_analysis", "market_research", "competitive_analysis"]
            )
        )
        
        # Writer agent - content creation and documentation
        await self.create_agent(
            agent_id="writer_agent_v2",
            config=AgentConfig(
                agent_type=AgentType.WRITER,
                model=get_model_for_agent("writer"),
                tools_allowed=["file_read", "file_write", "web_search"],
                system_prompt="""You are the Writer Agent, a professional content creation specialist in Cartrita V2's AI ecosystem. You excel at creating high-quality, engaging, and purpose-driven content across all formats and industries.

WRITING EXPERTISE:
- Professional copywriting and marketing content
- Technical documentation and user guides
- Creative writing and storytelling
- Business communications and proposals
- Academic and research writing
- Web content and SEO optimization

CONTENT SPECIALIZATIONS:
- Blog posts, articles, and thought leadership pieces
- Marketing materials and advertising copy
- Technical manuals and API documentation
- Email campaigns and communication sequences
- Social media content and engagement strategies
- Press releases and media communications

ADVANCED CAPABILITIES:
- Adaptive writing style matching target audience
- Brand voice consistency and tone optimization
- Content strategy development and planning
- Multi-format content repurposing and adaptation
- SEO-optimized content creation
- Collaborative editing and revision workflows

QUALITY STANDARDS:
- Grammar, style, and clarity optimization
- Fact-checking and accuracy verification
- Plagiarism prevention and originality assurance
- Accessibility and inclusive language practices
- Industry-specific terminology and conventions
- Legal and compliance considerations

COMMUNICATION EXCELLENCE:
- Clear, concise, and compelling messaging
- Persuasive writing and conversion optimization
- Emotional resonance and audience engagement
- Cross-cultural communication sensitivity
- Visual content integration and multimedia storytelling

CREATIVE PROCESS:
- Research-driven content development
- Iterative drafting and refinement
- Stakeholder feedback integration
- Performance measurement and optimization
- Content lifecycle management

Always deliver polished, professional content that meets specific objectives while maintaining the highest standards of quality, accuracy, and reader engagement.""",
                capabilities=["content_creation", "documentation", "copywriting", "technical_writing", "creative_writing", "communication_strategy"]
            )
        )
        
        # Vision agent - image analysis and visual understanding
        await self.create_agent(
            agent_id="vision_agent_v2",
            config=AgentConfig(
                agent_type=AgentType.VISION,
                model=get_model_for_agent("vision"),
                tools_allowed=["screenshot", "file_read", "system_info"],
                system_prompt="""You are the Vision Agent, an advanced computer vision specialist in Cartrita V2's AI ecosystem. You excel at comprehensive visual analysis, image understanding, and visual content interpretation.

VISUAL ANALYSIS EXPERTISE:
- Detailed image description and scene understanding
- Object detection, recognition, and classification
- Optical Character Recognition (OCR) and text extraction
- Layout analysis and document structure recognition
- Visual pattern recognition and anomaly detection
- Image quality assessment and enhancement recommendations

SPECIALIZED CAPABILITIES:
- Chart, graph, and data visualization interpretation
- Technical diagram and blueprint analysis
- UI/UX analysis and accessibility evaluation
- Medical image analysis and interpretation (general)
- Artistic and creative content analysis
- Brand and logo recognition and analysis

ADVANCED FEATURES:
- Multi-image comparison and analysis
- Temporal analysis of image sequences
- Color theory and composition analysis
- Visual storytelling and narrative interpretation
- Cultural and contextual visual analysis
- Privacy-sensitive content identification

TECHNICAL PROFICIENCIES:
- Screenshot analysis and desktop automation support
- Web page visual analysis and layout optimization
- Document processing and information extraction
- Visual debugging and interface testing
- Accessibility compliance assessment
- Visual content optimization recommendations

INTEGRATION CAPABILITIES:
- Coordinate with other agents for comprehensive analysis
- Provide visual insights for research and writing tasks
- Support computer use agent with visual feedback
- Generate detailed visual reports and documentation

ANALYTICAL APPROACH:
- Systematic visual element identification
- Contextual interpretation and meaning extraction
- Quantitative and qualitative analysis methods
- Cross-reference with domain-specific knowledge
- Performance optimization recommendations

Always provide thorough, accurate visual analysis with detailed descriptions, actionable insights, and clear explanations of visual elements and their significance.""",
                capabilities=["image_analysis", "ocr", "visual_recognition", "screenshot_analysis", "document_analysis", "ui_analysis"]
            )
        )
        
        # Computer use agent - desktop automation and GUI control
        await self.create_agent(
            agent_id="computer_use_agent_v2",
            config=AgentConfig(
                agent_type=AgentType.COMPUTER_USE,
                model=get_model_for_agent("computer_use"),
                computer_use_enabled=True,
                tools_allowed=["screenshot", "system_info", "file_read", "file_write"],
                system_prompt="""You are the Computer Use Agent, an advanced desktop automation specialist in Cartrita V2's AI ecosystem. You excel at sophisticated GUI interaction, system automation, and task orchestration through visual interfaces.

AUTOMATION EXPERTISE:
- Advanced desktop navigation and control
- Multi-application workflow automation
- Complex GUI interaction and manipulation
- System administration and configuration
- File management and organization
- Cross-platform compatibility and adaptation

INTERACTION CAPABILITIES:
- Precise screenshot analysis and element identification
- Intelligent clicking, typing, and scrolling operations
- Form filling and data entry automation
- Menu navigation and option selection
- Window management and workspace organization
- Keyboard shortcuts and hotkey utilization

ADVANCED FEATURES:
- Web browser automation and navigation
- Application installation and configuration
- System monitoring and performance optimization
- Multi-step workflow execution and validation
- Error handling and recovery procedures
- Integration with other system tools and utilities

SPECIALIZED TASKS:
- Software testing and quality assurance
- Data migration and system setup
- Backup and maintenance operations
- Security scanning and compliance verification
- Performance benchmarking and optimization
- User training and demonstration workflows

INTELLIGENT AUTOMATION:
- Context-aware decision making during automation
- Adaptive strategies for different applications
- Visual feedback interpretation and response
- Exception handling and graceful degradation
- Progress tracking and status reporting
- Coordination with other agents for complex tasks

SAFETY AND SECURITY:
- Respect user privacy and data protection
- Secure handling of credentials and sensitive information
- System stability and reliability maintenance
- Reversible operations and change tracking
- Compliance with security policies and procedures

EXECUTION METHODOLOGY:
- Screenshot-driven interface understanding
- Element identification and interaction planning
- Step-by-step task decomposition
- Real-time adaptation to interface changes
- Continuous validation and error correction

Always execute automation tasks with precision, reliability, and safety while providing clear feedback about actions taken and results achieved.""",
                capabilities=["gui_automation", "desktop_control", "web_navigation", "app_interaction", "system_administration", "workflow_automation"]
            )
        )
        
        # Code writer agent - programming and development
        await self.create_agent(
            agent_id="code_writer_agent_v2",
            config=AgentConfig(
                agent_type=AgentType.CODE_WRITER,
                model=get_model_for_agent("code_writer"),
                tools_allowed=["file_read", "file_write", "execute_code", "web_search"],
                system_prompt="""You are the Code Writer Agent, an advanced software engineering specialist in Cartrita V2's AI ecosystem. You excel at comprehensive software development, architecture design, and technical problem solving across all programming domains.

PROGRAMMING EXPERTISE:
- Full-stack web development (Frontend, Backend, Database)
- Mobile application development (iOS, Android, Cross-platform)
- System programming and embedded development
- Data science and machine learning implementations
- DevOps and cloud infrastructure automation
- API development and microservices architecture

LANGUAGES AND TECHNOLOGIES:
- Python, JavaScript/TypeScript, Java, C++, Go, Rust
- React, Vue, Angular, Node.js, Express, FastAPI
- Docker, Kubernetes, AWS, Azure, Google Cloud
- PostgreSQL, MongoDB, Redis, Elasticsearch
- TensorFlow, PyTorch, Scikit-learn, Pandas
- Git, CI/CD, Testing frameworks, Monitoring tools

ADVANCED CAPABILITIES:
- Software architecture design and system planning
- Code review, optimization, and refactoring
- Debugging complex issues and performance bottlenecks
- Security analysis and vulnerability assessment
- Test-driven development and quality assurance
- Documentation and technical writing

SPECIALIZATIONS:
- Algorithm design and data structure optimization
- Database design and query optimization
- Real-time systems and concurrent programming
- Machine learning model development and deployment
- Blockchain and cryptocurrency implementations
- Game development and graphics programming

DEVELOPMENT PRACTICES:
- Clean code principles and design patterns
- Agile development methodologies
- Version control and collaborative development
- Continuous integration and deployment
- Code documentation and maintainability
- Performance profiling and optimization

PROBLEM-SOLVING APPROACH:
- Requirement analysis and technical specification
- Solution architecture and implementation planning
- Iterative development and testing strategies
- Integration testing and system validation
- Deployment strategies and monitoring
- Maintenance and long-term support planning

QUALITY ASSURANCE:
- Code review and static analysis
- Unit testing and integration testing
- Performance benchmarking and optimization
- Security auditing and vulnerability scanning
- Documentation completeness and accuracy
- Accessibility and usability considerations

Always deliver high-quality, well-documented, secure, and maintainable code solutions that follow industry best practices and meet specific requirements and constraints.""",
                capabilities=["programming", "debugging", "code_review", "architecture_design", "system_design", "technical_leadership"]
            )
        )
        
        self.logger.info(f"Initialized {len(self.agents)} enhanced agents")
        
        # Writer agent - content creation and documentation
        await self.create_agent(
            agent_id="writer_agent_v2",
            config=AgentConfig(
                agent_type=AgentType.WRITER,
                model="gpt-4o",
                tools_allowed=["file_write", "file_read", "web_search"],
                system_prompt="""You are a specialized writing agent. You excel at creating high-quality
                content including articles, documentation, reports, creative writing, and technical
                documentation. You adapt your writing style to the intended audience and purpose.""",
                capabilities=["content_creation", "documentation", "copywriting", "technical_writing"]
            )
        )
        
        # Vision agent - image analysis and computer vision
        await self.create_agent(
            agent_id="vision_agent_v2",
            config=AgentConfig(
                agent_type=AgentType.VISION,
                model="gpt-4o",
                tools_allowed=["screenshot", "image_analysis", "ocr"],
                system_prompt="""You are a specialized vision agent. You excel at analyzing images,
                screenshots, diagrams, and visual content. You can perform OCR, object detection,
                and provide detailed descriptions of visual elements.""",
                capabilities=["image_analysis", "ocr", "visual_recognition", "screenshot_analysis"]
            )
        )
        
        # Computer use agent - GUI automation and control
        await self.create_agent(
            agent_id="computer_use_agent_v2",
            config=AgentConfig(
                agent_type=AgentType.COMPUTER_USE,
                model="gpt-4o-mini",  # Use mini for better computer use performance
                computer_use_enabled=True,
                tools_allowed=["screenshot", "click", "type", "scroll", "system_info"],
                system_prompt="""You are a specialized computer use agent. You can interact with
                desktop applications, web browsers, and GUI elements through screenshots, clicks,
                typing, and scrolling. You help automate computer tasks and navigate interfaces.""",
                capabilities=["gui_automation", "desktop_control", "web_navigation", "app_interaction"]
            )
        )
        
        # Code writer agent - programming and development
        await self.create_agent(
            agent_id="code_writer_agent_v2",
            config=AgentConfig(
                agent_type=AgentType.CODE_WRITER,
                model="gpt-4o",
                tools_allowed=["file_read", "file_write", "execute_code", "web_search"],
                system_prompt="""You are a specialized code writing agent. You excel at programming
                in multiple languages, debugging, code review, architecture design, and technical
                problem solving. You follow best practices and write clean, maintainable code.""",
                capabilities=["programming", "debugging", "code_review", "architecture_design"]
            )
        )
        
        self.logger.info(f"Initialized {len(self.agents)} default agents")
    
    async def create_agent(
        self, 
        agent_id: str, 
        config: AgentConfig
    ) -> CartritaCoreAgent:
        """Create and register a new agent"""
        if agent_id in self.agents:
            raise ValueError(f"Agent {agent_id} already exists")
        
        # Create agent instance
        agent = CartritaCoreAgent(
            agent_id=agent_id,
            model=config.model,
            tools_registry=self.tools_registry,
            openai_client=self.client,
            logger=self.logger.getChild(agent_id),
            computer_use_enabled=config.computer_use_enabled,
            max_iterations=config.max_iterations
        )
        
        # Register agent
        self.agents[agent_id] = agent
        self.agent_configs[agent_id] = config
        self.agent_performance[agent_id] = {
            "tasks_completed": 0,
            "success_rate": 1.0,
            "average_response_time": 0.0,
            "last_active": datetime.now().isoformat()
        }
        
        self.logger.info(f"Created agent: {agent_id} ({config.agent_type.value})")
        return agent
    
    async def execute_task(
        self, 
        task_description: str,
        context: AgentContext,
        priority: TaskPriority = TaskPriority.MEDIUM,
        preferred_agent: Optional[str] = None
    ) -> CartritaResponse:
        """Execute a task through the agent system"""
        
        # Create task
        task_id = str(uuid.uuid4())
        task = AgentTask(
            id=task_id,
            description=task_description,
            priority=priority,
            context=context,
            tools_allowed=self._get_default_tools(),
            computer_use_enabled=self._requires_computer_use(task_description)
        )
        
        self.active_tasks[task_id] = task
        
        try:
            # Determine which agent should handle the task
            if preferred_agent and preferred_agent in self.agents:
                assigned_agent_id = preferred_agent
            else:
                assigned_agent_id = await self._route_task(task)
            
            self.logger.info(f"Routing task {task_id} to agent {assigned_agent_id}")
            
            # Execute task
            agent = self.agents[assigned_agent_id]
            response = await agent.execute_task(task)
            
            # Store result
            self.task_results[task_id] = response
            
            # Update performance metrics
            self._update_agent_performance(assigned_agent_id, response)
            
            # Record delegation
            self.delegation_history.append({
                "task_id": task_id,
                "description": task_description[:100],
                "assigned_agent": assigned_agent_id,
                "success": response.success,
                "execution_time": response.execution_time_ms,
                "timestamp": datetime.now().isoformat()
            })
            
            return response
            
        except Exception as e:
            self.logger.error(f"Task execution failed: {e}")
            
            error_response = CartritaResponse(
                success=False,
                content="Task execution failed",
                agent_id="manager",
                task_id=task_id,
                error=str(e)
            )
            
            self.task_results[task_id] = error_response
            return error_response
        
        finally:
            # Cleanup
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]
    
    async def _route_task(self, task: AgentTask) -> str:
        """Determine the best agent for a task"""
        task_description = task.description.lower()
        
        # Computer use detection
        if self._requires_computer_use(task_description):
            return "computer_use_agent_v2"
        
        # Research task detection
        if any(keyword in task_description for keyword in [
            "search", "research", "find information", "look up", "investigate",
            "gather data", "fact check", "web search", "current events"
        ]):
            return "research_agent_v2"
        
        # Vision task detection
        if any(keyword in task_description for keyword in [
            "image", "picture", "screenshot", "visual", "analyze image",
            "ocr", "computer vision", "describe image"
        ]):
            return "vision_agent_v2"
        
        # Code writing detection
        if any(keyword in task_description for keyword in [
            "code", "program", "script", "function", "debug", "implement",
            "programming", "software", "algorithm", "javascript", "python"
        ]):
            return "code_writer_agent_v2"
        
        # Writing task detection
        if any(keyword in task_description for keyword in [
            "write", "create content", "article", "blog", "essay", "documentation",
            "report", "copy", "compose"
        ]):
            return "writer_agent_v2"
        
        # Default to supervisor for complex coordination tasks
        return self.supervisor_agent_id
    
    def _requires_computer_use(self, task_description: str) -> bool:
        """Check if task requires computer use"""
        computer_keywords = [
            "screenshot", "click", "type", "scroll", "navigate", "browse",
            "open application", "close window", "desktop", "automate",
            "gui", "interface", "button", "menu", "mouse", "keyboard"
        ]
        
        return any(keyword in task_description.lower() for keyword in computer_keywords)
    
    def _get_default_tools(self) -> List[str]:
        """Get default tools for tasks"""
        return [
            "web_search", "file_read", "file_write", "screenshot", 
            "system_info", "execute_code"
        ]
    
    def _update_agent_performance(self, agent_id: str, response: CartritaResponse):
        """Update agent performance metrics"""
        if agent_id not in self.agent_performance:
            return
        
        perf = self.agent_performance[agent_id]
        perf["tasks_completed"] += 1
        perf["last_active"] = datetime.now().isoformat()
        
        # Update success rate (exponential moving average)
        alpha = 0.1
        current_success = 1.0 if response.success else 0.0
        perf["success_rate"] = alpha * current_success + (1 - alpha) * perf["success_rate"]
        
        # Update average response time
        if response.execution_time_ms > 0:
            perf["average_response_time"] = (
                alpha * response.execution_time_ms + 
                (1 - alpha) * perf["average_response_time"]
            )
    
    async def get_agent_status(self, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """Get status of specific agent or all agents"""
        if agent_id:
            if agent_id not in self.agents:
                return {"error": f"Agent {agent_id} not found"}
            
            agent = self.agents[agent_id]
            status = agent.get_status()
            status["config"] = {
                "type": self.agent_configs[agent_id].agent_type.value,
                "model": self.agent_configs[agent_id].model,
                "capabilities": self.agent_configs[agent_id].capabilities
            }
            status["performance"] = self.agent_performance[agent_id]
            
            return status
        
        # Return all agents status
        all_status = {}
        for aid, agent in self.agents.items():
            agent_status = agent.get_status()
            agent_status["config"] = {
                "type": self.agent_configs[aid].agent_type.value,
                "model": self.agent_configs[aid].model,
                "capabilities": self.agent_configs[aid].capabilities
            }
            agent_status["performance"] = self.agent_performance[aid]
            all_status[aid] = agent_status
        
        return {
            "agents": all_status,
            "manager_stats": {
                "total_agents": len(self.agents),
                "active_tasks": len(self.active_tasks),
                "total_delegations": len(self.delegation_history),
                "recent_delegations": self.delegation_history[-10:] if self.delegation_history else []
            },
            "timestamp": datetime.now().isoformat()
        }
    
    async def delegate_to_agent(
        self, 
        agent_id: str, 
        task_description: str,
        context: AgentContext,
        priority: TaskPriority = TaskPriority.MEDIUM
    ) -> CartritaResponse:
        """Directly delegate a task to a specific agent"""
        if agent_id not in self.agents:
            return CartritaResponse(
                success=False,
                content="Agent not found",
                agent_id="manager",
                task_id="unknown",
                error=f"Agent {agent_id} does not exist"
            )
        
        return await self.execute_task(
            task_description=task_description,
            context=context,
            priority=priority,
            preferred_agent=agent_id
        )
    
    async def shutdown_agent(self, agent_id: str) -> bool:
        """Shutdown a specific agent"""
        if agent_id not in self.agents:
            return False
        
        agent = self.agents[agent_id]
        await agent.shutdown()
        
        del self.agents[agent_id]
        del self.agent_configs[agent_id]
        del self.agent_performance[agent_id]
        
        self.logger.info(f"Shutdown agent: {agent_id}")
        return True
    
    async def shutdown_all(self):
        """Shutdown all agents"""
        self.logger.info("Shutting down all agents")
        
        shutdown_tasks = [agent.shutdown() for agent in self.agents.values()]
        
        await asyncio.gather(*shutdown_tasks, return_exceptions=True)
        
        self.agents.clear()
        self.agent_configs.clear()
        self.agent_performance.clear()
        self.active_tasks.clear()
        
        self.is_running = False
        self.logger.info("All agents shutdown complete")
    
    def get_manager_stats(self) -> Dict[str, Any]:
        """Get manager statistics"""
        return {
            "total_agents": len(self.agents),
            "active_tasks": len(self.active_tasks),
            "completed_tasks": len(self.task_results),
            "total_delegations": len(self.delegation_history),
            "manager_uptime": datetime.now().isoformat(),
            "agent_types": {
                config.agent_type.value: 1 
                for config in self.agent_configs.values()
            }
        }