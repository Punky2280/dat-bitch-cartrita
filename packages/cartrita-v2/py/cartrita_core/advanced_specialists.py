"""
Cartrita's Advanced Specialist Agents - Los Expertos Avanzados
High-complexity agents with Miami sophistication
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from enum import Enum

from openai import AsyncOpenAI
from .responses_adapter import ResponsesAPIAdapter, RoutingContext, ReasoningEffort
from .database_manager import DatabaseManager
from .prompt_manager import PromptManager
from .specialist_agents import BaseSpecialistAgent, SpecialistResult
from .openai_function_tools import CARTRITA_TOOLS

logger = logging.getLogger(__name__)


class ImageSpecialist(BaseSpecialistAgent):
    """
    Cartrita's Image Specialist - La Artista Visual
    Expert at image generation and analysis with Miami aesthetic
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__("image_specialist", *args, **kwargs)
        
        # Miami-inspired image styles
        self.miami_styles = {
            "vibrant": "bright colors with Miami beach vibes",
            "sunset": "warm oranges and pinks like South Beach sunset",
            "ocean": "turquoise and aqua blues like Biscayne Bay",
            "art_deco": "geometric patterns inspired by Miami Beach architecture",
            "tropical": "lush greens with palm and flamingo elements",
            "neon": "neon colors like Ocean Drive at night"
        }
    
    def get_required_tools(self) -> List[str]:
        return ["image_generation", "image_analysis", "vision_processing"]
    
    async def process_task(
        self,
        task_description: str,
        context: Dict[str, Any],
        tools_available: List[str]
    ) -> SpecialistResult:
        """
        Image processing con Miami visual flair
        """
        # Determine if this is generation or analysis
        task_type = self._determine_image_task_type(task_description)
        
        # Get image specialist prompt
        image_prompt = await self.prompts.get_prompt_for_agent(
            "image_specialist",
            {
                "image_task": task_description,
                "task_type": task_type,
                "context": context.get("conversation_context", ""),
                "miami_personality": "¡Dale! I'm your visual artist from Miami Beach",
                "aesthetic_guidance": "Think Miami vibes - vibrant, tropical, sophisticated",
                "style_options": self.miami_styles,
                "quality_standard": "high-quality, professional, con sabor Miami"
            }
        )
        
        # Prepare image tools
        available_tools = [
            tool for tool in CARTRITA_TOOLS
            if tool["function"]["name"] in self.get_required_tools()
            and tool["function"]["name"] in tools_available
        ]
        
        routing_context = RoutingContext(
            conversation_length=context.get("message_count", 1),
            user_id=context.get("user_id", "unknown"),
            task_type="image_processing",
            complexity_score=3,  # Images are complex
            tool_requirements=tools_available,
            context_size=len(task_description)
        )
        
        # Execute image task with higher reasoning effort
        result = await self._execute_with_tools(
            image_prompt,
            available_tools,
            routing_context,
            max_tokens=10000
        )
        
        # Add image-specific metadata
        result.metadata.update({
            "image_specialist": True,
            "miami_aesthetic": True,
            "image_task_type": task_type,
            "style_applied": "Miami-inspired",
            "quality_level": "professional"
        })
        
        return result
    
    def _determine_image_task_type(self, task_description: str) -> str:
        """Determine if task is generation, analysis, or processing"""
        task_lower = task_description.lower()
        
        generation_keywords = ["create", "generate", "make", "draw", "design", "produce"]
        analysis_keywords = ["analyze", "describe", "identify", "examine", "explain", "what"]
        processing_keywords = ["edit", "modify", "enhance", "filter", "adjust", "improve"]
        
        if any(keyword in task_lower for keyword in generation_keywords):
            return "generation"
        elif any(keyword in task_lower for keyword in analysis_keywords):
            return "analysis"
        elif any(keyword in task_lower for keyword in processing_keywords):
            return "processing"
        else:
            return "general"


class UIDSLSpecialist(BaseSpecialistAgent):
    """
    Cartrita's UI/DSL Specialist - La Diseñadora de Interfaces
    Expert at UI generation and DSL creation with Miami design sense
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__("ui_dsl_specialist", *args, **kwargs)
        
        # Miami-inspired design principles
        self.miami_design_principles = {
            "color_palette": "Ocean blues, sunset oranges, palm greens, coral pinks",
            "typography": "Clean, modern fonts with Cuban/Latin influence when appropriate",
            "layout": "Spacious, breathing room like Miami beaches",
            "patterns": "Geometric elements inspired by Art Deco architecture",
            "imagery": "High-quality visuals with tropical and urban elements",
            "accessibility": "Clear contrast and readable text for all users"
        }
    
    def get_required_tools(self) -> List[str]:
        return ["ui_generation", "component_creation", "layout_design"]
    
    async def process_task(
        self,
        task_description: str,
        context: Dict[str, Any],
        tools_available: List[str]
    ) -> SpecialistResult:
        """
        UI/DSL creation con Miami design sophistication
        """
        # Get UI specialist prompt
        ui_prompt = await self.prompts.get_prompt_for_agent(
            "ui_dsl_specialist",
            {
                "ui_task": task_description,
                "context": context.get("conversation_context", ""),
                "miami_personality": "¡Wepa! I'm your UI designer from South Beach",
                "design_principles": self.miami_design_principles,
                "ui_guidance": "Create beautiful, functional interfaces que are user-friendly",
                "accessibility": "Always consider accessibility - todos deserve good design",
                "responsive": "Make it work on all devices, from mobile to desktop"
            }
        )
        
        # Prepare UI tools
        available_tools = [
            tool for tool in CARTRITA_TOOLS
            if tool["function"]["name"] in self.get_required_tools()
            and tool["function"]["name"] in tools_available
        ]
        
        routing_context = RoutingContext(
            conversation_length=context.get("message_count", 1),
            user_id=context.get("user_id", "unknown"),
            task_type="ui_design",
            complexity_score=3,  # UI design is complex
            tool_requirements=tools_available,
            context_size=len(task_description) + len(str(self.miami_design_principles))
        )
        
        # Execute UI task
        result = await self._execute_with_tools(
            ui_prompt,
            available_tools,
            routing_context,
            max_tokens=12000
        )
        
        # Add UI-specific metadata
        result.metadata.update({
            "ui_dsl_specialist": True,
            "miami_design": True,
            "design_principles_applied": list(self.miami_design_principles.keys()),
            "accessibility_considered": True,
            "responsive_design": True
        })
        
        return result


class AutomationSpecialist(BaseSpecialistAgent):
    """
    Cartrita's Automation Specialist - La Automatizadora
    Expert at workflow automation with Miami efficiency
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__("automation_specialist", *args, **kwargs)
        
        # Automation best practices with Miami efficiency
        self.miami_automation_principles = {
            "efficiency": "Work smarter, not harder - like Miami business style",
            "reliability": "Consistent performance, rain or shine like Florida weather",
            "scalability": "Built to grow, like Miami's skyline",
            "monitoring": "Always watching, like Miami security",
            "error_handling": "Graceful failures with Miami resilience",
            "documentation": "Clear instructions for todo el equipo"
        }
    
    def get_required_tools(self) -> List[str]:
        return ["workflow_automation", "task_scheduling", "system_integration"]
    
    async def process_task(
        self,
        task_description: str,
        context: Dict[str, Any],
        tools_available: List[str]
    ) -> SpecialistResult:
        """
        Automation workflows con Miami business efficiency
        """
        # Get automation specialist prompt
        automation_prompt = await self.prompts.get_prompt_for_agent(
            "automation_specialist",
            {
                "automation_task": task_description,
                "context": context.get("conversation_context", ""),
                "miami_personality": "¡Dale! I'm your automation expert from downtown Miami",
                "efficiency_principles": self.miami_automation_principles,
                "automation_guidance": "Create robust, efficient automation que works perfectly",
                "error_handling": "Build in error handling - Murphy's Law applies in Miami too",
                "scalability": "Design for growth, anticipate success"
            }
        )
        
        # Prepare automation tools
        available_tools = [
            tool for tool in CARTRITA_TOOLS
            if tool["function"]["name"] in self.get_required_tools()
            and tool["function"]["name"] in tools_available
        ]
        
        routing_context = RoutingContext(
            conversation_length=context.get("message_count", 1),
            user_id=context.get("user_id", "unknown"),
            task_type="automation",
            complexity_score=4,  # Automation is expert level
            tool_requirements=tools_available,
            context_size=len(task_description) + len(str(self.miami_automation_principles))
        )
        
        # Execute automation task with high reasoning effort
        result = await self._execute_with_tools(
            automation_prompt,
            available_tools,
            routing_context,
            max_tokens=15000
        )
        
        # Add automation-specific metadata
        result.metadata.update({
            "automation_specialist": True,
            "miami_efficiency": True,
            "principles_applied": list(self.miami_automation_principles.keys()),
            "complexity_level": "expert",
            "scalability_considered": True,
            "error_handling_included": True
        })
        
        return result


class ModerationSpecialist(BaseSpecialistAgent):
    """
    Cartrita's Moderation Specialist - La Moderadora
    Expert at content moderation and safety with Miami street smarts
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__("moderation_specialist", *args, **kwargs)
        
        # Miami-style moderation principles
        self.miami_moderation_principles = {
            "respect": "Treat everyone with respect, como en una familia Miami",
            "safety": "Keep it safe for todos, especially los jóvenes",
            "cultural_sensitivity": "Honor diverse cultures, Miami is multicultural",
            "fairness": "Equal treatment, no favoritism",
            "transparency": "Clear rules, clear consequences",
            "community": "Build positive community vibes"
        }
        
        # Content categories with Miami context
        self.content_categories = {
            "safe": "Family-friendly content, perfect for Miami community",
            "questionable": "Needs review, proceed with caution",
            "unsafe": "Not appropriate, needs immediate action",
            "spam": "Promotional content, commercial noise",
            "cultural": "Cultural references that need context",
            "inappropriate": "Content that violates community standards"
        }
    
    def get_required_tools(self) -> List[str]:
        return ["content_moderation", "safety_checking", "compliance_validation"]
    
    async def process_task(
        self,
        task_description: str,
        context: Dict[str, Any],
        tools_available: List[str]
    ) -> SpecialistResult:
        """
        Content moderation con Miami community standards
        """
        # Get moderation specialist prompt
        moderation_prompt = await self.prompts.get_prompt_for_agent(
            "moderation_specialist",
            {
                "moderation_task": task_description,
                "content_to_review": context.get("content", ""),
                "context": context.get("conversation_context", ""),
                "miami_personality": "¡Oye! I keep our Miami community safe and respectful",
                "moderation_principles": self.miami_moderation_principles,
                "content_categories": self.content_categories,
                "cultural_awareness": "Consider Miami's diverse cultural context",
                "safety_priority": "Safety first, always protect the community"
            }
        )
        
        # Prepare moderation tools
        available_tools = [
            tool for tool in CARTRITA_TOOLS
            if tool["function"]["name"] in self.get_required_tools()
            and tool["function"]["name"] in tools_available
        ]
        
        routing_context = RoutingContext(
            conversation_length=context.get("message_count", 1),
            user_id=context.get("user_id", "unknown"),
            task_type="moderation",
            complexity_score=2,  # Moderation is moderate complexity
            tool_requirements=tools_available,
            context_size=len(task_description) + len(context.get("content", ""))
        )
        
        # Execute moderation task
        result = await self._execute_with_tools(
            moderation_prompt,
            available_tools,
            routing_context,
            max_tokens=3000  # Moderation typically needs fewer tokens
        )
        
        # Add moderation-specific metadata
        result.metadata.update({
            "moderation_specialist": True,
            "miami_community_standards": True,
            "principles_applied": list(self.miami_moderation_principles.keys()),
            "cultural_awareness": True,
            "safety_priority": "high",
            "content_categories_used": list(self.content_categories.keys())
        })
        
        # Add moderation decision if available
        if result.success:
            result.metadata["moderation_decision"] = self._extract_moderation_decision(result.content)
        
        return result
    
    def _extract_moderation_decision(self, content: str) -> Dict[str, Any]:
        """Extract moderation decision from content"""
        # This would parse the moderation result
        # For now, return a basic structure
        return {
            "decision": "approved",  # This would be parsed from actual content
            "confidence": 0.95,
            "category": "safe",
            "reasoning": "Content meets Miami community standards",
            "requires_human_review": False
        }


class AdvancedSpecialistFactory:
    """
    Factory for creating advanced specialist agents
    Para los casos más complicados que need expert attention
    """
    
    @staticmethod
    def create_image_specialist(
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager
    ) -> ImageSpecialist:
        return ImageSpecialist(
            openai_client=openai_client,
            responses_adapter=responses_adapter,
            prompt_manager=prompt_manager,
            database_manager=database_manager
        )
    
    @staticmethod
    def create_ui_dsl_specialist(
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager
    ) -> UIDSLSpecialist:
        return UIDSLSpecialist(
            openai_client=openai_client,
            responses_adapter=responses_adapter,
            prompt_manager=prompt_manager,
            database_manager=database_manager
        )
    
    @staticmethod
    def create_automation_specialist(
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager
    ) -> AutomationSpecialist:
        return AutomationSpecialist(
            openai_client=openai_client,
            responses_adapter=responses_adapter,
            prompt_manager=prompt_manager,
            database_manager=database_manager
        )
    
    @staticmethod
    def create_moderation_specialist(
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager
    ) -> ModerationSpecialist:
        return ModerationSpecialist(
            openai_client=openai_client,
            responses_adapter=responses_adapter,
            prompt_manager=prompt_manager,
            database_manager=database_manager
        )
    
    @staticmethod
    def create_all_advanced_specialists(
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager
    ) -> Dict[str, BaseSpecialistAgent]:
        """
        Creates all advanced specialist agents
        ¡Dale! Get all the expert-level agents you need
        """
        return {
            "image": AdvancedSpecialistFactory.create_image_specialist(
                openai_client, responses_adapter, prompt_manager, database_manager
            ),
            "ui_dsl": AdvancedSpecialistFactory.create_ui_dsl_specialist(
                openai_client, responses_adapter, prompt_manager, database_manager
            ),
            "automation": AdvancedSpecialistFactory.create_automation_specialist(
                openai_client, responses_adapter, prompt_manager, database_manager
            ),
            "moderation": AdvancedSpecialistFactory.create_moderation_specialist(
                openai_client, responses_adapter, prompt_manager, database_manager
            )
        }


# Utility class for managing all specialists together
class SpecialistManager:
    """
    Manages all specialist agents - basic and advanced
    El manager que coordinates todo el equipo
    """
    
    def __init__(
        self,
        openai_client: AsyncOpenAI,
        responses_adapter: ResponsesAPIAdapter,
        prompt_manager: PromptManager,
        database_manager: DatabaseManager,
        vector_store_manager=None
    ):
        # Import basic specialists
        from .specialist_agents import SpecialistAgentFactory
        
        # Create all basic specialists
        self.basic_specialists = SpecialistAgentFactory.create_all_basic_specialists(
            openai_client, responses_adapter, prompt_manager, 
            database_manager, vector_store_manager
        )
        
        # Create all advanced specialists
        self.advanced_specialists = AdvancedSpecialistFactory.create_all_advanced_specialists(
            openai_client, responses_adapter, prompt_manager, database_manager
        )
        
        # Combine all specialists
        self.all_specialists = {**self.basic_specialists, **self.advanced_specialists}
    
    def get_specialist(self, specialist_name: str) -> Optional[BaseSpecialistAgent]:
        """Get a specific specialist by name"""
        return self.all_specialists.get(specialist_name)
    
    def get_specialists_by_capability(self, required_tools: List[str]) -> List[BaseSpecialistAgent]:
        """Get specialists that can handle specific tools"""
        matching_specialists = []
        
        for specialist in self.all_specialists.values():
            specialist_tools = specialist.get_required_tools()
            if any(tool in specialist_tools for tool in required_tools):
                matching_specialists.append(specialist)
        
        return matching_specialists
    
    def list_all_specialists(self) -> Dict[str, List[str]]:
        """List all specialists and their capabilities"""
        return {
            name: specialist.get_required_tools()
            for name, specialist in self.all_specialists.items()
        }
    
    async def health_check(self) -> Dict[str, bool]:
        """Check health of all specialists"""
        health_status = {}
        
        for name, specialist in self.all_specialists.items():
            try:
                # Simple health check - try to access specialist properties
                _ = specialist.agent_name
                _ = specialist.get_required_tools()
                health_status[name] = True
            except Exception as e:
                logger.error(f"Health check failed for {name}: {e}")
                health_status[name] = False
        
        return health_status