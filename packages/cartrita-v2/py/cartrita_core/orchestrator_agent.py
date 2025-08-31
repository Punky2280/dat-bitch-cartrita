"""
Cartrita's Orchestrator Agent - The Main Brain
Coordinates specialist agents with Miami flair and dynamic routing
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

from openai import AsyncOpenAI
from .responses_adapter import ResponsesAPIAdapter, RoutingContext, ReasoningEffort
from .database_manager import DatabaseManager
from .versioned_prompt_system import VersionedPromptManager
from .vector_store_manager import VectorStoreManager
from .openai_function_tools import CARTRITA_TOOLS
from .advanced_specialists import SpecialistManager

logger = logging.getLogger(__name__)


class TaskComplexity(Enum):
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    EXPERT = "expert"


class AgentType(Enum):
    RETRIEVAL = "retrieval"
    CODE = "code"
    DATAVIZ = "dataviz"
    WEB_RESEARCH = "web_research"
    IMAGE = "image"
    UI_DSL = "ui_dsl"
    AUTOMATION = "automation"
    MODERATION = "moderation"


@dataclass
class TaskAssignment:
    agent_type: AgentType
    priority: int
    estimated_tokens: int
    tools_required: List[str]
    reasoning_effort: ReasoningEffort
    context_data: Dict[str, Any]


@dataclass
class ConversationState:
    session_id: str
    user_id: str
    message_count: int
    total_tokens: int
    active_tasks: List[str]
    context_summary: str
    last_agent_used: Optional[str]
    conversation_mood: str  # "casual", "technical", "supportive", etc.


class CartritalOrchestrator:
    """
    Oye, this is Cartrita's main brain! 🧠
    Coordinates all the specialist agents with Miami street smarts
    """
    
    def __init__(
        self,
        openai_client: AsyncOpenAI,
        database_manager: DatabaseManager,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: VersionedPromptManager,
        vector_store_manager: VectorStoreManager
    ):
        self.client = openai_client
        self.db = database_manager
        self.responses = responses_adapter
        self.prompts = prompt_manager
        self.vector_store = vector_store_manager
        
        # Initialize specialist manager with all agents
        self.specialists = SpecialistManager(
            openai_client=openai_client,
            responses_adapter=responses_adapter,
            prompt_manager=prompt_manager,
            database_manager=database_manager,
            vector_store_manager=vector_store_manager
        )
        
        # Cartrita's personality configs
        self.miami_mood_indicators = {
            "excited": ["dale", "wepa", "ay dios mio", "que chevere"],
            "focused": ["vamos a ver", "OK mira", "prestame atencion"],
            "supportive": ["no te preocupes", "todo va a estar bien", "estoy aqui"]
        }
        
        # Agent specialization mapping
        self.agent_capabilities = {
            AgentType.RETRIEVAL: {
                "tools": ["file_search", "vector_search", "knowledge_base"],
                "complexity_threshold": TaskComplexity.SIMPLE,
                "token_limit": 4000
            },
            AgentType.CODE: {
                "tools": ["code_execution", "file_operations", "git_operations"],
                "complexity_threshold": TaskComplexity.MODERATE,
                "token_limit": 8000
            },
            AgentType.DATAVIZ: {
                "tools": ["chart_generation", "data_analysis", "statistical_tools"],
                "complexity_threshold": TaskComplexity.MODERATE,
                "token_limit": 6000
            },
            AgentType.WEB_RESEARCH: {
                "tools": ["web_search", "content_scraping", "fact_checking"],
                "complexity_threshold": TaskComplexity.SIMPLE,
                "token_limit": 5000
            },
            AgentType.IMAGE: {
                "tools": ["image_generation", "image_analysis", "vision_processing"],
                "complexity_threshold": TaskComplexity.COMPLEX,
                "token_limit": 10000
            },
            AgentType.UI_DSL: {
                "tools": ["ui_generation", "component_creation", "layout_design"],
                "complexity_threshold": TaskComplexity.COMPLEX,
                "token_limit": 12000
            },
            AgentType.AUTOMATION: {
                "tools": ["workflow_automation", "task_scheduling", "system_integration"],
                "complexity_threshold": TaskComplexity.EXPERT,
                "token_limit": 15000
            },
            AgentType.MODERATION: {
                "tools": ["content_moderation", "safety_checking", "compliance_validation"],
                "complexity_threshold": TaskComplexity.SIMPLE,
                "token_limit": 3000
            }
        }

    async def process_user_message(
        self,
        message: str,
        user_id: str,
        session_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Main entry point - processes user message with full Miami flair
        """
        try:
            # Initialize or retrieve conversation state
            if not session_id:
                session_id = await self._create_new_session(user_id)
            
            state = await self._get_conversation_state(session_id)
            
            # Analyze the user's request with Cartrita's perspective
            analysis = await self._analyze_user_intent(message, state, context)
            
            # Route to appropriate agents based on analysis
            response = await self._orchestrate_response(analysis, state)
            
            # Update conversation state and database
            await self._update_conversation_state(session_id, analysis, response)
            
            return {
                "response": response,
                "session_id": session_id,
                "agents_used": analysis.get("agents_assigned", []),
                "token_usage": response.get("usage", {}),
                "reasoning_path": analysis.get("reasoning_path", [])
            }
            
        except Exception as e:
            logger.error(f"Orchestrator error for user {user_id}: {str(e)}")
            # Fallback to simple response with Cartrita's voice
            fallback = await self._handle_error_with_personality(str(e), user_id)
            return {"response": fallback, "error": True}

    async def _analyze_user_intent(
        self,
        message: str,
        state: ConversationState,
        context: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyzes user intent with Miami street smarts and AI precision
        """
        # Get analysis prompt with Cartrita's personality
        analysis_prompt = await self.prompts.get_prompt_for_agent(
            "orchestrator_analysis",
            {
                "user_message": message,
                "conversation_history": state.context_summary,
                "mood": state.conversation_mood,
                "available_agents": list(AgentType),
                "miami_context": "Remember you're Cartrita from Hialeah - analyze with sabor!"
            }
        )
        
        # Use routing logic for analysis
        routing_context = RoutingContext(
            conversation_length=state.message_count,
            user_id=state.user_id,
            task_type="analysis",
            complexity_score=self._estimate_complexity(message),
            tool_requirements=[],
            context_size=len(state.context_summary)
        )
        
        # Get analysis from OpenAI with dynamic model routing
        analysis_response = await self.responses.create_response(
            messages=[{"role": "user", "content": analysis_prompt}],
            routing_context=routing_context,
            tools=None,  # Analysis doesn't need tools
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "intent_analysis",
                    "schema": {
                        "type": "object",
                        "properties": {
                            "primary_intent": {"type": "string"},
                            "task_complexity": {"type": "string", "enum": ["simple", "moderate", "complex", "expert"]},
                            "agents_needed": {"type": "array", "items": {"type": "string"}},
                            "tools_required": {"type": "array", "items": {"type": "string"}},
                            "estimated_tokens": {"type": "integer"},
                            "miami_mood": {"type": "string"},
                            "reasoning_path": {"type": "array", "items": {"type": "string"}},
                            "urgency_level": {"type": "string", "enum": ["low", "medium", "high", "critical"]}
                        },
                        "required": ["primary_intent", "task_complexity", "agents_needed"]
                    }
                }
            }
        )
        
        # Parse the structured analysis
        try:
            analysis_data = json.loads(analysis_response.choices[0].message.content)
            
            # Add task assignments based on analysis
            analysis_data["task_assignments"] = await self._create_task_assignments(
                analysis_data, state
            )
            
            return analysis_data
            
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Analysis parsing failed: {e}")
            # Fallback analysis
            return {
                "primary_intent": "general_assistance",
                "task_complexity": "moderate",
                "agents_needed": ["retrieval"],
                "miami_mood": "supportive",
                "task_assignments": []
            }

    async def _orchestrate_response(
        self,
        analysis: Dict[str, Any],
        state: ConversationState
    ) -> Dict[str, Any]:
        """
        Coordinates specialist agents like a true Miami coordinator
        """
        task_assignments = analysis.get("task_assignments", [])
        
        if not task_assignments:
            # Direct response from orchestrator
            return await self._generate_direct_response(analysis, state)
        
        # Execute tasks with multiple agents if needed
        agent_responses = {}
        total_tokens = 0
        
        for assignment in task_assignments:
            try:
                agent_response = await self._execute_agent_task(assignment, state)
                agent_responses[assignment.agent_type.value] = agent_response
                total_tokens += agent_response.get("usage", {}).get("total_tokens", 0)
                
            except Exception as e:
                logger.error(f"Agent {assignment.agent_type.value} failed: {e}")
                agent_responses[assignment.agent_type.value] = {
                    "error": str(e),
                    "fallback_message": f"Ay, {assignment.agent_type.value} agent tuvo un problemita, pero seguimos adelante!"
                }
        
        # Synthesize final response with Cartrita's voice
        final_response = await self._synthesize_agent_responses(
            agent_responses, analysis, state
        )
        
        final_response["usage"] = {"total_tokens": total_tokens}
        return final_response

    async def _execute_agent_task(
        self,
        assignment: TaskAssignment,
        state: ConversationState
    ) -> Dict[str, Any]:
        """
        Executes a specific agent task using the actual specialist agents
        """
        # Get the specialist agent for this task
        specialist = self.specialists.get_specialist(assignment.agent_type.value)
        
        if not specialist:
            # Fallback to direct execution if specialist not found
            return await self._execute_direct_agent_task(assignment, state)
        
        # Prepare context for the specialist
        specialist_context = {
            **assignment.context_data,
            "message_count": state.message_count,
            "user_id": state.user_id,
            "conversation_context": state.context_summary,
            "miami_context": state.conversation_mood
        }
        
        try:
            # Execute task with the specialist agent
            result = await specialist.process_task(
                task_description=assignment.context_data.get("original_request", ""),
                context=specialist_context,
                tools_available=assignment.tools_required
            )
            
            # Track agent execution in database
            await self._track_specialist_execution(assignment, result, state.session_id)
            
            return {
                "content": result.content,
                "tool_calls": result.tool_calls,
                "success": result.success,
                "metadata": result.metadata,
                "agent_type": assignment.agent_type.value,
                "specialist_used": True
            }
            
        except Exception as e:
            logger.error(f"Specialist {assignment.agent_type.value} failed: {e}")
            
            # Fallback to direct execution
            return await self._execute_direct_agent_task(assignment, state)
    
    async def _execute_direct_agent_task(
        self,
        assignment: TaskAssignment,
        state: ConversationState
    ) -> Dict[str, Any]:
        """
        Direct execution fallback when specialist agent is unavailable
        """
        # Get agent-specific prompt
        agent_prompt = await self.prompts.get_prompt_for_agent(
            f"{assignment.agent_type.value}_specialist",
            {
                **assignment.context_data,
                "cartrita_personality": "active",
                "miami_context": state.conversation_mood
            }
        )
        
        # Prepare tools for this agent
        agent_tools = [
            tool for tool in CARTRITA_TOOLS
            if tool["function"]["name"] in assignment.tools_required
        ]
        
        # Create routing context for this agent
        routing_context = RoutingContext(
            conversation_length=state.message_count,
            user_id=state.user_id,
            task_type=assignment.agent_type.value,
            complexity_score=assignment.reasoning_effort.value,
            tool_requirements=assignment.tools_required,
            context_size=assignment.estimated_tokens
        )
        
        # Execute the agent task
        response = await self.responses.create_response(
            messages=[{"role": "user", "content": agent_prompt}],
            routing_context=routing_context,
            tools=agent_tools if agent_tools else None,
            max_completion_tokens=assignment.estimated_tokens
        )
        
        # Track agent execution in database
        await self._track_agent_execution(assignment, response, state.session_id)
        
        return {
            "content": response.choices[0].message.content,
            "tool_calls": response.choices[0].message.tool_calls,
            "usage": response.usage.model_dump() if response.usage else {},
            "agent_type": assignment.agent_type.value,
            "specialist_used": False
        }

    async def _synthesize_agent_responses(
        self,
        agent_responses: Dict[str, Dict],
        analysis: Dict[str, Any],
        state: ConversationState
    ) -> Dict[str, Any]:
        """
        Combines multiple agent responses into cohesive Cartrita response
        """
        synthesis_prompt = await self.prompts.get_prompt_for_agent(
            "response_synthesis",
            {
                "agent_responses": agent_responses,
                "original_intent": analysis["primary_intent"],
                "miami_mood": analysis.get("miami_mood", "supportive"),
                "user_context": state.context_summary
            }
        )
        
        # Use high reasoning effort for synthesis
        routing_context = RoutingContext(
            conversation_length=state.message_count,
            user_id=state.user_id,
            task_type="synthesis",
            complexity_score=3,  # High complexity for synthesis
            tool_requirements=[],
            context_size=sum(len(str(r)) for r in agent_responses.values())
        )
        
        synthesis_response = await self.responses.create_completion(
            messages=[{"role": "user", "content": synthesis_prompt}],
            routing_context=routing_context
        )
        
        return {
            "content": synthesis_response.choices[0].message.content,
            "agent_responses": agent_responses,
            "synthesis_tokens": synthesis_response.usage.total_tokens if synthesis_response.usage else 0
        }

    async def _create_task_assignments(
        self,
        analysis: Dict[str, Any],
        state: ConversationState
    ) -> List[TaskAssignment]:
        """
        Creates specific task assignments based on analysis
        """
        assignments = []
        agents_needed = analysis.get("agents_needed", [])
        tools_required = analysis.get("tools_required", [])
        complexity = TaskComplexity(analysis.get("task_complexity", "moderate"))
        
        for i, agent_name in enumerate(agents_needed):
            try:
                agent_type = AgentType(agent_name.lower())
                
                # Filter tools for this agent
                agent_tools = [
                    tool for tool in tools_required
                    if tool in self.agent_capabilities[agent_type]["tools"]
                ]
                
                # Determine reasoning effort based on complexity and agent
                reasoning_effort = self._determine_reasoning_effort(complexity, agent_type)
                
                assignment = TaskAssignment(
                    agent_type=agent_type,
                    priority=i + 1,
                    estimated_tokens=self.agent_capabilities[agent_type]["token_limit"],
                    tools_required=agent_tools,
                    reasoning_effort=reasoning_effort,
                    context_data={
                        "original_request": analysis.get("primary_intent", ""),
                        "conversation_context": state.context_summary,
                        "miami_personality": True
                    }
                )
                
                assignments.append(assignment)
                
            except ValueError:
                logger.warning(f"Unknown agent type: {agent_name}")
                continue
        
        return assignments

    def _determine_reasoning_effort(
        self,
        complexity: TaskComplexity,
        agent_type: AgentType
    ) -> ReasoningEffort:
        """
        Maps task complexity to reasoning effort with agent-specific adjustments
        """
        base_effort = {
            TaskComplexity.SIMPLE: ReasoningEffort.LOW,
            TaskComplexity.MODERATE: ReasoningEffort.MEDIUM,
            TaskComplexity.COMPLEX: ReasoningEffort.HIGH,
            TaskComplexity.EXPERT: ReasoningEffort.HIGH
        }[complexity]
        
        # Adjust for specialized agents that need more reasoning
        if agent_type in [AgentType.AUTOMATION, AgentType.MODERATION, AgentType.UI_DSL]:
            if base_effort == ReasoningEffort.LOW:
                return ReasoningEffort.MEDIUM
            elif base_effort == ReasoningEffort.MEDIUM:
                return ReasoningEffort.HIGH
        
        return base_effort

    def _estimate_complexity(self, message: str) -> int:
        """
        Quick complexity estimation based on message characteristics
        """
        complexity_indicators = {
            "code": 2,
            "build": 2,
            "create": 1,
            "analyze": 2,
            "generate": 1,
            "automation": 3,
            "integrate": 3,
            "optimize": 2,
            "debug": 2,
            "test": 1,
            "deploy": 3
        }
        
        message_lower = message.lower()
        score = 0
        
        for indicator, weight in complexity_indicators.items():
            if indicator in message_lower:
                score += weight
        
        # Length and question marks also indicate complexity
        if len(message) > 500:
            score += 1
        if message.count('?') > 2:
            score += 1
            
        return min(score, 5)  # Cap at 5

    async def _track_agent_execution(
        self,
        assignment: TaskAssignment,
        response: Any,
        session_id: str
    ):
        """
        Tracks agent execution in database for observability
        """
        try:
            execution_data = {
                "session_id": session_id,
                "agent_type": assignment.agent_type.value,
                "tools_used": assignment.tools_required,
                "token_usage": response.usage.model_dump() if hasattr(response, 'usage') and response.usage else {},
                "reasoning_effort": assignment.reasoning_effort.value,
                "execution_time": datetime.now(timezone.utc),
                "success": True
            }
            
            await self.db.create_task_execution(execution_data)
            
        except Exception as e:
            logger.error(f"Failed to track agent execution: {e}")
    
    async def _track_specialist_execution(
        self,
        assignment: TaskAssignment,
        result: Any,  # SpecialistResult
        session_id: str
    ):
        """
        Tracks specialist agent execution in database for observability
        """
        try:
            execution_data = {
                "session_id": session_id,
                "agent_type": assignment.agent_type.value,
                "tools_used": assignment.tools_required,
                "token_usage": result.metadata.get("usage", {}),
                "reasoning_effort": assignment.reasoning_effort.value,
                "execution_time": datetime.now(timezone.utc),
                "success": result.success,
                "specialist_metadata": result.metadata,
                "execution_type": "specialist"
            }
            
            await self.db.create_task_execution(execution_data)
            
        except Exception as e:
            logger.error(f"Failed to track specialist execution: {e}")

    async def _create_new_session(self, user_id: str) -> str:
        """Creates new conversation session"""
        session_data = {
            "user_id": user_id,
            "start_time": datetime.now(timezone.utc),
            "status": "active",
            "metadata": {"orchestrator_version": "v1.0", "miami_mode": True}
        }
        return await self.db.create_conversation_session(session_data)

    async def _get_conversation_state(self, session_id: str) -> ConversationState:
        """Retrieves current conversation state"""
        session = await self.db.get_conversation_session(session_id)
        
        return ConversationState(
            session_id=session_id,
            user_id=session["user_id"],
            message_count=session.get("message_count", 0),
            total_tokens=session.get("total_tokens", 0),
            active_tasks=session.get("active_tasks", []),
            context_summary=session.get("context_summary", ""),
            last_agent_used=session.get("last_agent_used"),
            conversation_mood=session.get("conversation_mood", "supportive")
        )

    async def _update_conversation_state(
        self,
        session_id: str,
        analysis: Dict[str, Any],
        response: Dict[str, Any]
    ):
        """Updates conversation state after processing"""
        update_data = {
            "message_count": "+1",  # Increment
            "total_tokens": f"+{response.get('usage', {}).get('total_tokens', 0)}",
            "last_agent_used": ",".join(analysis.get("agents_needed", [])),
            "conversation_mood": analysis.get("miami_mood", "supportive"),
            "last_activity": datetime.now(timezone.utc)
        }
        
        await self.db.update_conversation_session(session_id, update_data)

    async def _generate_direct_response(
        self,
        analysis: Dict[str, Any],
        state: ConversationState
    ) -> Dict[str, Any]:
        """Generates direct response when no specialist agents needed"""
        direct_prompt = await self.prompts.get_prompt_for_agent(
            "orchestrator_direct",
            {
                "user_intent": analysis["primary_intent"],
                "miami_mood": analysis.get("miami_mood", "supportive"),
                "conversation_context": state.context_summary
            }
        )
        
        routing_context = RoutingContext(
            conversation_length=state.message_count,
            user_id=state.user_id,
            task_type="direct_response",
            complexity_score=1,
            tool_requirements=[],
            context_size=len(direct_prompt)
        )
        
        response = await self.responses.create_response(
            messages=[{"role": "user", "content": direct_prompt}],
            routing_context=routing_context
        )
        
        return {
            "content": response.choices[0].message.content,
            "usage": response.usage.model_dump() if response.usage else {},
            "response_type": "direct"
        }

    async def _handle_error_with_personality(self, error: str, user_id: str) -> Dict[str, Any]:
        """Handles errors while maintaining Cartrita's personality"""
        miami_error_responses = [
            "Ay, Dios mío! Something went wrong, but don't worry mi amor, estamos working on it!",
            "¡Qué desastre! But you know what? Cartrita never gives up. Let me try again, dale!",
            "Oye, we hit a little bump in the road, but como dicen en Miami: ¡pa'lante que vamos!"
        ]
        
        import random
        fallback_message = random.choice(miami_error_responses)
        
        return {
            "content": f"{fallback_message}\n\nTechnical details: {error}",
            "error": True,
            "miami_personality": True
        }


# Helper function for easy orchestrator initialization
async def create_cartrita_orchestrator(
    openai_api_key: str,
    database_url: str,
    **config_overrides
) -> CartritalOrchestrator:
    """
    Factory function to create fully configured Cartrita Orchestrator
    """
    # Initialize core components
    openai_client = AsyncOpenAI(api_key=openai_api_key)
    
    db_manager = DatabaseManager(database_url)
    await db_manager.initialize_pool()
    
    responses_adapter = ResponsesAdapter(openai_client, **config_overrides)
    
    prompt_manager = PromptManager(db_manager)
    
    vector_store_manager = VectorStoreManager(openai_client, db_manager)
    
    # Create and return orchestrator
    orchestrator = CartritalOrchestrator(
        openai_client=openai_client,
        database_manager=db_manager,
        responses_adapter=responses_adapter,
        prompt_manager=prompt_manager,
        vector_store_manager=vector_store_manager
    )
    
    return orchestrator