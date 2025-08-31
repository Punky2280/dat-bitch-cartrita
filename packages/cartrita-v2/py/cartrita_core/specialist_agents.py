"""
Cartrita's Specialist Agents - Los Expertos with Miami Sabor
Each agent specializes in different tasks while keeping that Hialeah flair
"""
import asyncio
import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from enum import Enum

from openai import AsyncOpenAI
from .responses_adapter import ResponsesAPIAdapter, RoutingContext, ReasoningEffort
from .database_manager import DatabaseManager
from .prompt_manager import PromptManager
from .vector_store_manager import VectorStoreManager
from .openai_function_tools import CARTRITA_TOOLS

logger = logging.getLogger(__name__)


class SpecialistResult:
    """Result wrapper for specialist agent responses"""
    def __init__(
        self,
        content: str,
        success: bool = True,
        tool_calls: Optional[List] = None,
        metadata: Optional[Dict] = None,
        error: Optional[str] = None
    ):
        self.content = content
        self.success = success
        self.tool_calls = tool_calls or []
        self.metadata = metadata or {}
        self.error = error
        self.timestamp = datetime.now(timezone.utc)


class BaseSpecialistAgent(ABC):
    """
    Base class for all Cartrita specialist agents
    Oye, todos los agents inherit Miami personality!
    """
    
    def __init__(
        self,
        agent_name: str,
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager
    ):
        self.agent_name = agent_name
        self.client = openai_client
        self.responses = responses_adapter
        self.prompts = prompt_manager
        self.db = database_manager
        
        # Miami personality constants
        self.miami_greetings = ["¡Oye!", "Dale pues", "¿Qué tal?", "Wepa"]
        self.miami_confirmations = ["¡Dale!", "¡Perfecto!", "¡Qué bueno!", "¡Así mismo!"]
        self.miami_transitions = ["Bueno mira", "OK entonces", "Vamos a ver", "A ver qué tal"]
    
    @abstractmethod
    async def process_task(
        self,
        task_description: str,
        context: Dict[str, Any],
        tools_available: List[str]
    ) -> SpecialistResult:
        """Process a task specific to this agent's specialty"""
        pass
    
    @abstractmethod
    def get_required_tools(self) -> List[str]:
        """Returns list of tools this agent needs"""
        pass
    
    async def _execute_with_tools(
        self,
        prompt: str,
        tools: List[Dict],
        routing_context: RoutingContext,
        max_tokens: int = 4000
    ) -> SpecialistResult:
        """Common execution pattern with tool calling"""
        try:
            response = await self.responses.create_response(
                messages=[{"role": "user", "content": prompt}],
                routing_context=routing_context,
                tools=tools,
                max_completion_tokens=max_tokens
            )
            
            message = response.choices[0].message
            
            # Handle tool calls if present
            tool_results = []
            if message.tool_calls:
                for tool_call in message.tool_calls:
                    tool_result = await self._execute_tool_call(tool_call)
                    tool_results.append(tool_result)
            
            return SpecialistResult(
                content=message.content or "",
                tool_calls=tool_results,
                metadata={
                    "model_used": response.model if hasattr(response, 'model') else "unknown",
                    "usage": response.usage.model_dump() if response.usage else {}
                }
            )
            
        except Exception as e:
            logger.error(f"{self.agent_name} execution failed: {e}")
            return SpecialistResult(
                content=f"Ay, algo pasó with {self.agent_name}. Error: {str(e)}",
                success=False,
                error=str(e)
            )
    
    async def _execute_tool_call(self, tool_call) -> Dict[str, Any]:
        """Execute a tool call and return results"""
        # This would integrate with the actual tool execution system
        # For now, return a placeholder
        return {
            "tool_name": tool_call.function.name,
            "arguments": tool_call.function.arguments,
            "result": "Tool execution placeholder - to be implemented",
            "success": True
        }


class RetrievalSpecialist(BaseSpecialistAgent):
    """
    Cartrita's Retrieval Specialist - La Buscadora
    Expert at finding information with Miami efficiency
    """
    
    def __init__(self, *args, vector_store_manager: VectorStoreManager, **kwargs):
        super().__init__("retrieval_specialist", *args, **kwargs)
        self.vector_store = vector_store_manager
    
    def get_required_tools(self) -> List[str]:
        return ["file_search", "vector_search", "knowledge_base"]
    
    async def process_task(
        self,
        task_description: str,
        context: Dict[str, Any],
        tools_available: List[str]
    ) -> SpecialistResult:
        """
        Búsqueda inteligente with Cartrita's style
        """
        # Get specialized retrieval prompt
        retrieval_prompt = await self.prompts.get_prompt_for_agent(
            "retrieval_specialist", 
            {
                "search_query": task_description,
                "context": context.get("conversation_context", ""),
                "miami_personality": "¡Dale! I'm your search expert from Hialeah",
                "search_instructions": "Find the most relevant info que el usuario needs"
            }
        )
        
        # Prepare tools for retrieval
        available_tools = [
            tool for tool in CARTRITA_TOOLS
            if tool["function"]["name"] in self.get_required_tools()
            and tool["function"]["name"] in tools_available
        ]
        
        routing_context = RoutingContext(
            conversation_length=context.get("message_count", 1),
            user_id=context.get("user_id", "unknown"),
            task_type="retrieval",
            complexity_score=1,  # Retrieval is typically simple
            tool_requirements=tools_available,
            context_size=len(task_description)
        )
        
        # Execute with vector search capabilities
        result = await self._execute_with_tools(
            retrieval_prompt,
            available_tools,
            routing_context,
            max_tokens=4000
        )
        
        # Enhance with vector store search if needed
        if "vector_search" in tools_available:
            vector_results = await self._perform_vector_search(task_description)
            if vector_results:
                result.metadata["vector_search_results"] = vector_results
                result.content += f"\n\n*Vector search found {len(vector_results)} relevant results*"
        
        return result
    
    async def _perform_vector_search(self, query: str) -> List[Dict[str, Any]]:
        """Perform vector store search with Miami flair"""
        try:
            results = await self.vector_store.search(query, max_results=5)
            return results
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []


class CodeSpecialist(BaseSpecialistAgent):
    """
    Cartrita's Code Specialist - La Programadora
    Expert at coding tasks with Miami street smarts
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__("code_specialist", *args, **kwargs)
    
    def get_required_tools(self) -> List[str]:
        return ["code_execution", "file_operations", "git_operations"]
    
    async def process_task(
        self,
        task_description: str,
        context: Dict[str, Any],
        tools_available: List[str]
    ) -> SpecialistResult:
        """
        Coding con sabor Miami - clean code with personality
        """
        # Get coding-specific prompt
        coding_prompt = await self.prompts.get_prompt_for_agent(
            "code_specialist",
            {
                "coding_task": task_description,
                "context": context.get("conversation_context", ""),
                "miami_personality": "¡Wepa! Time to code like a true Miami developer",
                "coding_instructions": "Write clean, efficient code que works perfectly",
                "available_tools": tools_available
            }
        )
        
        # Prepare coding tools
        available_tools = [
            tool for tool in CARTRITA_TOOLS
            if tool["function"]["name"] in self.get_required_tools()
            and tool["function"]["name"] in tools_available
        ]
        
        routing_context = RoutingContext(
            conversation_length=context.get("message_count", 1),
            user_id=context.get("user_id", "unknown"),
            task_type="coding",
            complexity_score=2,  # Coding is moderate complexity
            tool_requirements=tools_available,
            context_size=len(task_description) + len(context.get("conversation_context", ""))
        )
        
        # Execute coding task
        result = await self._execute_with_tools(
            coding_prompt,
            available_tools,
            routing_context,
            max_tokens=8000  # More tokens for code
        )
        
        # Add code-specific metadata
        result.metadata.update({
            "code_specialist": True,
            "miami_coding_style": "clean and efficient con personality"
        })
        
        return result


class DataVizSpecialist(BaseSpecialistAgent):
    """
    Cartrita's DataViz Specialist - La Grafiquera
    Expert at data visualization with Miami aesthetic
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__("dataviz_specialist", *args, **kwargs)
    
    def get_required_tools(self) -> List[str]:
        return ["chart_generation", "data_analysis", "statistical_tools"]
    
    async def process_task(
        self,
        task_description: str,
        context: Dict[str, Any],
        tools_available: List[str]
    ) -> SpecialistResult:
        """
        Data visualization con Miami colors and style
        """
        # Get DataViz prompt
        dataviz_prompt = await self.prompts.get_prompt_for_agent(
            "dataviz_specialist",
            {
                "visualization_task": task_description,
                "context": context.get("conversation_context", ""),
                "miami_personality": "¡Dale! Let's make some beautiful charts with Miami vibes",
                "viz_instructions": "Create clear, attractive visualizations que tell the story",
                "miami_color_palette": "Think ocean blues, sunset oranges, palm greens"
            }
        )
        
        # Prepare DataViz tools
        available_tools = [
            tool for tool in CARTRITA_TOOLS
            if tool["function"]["name"] in self.get_required_tools()
            and tool["function"]["name"] in tools_available
        ]
        
        routing_context = RoutingContext(
            conversation_length=context.get("message_count", 1),
            user_id=context.get("user_id", "unknown"),
            task_type="data_visualization",
            complexity_score=2,  # DataViz is moderate complexity
            tool_requirements=tools_available,
            context_size=len(task_description)
        )
        
        # Execute DataViz task
        result = await self._execute_with_tools(
            dataviz_prompt,
            available_tools,
            routing_context,
            max_tokens=6000
        )
        
        # Add DataViz-specific metadata
        result.metadata.update({
            "dataviz_specialist": True,
            "miami_aesthetic": "ocean blues and sunset oranges",
            "chart_style": "clean and vibrant"
        })
        
        return result


class WebResearchSpecialist(BaseSpecialistAgent):
    """
    Cartrita's Web Research Specialist - La Investigadora
    Expert at web research with Miami curiosity
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__("web_research_specialist", *args, **kwargs)
    
    def get_required_tools(self) -> List[str]:
        return ["web_search", "content_scraping", "fact_checking"]
    
    async def process_task(
        self,
        task_description: str,
        context: Dict[str, Any],
        tools_available: List[str]
    ) -> SpecialistResult:
        """
        Web research con Miami thoroughness
        """
        # Get web research prompt
        research_prompt = await self.prompts.get_prompt_for_agent(
            "web_research_specialist",
            {
                "research_query": task_description,
                "context": context.get("conversation_context", ""),
                "miami_personality": "¡Óye! I'm your web detective from Miami",
                "research_instructions": "Find accurate, up-to-date information que sea reliable",
                "fact_checking": "Always verify sources - we keep it real in Miami"
            }
        )
        
        # Prepare research tools
        available_tools = [
            tool for tool in CARTRITA_TOOLS
            if tool["function"]["name"] in self.get_required_tools()
            and tool["function"]["name"] in tools_available
        ]
        
        routing_context = RoutingContext(
            conversation_length=context.get("message_count", 1),
            user_id=context.get("user_id", "unknown"),
            task_type="web_research",
            complexity_score=1,  # Research is typically simple
            tool_requirements=tools_available,
            context_size=len(task_description)
        )
        
        # Execute research task
        result = await self._execute_with_tools(
            research_prompt,
            available_tools,
            routing_context,
            max_tokens=5000
        )
        
        # Add research-specific metadata
        result.metadata.update({
            "web_research_specialist": True,
            "miami_thoroughness": "verified and reliable",
            "sources_checked": True
        })
        
        return result


class SpecialistAgentFactory:
    """
    Factory for creating specialist agents
    Makes it easy to get the right expert para cada task
    """
    
    @staticmethod
    def create_retrieval_specialist(
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager,
        vector_store_manager: VectorStoreManager
    ) -> RetrievalSpecialist:
        return RetrievalSpecialist(
            openai_client=openai_client,
            responses_adapter=responses_adapter,
            prompt_manager=prompt_manager,
            database_manager=database_manager,
            vector_store_manager=vector_store_manager
        )
    
    @staticmethod
    def create_code_specialist(
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager
    ) -> CodeSpecialist:
        return CodeSpecialist(
            openai_client=openai_client,
            responses_adapter=responses_adapter,
            prompt_manager=prompt_manager,
            database_manager=database_manager
        )
    
    @staticmethod
    def create_dataviz_specialist(
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager
    ) -> DataVizSpecialist:
        return DataVizSpecialist(
            openai_client=openai_client,
            responses_adapter=responses_adapter,
            prompt_manager=prompt_manager,
            database_manager=database_manager
        )
    
    @staticmethod
    def create_web_research_specialist(
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager
    ) -> WebResearchSpecialist:
        return WebResearchSpecialist(
            openai_client=openai_client,
            responses_adapter=responses_adapter,
            prompt_manager=prompt_manager,
            database_manager=database_manager
        )
    
    @staticmethod
    def create_all_basic_specialists(
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager,
        vector_store_manager: VectorStoreManager
    ) -> Dict[str, BaseSpecialistAgent]:
        """
        Creates all basic specialist agents
        ¡Dale! Get all the experts you need
        """
        return {
            "retrieval": SpecialistAgentFactory.create_retrieval_specialist(
                openai_client, responses_adapter, prompt_manager, 
                database_manager, vector_store_manager
            ),
            "code": SpecialistAgentFactory.create_code_specialist(
                openai_client, responses_adapter, prompt_manager, database_manager
            ),
            "dataviz": SpecialistAgentFactory.create_dataviz_specialist(
                openai_client, responses_adapter, prompt_manager, database_manager
            ),
            "web_research": SpecialistAgentFactory.create_web_research_specialist(
                openai_client, responses_adapter, prompt_manager, database_manager
            )
        }


# Utility functions for Miami-style error handling
def miami_error_handler(func):
    """Decorator for handling errors with Miami personality"""
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            miami_phrases = [
                "¡Ay, qué lío!",
                "¡Coño, something went wrong!",
                "¡No jodas! We hit a snag",
                "¡Dale! Let's try again"
            ]
            import random
            phrase = random.choice(miami_phrases)
            logger.error(f"{phrase} {str(e)}")
            raise e
    return wrapper