"""
Enhanced Versioned Prompt Management System for Cartrita V2
Comprehensive versioning with Miami personality preservation
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import semantic_version
from pathlib import Path

from .database_manager import DatabaseManager
from .prompt_manager import PromptVersion, PromptType, PromptTemplate


class VersioningStrategy(Enum):
    """Versioning strategies for prompts"""
    SEMANTIC = "semantic"  # x.y.z versioning
    TIMESTAMP = "timestamp"  # YYYYMMDD_HHMMSS
    INCREMENTAL = "incremental"  # v1, v2, v3
    HASH_BASED = "hash"  # Short hash of content


@dataclass 
class PromptVersionMetadata:
    """Enhanced metadata for prompt versions"""
    version: str
    parent_version: Optional[str] = None
    branch: str = "main"
    author: str = "cartrita_system"
    commit_message: str = ""
    performance_metrics: Dict[str, float] = None
    a_b_test_results: Dict[str, Any] = None
    deployment_status: str = "development"  # development, staging, production
    rollback_safe: bool = True
    breaking_changes: List[str] = None
    miami_personality_score: float = 0.0  # 0-1 scale
    
    def __post_init__(self):
        if self.performance_metrics is None:
            self.performance_metrics = {}
        if self.a_b_test_results is None:
            self.a_b_test_results = {}
        if self.breaking_changes is None:
            self.breaking_changes = []


class MiamiPersonalityAnalyzer:
    """
    Analyzes and scores Miami personality preservation in prompts
    """
    
    def __init__(self):
        # Miami personality indicators with weights
        self.personality_indicators = {
            "spanish_phrases": {
                "patterns": [r"\b(dale|oye|wepa|que tal|bueno|mira|entonces)\b"],
                "weight": 0.2,
                "examples": ["dale", "oye", "wepa", "que tal"]
            },
            "cultural_references": {
                "patterns": [r"\b(miami|hialeah|305|south beach|biscayne|doral)\b"],
                "weight": 0.15,
                "examples": ["Miami", "Hialeah", "South Beach"]
            },
            "mixed_language": {
                "patterns": [r"\b(que|con|para|aqui|alla|todo|todos)\b"],
                "weight": 0.15,
                "examples": ["que", "con", "para"]
            },
            "supportive_tone": {
                "patterns": [r"\b(no te preocupes|todo va a estar bien|estoy aqui)\b"],
                "weight": 0.1,
                "examples": ["no te preocupes", "todo va a estar bien"]
            },
            "enthusiasm": {
                "patterns": [r"\b(increible|brutal|chevere|perfecto)\b", r"[!]{1,3}"],
                "weight": 0.1,
                "examples": ["¡increíble!", "¡brutal!", "¡chevere!"]
            },
            "casual_warmth": {
                "patterns": [r"\b(mi amor|papi|mami|chica|chico)\b"],
                "weight": 0.05,
                "examples": ["mi amor", "papi", "mami"]
            }
        }
    
    def analyze_personality_score(self, prompt_content: str) -> float:
        """
        Analyze prompt content and return Miami personality score (0-1)
        """
        import re
        
        content_lower = prompt_content.lower()
        total_score = 0.0
        max_possible = sum(indicator["weight"] for indicator in self.personality_indicators.values())
        
        for category, config in self.personality_indicators.items():
            category_score = 0.0
            
            for pattern in config["patterns"]:
                matches = len(re.findall(pattern, content_lower, re.IGNORECASE))
                if matches > 0:
                    # Score based on presence, not frequency to avoid keyword stuffing
                    category_score = config["weight"]
                    break
            
            total_score += category_score
        
        # Normalize to 0-1 scale
        normalized_score = total_score / max_possible if max_possible > 0 else 0.0
        return min(1.0, normalized_score)
    
    def suggest_personality_improvements(self, prompt_content: str) -> List[str]:
        """
        Suggest improvements to enhance Miami personality
        """
        current_score = self.analyze_personality_score(prompt_content)
        suggestions = []
        
        if current_score < 0.3:
            suggestions.append("Add Miami cultural references (e.g., 'aquí en Miami', 'estilo 305')")
            suggestions.append("Include Spanish phrases naturally (e.g., 'Dale', 'Oye', 'Qué tal')")
            suggestions.append("Add enthusiasm with exclamations (e.g., '¡Perfecto!', '¡Qué chevere!')")
        
        if current_score < 0.5:
            suggestions.append("Include supportive phrases ('no te preocupes', 'todo va a estar bien')")
            suggestions.append("Reference local places or concepts ('como en South Beach')")
        
        if current_score < 0.7:
            suggestions.append("Add casual warmth while maintaining professionalism")
            suggestions.append("Include transition phrases ('Bueno mira', 'OK entonces')")
        
        return suggestions


class VersionedPromptManager:
    """
    Advanced Versioned Prompt Management System
    Handles semantic versioning, A/B testing, and Miami personality preservation
    """
    
    def __init__(
        self,
        database_manager: DatabaseManager,
        versioning_strategy: VersioningStrategy = VersioningStrategy.SEMANTIC
    ):
        self.db = database_manager
        self.versioning_strategy = versioning_strategy
        self.personality_analyzer = MiamiPersonalityAnalyzer()
        self.logger = logging.getLogger("cartrita.versioned_prompts")
        
        # In-memory cache for performance
        self.version_cache: Dict[str, Dict[str, PromptVersion]] = {}
        self.metadata_cache: Dict[str, PromptVersionMetadata] = {}
        self.active_experiments: Dict[str, Dict[str, Any]] = {}
    
    async def create_prompt_version(
        self,
        prompt_id: str,
        content: str,
        version: Optional[str] = None,
        parent_version: Optional[str] = None,
        commit_message: str = "",
        author: str = "cartrita_system",
        branch: str = "main",
        **metadata_kwargs
    ) -> Tuple[str, PromptVersionMetadata]:
        """
        Create a new version of a prompt with full versioning support
        """
        try:
            # Generate version if not provided
            if version is None:
                version = await self._generate_next_version(prompt_id, branch)
            
            # Analyze Miami personality
            personality_score = self.personality_analyzer.analyze_personality_score(content)
            
            # Create prompt version
            prompt_version = PromptVersion(
                id=prompt_id,
                version=version,
                content=content,
                prompt_type=PromptType.AGENT_SYSTEM,  # Default, can be overridden
                description=commit_message or f"Version {version} of {prompt_id}",
                model_compatibility=["gpt-5-nano", "gpt-5-mini", "gpt-5"],
                tokens_estimated=len(content.split()) * 1.3,  # Rough estimate
                usage_context="agent_prompt"
            )
            
            # Create metadata
            metadata = PromptVersionMetadata(
                version=version,
                parent_version=parent_version,
                branch=branch,
                author=author,
                commit_message=commit_message,
                miami_personality_score=personality_score,
                **metadata_kwargs
            )
            
            # Store in database
            await self._store_prompt_version(prompt_version, metadata)
            
            # Update cache
            if prompt_id not in self.version_cache:
                self.version_cache[prompt_id] = {}
            self.version_cache[prompt_id][version] = prompt_version
            self.metadata_cache[f"{prompt_id}@{version}"] = metadata
            
            self.logger.info(f"Created prompt version {prompt_id}@{version} with personality score {personality_score:.2f}")
            
            return version, metadata
            
        except Exception as e:
            self.logger.error(f"Failed to create prompt version {prompt_id}@{version}: {e}")
            raise
    
    async def get_prompt_version(
        self,
        prompt_id: str,
        version: Optional[str] = None,
        branch: str = "main",
        environment: str = "production"
    ) -> Optional[Tuple[PromptVersion, PromptVersionMetadata]]:
        """
        Retrieve a specific prompt version with metadata
        """
        try:
            # Use latest version if not specified
            if version is None:
                version = await self._get_latest_version(prompt_id, branch, environment)
            
            if not version:
                return None
            
            # Check cache first
            cache_key = f"{prompt_id}@{version}"
            if prompt_id in self.version_cache and version in self.version_cache[prompt_id]:
                prompt_version = self.version_cache[prompt_id][version]
                metadata = self.metadata_cache.get(cache_key)
                if metadata:
                    return prompt_version, metadata
            
            # Retrieve from database
            prompt_version, metadata = await self._retrieve_prompt_version(prompt_id, version)
            
            if prompt_version and metadata:
                # Update cache
                if prompt_id not in self.version_cache:
                    self.version_cache[prompt_id] = {}
                self.version_cache[prompt_id][version] = prompt_version
                self.metadata_cache[cache_key] = metadata
            
            return prompt_version, metadata if prompt_version and metadata else None
            
        except Exception as e:
            self.logger.error(f"Failed to retrieve prompt version {prompt_id}@{version}: {e}")
            return None
    
    async def get_prompt_for_agent(
        self,
        agent_type: str,
        context_variables: Dict[str, Any],
        version: Optional[str] = None,
        branch: str = "main",
        environment: str = "production"
    ) -> Optional[str]:
        """
        Get agent-specific prompt with Miami personality and context injection
        """
        try:
            # Get the prompt version
            result = await self.get_prompt_version(
                f"{agent_type}_prompt",
                version=version,
                branch=branch,
                environment=environment
            )
            
            if not result:
                self.logger.warning(f"No prompt found for agent {agent_type}")
                return None
            
            prompt_version, metadata = result
            
            # Inject Miami personality context based on agent type
            miami_context = self._get_miami_context_for_agent(agent_type)
            enhanced_variables = {
                **context_variables,
                **miami_context,
                "miami_personality_score": metadata.miami_personality_score,
                "agent_type": agent_type
            }
            
            # Apply template rendering if needed
            rendered_prompt = self._render_prompt_template(
                prompt_version.content,
                enhanced_variables
            )
            
            # Track usage for analytics
            await self._track_prompt_usage(prompt_version.id, prompt_version.version, agent_type)
            
            return rendered_prompt
            
        except Exception as e:
            self.logger.error(f"Failed to get prompt for agent {agent_type}: {e}")
            return None
    
    async def start_a_b_test(
        self,
        prompt_id: str,
        version_a: str,
        version_b: str,
        test_name: str,
        traffic_split: float = 0.5,
        success_metrics: List[str] = None,
        max_duration_hours: int = 72
    ) -> str:
        """
        Start A/B test between two prompt versions
        """
        try:
            experiment_id = f"ab_test_{prompt_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
            
            experiment_config = {
                "experiment_id": experiment_id,
                "prompt_id": prompt_id,
                "version_a": version_a,
                "version_b": version_b,
                "test_name": test_name,
                "traffic_split": traffic_split,
                "success_metrics": success_metrics or ["user_satisfaction", "task_completion"],
                "start_time": datetime.now(timezone.utc),
                "max_duration_hours": max_duration_hours,
                "status": "active",
                "results": {"version_a": {}, "version_b": {}}
            }
            
            # Store experiment in database
            await self._store_experiment(experiment_config)
            
            # Update active experiments cache
            self.active_experiments[experiment_id] = experiment_config
            
            self.logger.info(f"Started A/B test {experiment_id} for prompt {prompt_id}")
            
            return experiment_id
            
        except Exception as e:
            self.logger.error(f"Failed to start A/B test for {prompt_id}: {e}")
            raise
    
    async def promote_version_to_production(
        self,
        prompt_id: str,
        version: str,
        rollback_plan: Optional[str] = None
    ) -> bool:
        """
        Promote a prompt version to production with safety checks
        """
        try:
            # Retrieve version and metadata
            result = await self.get_prompt_version(prompt_id, version)
            if not result:
                self.logger.error(f"Version {version} not found for prompt {prompt_id}")
                return False
            
            prompt_version, metadata = result
            
            # Safety checks
            if not metadata.rollback_safe:
                self.logger.error(f"Version {version} marked as not rollback safe")
                return False
            
            # Check Miami personality score threshold
            if metadata.miami_personality_score < 0.3:
                self.logger.warning(f"Low Miami personality score ({metadata.miami_personality_score:.2f}) for version {version}")
                suggestions = self.personality_analyzer.suggest_personality_improvements(prompt_version.content)
                self.logger.info(f"Personality improvement suggestions: {suggestions}")
            
            # Update deployment status
            metadata.deployment_status = "production"
            
            # Store promotion record
            await self._store_promotion_record(prompt_id, version, rollback_plan)
            
            # Update database
            await self._update_prompt_metadata(prompt_id, version, metadata)
            
            self.logger.info(f"Promoted prompt {prompt_id}@{version} to production")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to promote version {prompt_id}@{version}: {e}")
            return False
    
    def _get_miami_context_for_agent(self, agent_type: str) -> Dict[str, str]:
        """Get Miami personality context specific to agent type"""
        base_context = {
            "miami_greeting": "¡Oye!",
            "miami_confirmation": "¡Dale!",
            "miami_transition": "Bueno mira",
            "cultural_reference": "aquí en Miami"
        }
        
        # Agent-specific Miami context
        agent_contexts = {
            "retrieval_specialist": {
                "miami_flavor": "I'm your search expert from Hialeah, encontrando what you need!",
                "task_approach": "methodical with Miami efficiency"
            },
            "code_specialist": {
                "miami_flavor": "Coding with Miami street smarts and clean style",
                "task_approach": "efficient solutions que work perfectly"
            },
            "dataviz_specialist": {
                "miami_flavor": "Making data beautiful como South Beach sunsets",
                "task_approach": "visual storytelling with Miami aesthetic"
            },
            # Add more agent-specific contexts as needed
        }
        
        agent_context = agent_contexts.get(agent_type, {})
        return {**base_context, **agent_context}
    
    def _render_prompt_template(self, template: str, variables: Dict[str, Any]) -> str:
        """Render prompt template with variables"""
        try:
            from string import Template
            template_obj = Template(template)
            return template_obj.safe_substitute(variables)
        except Exception as e:
            self.logger.warning(f"Template rendering failed: {e}")
            return template
    
    async def _generate_next_version(self, prompt_id: str, branch: str) -> str:
        """Generate next version number based on strategy"""
        if self.versioning_strategy == VersioningStrategy.SEMANTIC:
            latest = await self._get_latest_semantic_version(prompt_id, branch)
            if not latest:
                return "1.0.0"
            version = semantic_version.Version(latest)
            return str(version.next_patch())
        
        elif self.versioning_strategy == VersioningStrategy.TIMESTAMP:
            return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        
        elif self.versioning_strategy == VersioningStrategy.INCREMENTAL:
            latest_num = await self._get_latest_incremental_version(prompt_id, branch)
            return f"v{latest_num + 1}"
        
        else:  # HASH_BASED
            return hashlib.sha256(f"{prompt_id}_{datetime.now(timezone.utc).isoformat()}".encode()).hexdigest()[:12]
    
    async def _store_prompt_version(self, prompt_version: PromptVersion, metadata: PromptVersionMetadata):
        """Store prompt version and metadata in database"""
        # This would use the database manager to store the version
        pass
    
    async def _retrieve_prompt_version(self, prompt_id: str, version: str) -> Tuple[Optional[PromptVersion], Optional[PromptVersionMetadata]]:
        """Retrieve prompt version and metadata from database"""
        # This would use the database manager to retrieve the version
        return None, None
    
    async def _get_latest_version(self, prompt_id: str, branch: str, environment: str) -> Optional[str]:
        """Get latest version for specified criteria"""
        # This would query the database for the latest version
        return None
    
    async def _track_prompt_usage(self, prompt_id: str, version: str, agent_type: str):
        """Track prompt usage for analytics"""
        # This would update usage statistics in the database
        pass
    
    async def _store_experiment(self, experiment_config: Dict[str, Any]):
        """Store A/B test experiment configuration"""
        # This would store the experiment in the database
        pass
    
    async def _store_promotion_record(self, prompt_id: str, version: str, rollback_plan: Optional[str]):
        """Store production promotion record"""
        # This would store the promotion record for audit trails
        pass
    
    async def _update_prompt_metadata(self, prompt_id: str, version: str, metadata: PromptVersionMetadata):
        """Update prompt metadata in database"""
        # This would update the metadata in the database
        pass
    
    async def _get_latest_semantic_version(self, prompt_id: str, branch: str) -> Optional[str]:
        """Get latest semantic version"""
        # This would query for the latest semantic version
        return None
    
    async def _get_latest_incremental_version(self, prompt_id: str, branch: str) -> int:
        """Get latest incremental version number"""
        # This would query for the latest incremental version
        return 0


# Backward compatibility alias  
PromptManager = VersionedPromptManager

# Also add backward compatibility in prompt_manager.py
from .versioned_prompt_system import VersionedPromptManager as NewVersionedPromptManager