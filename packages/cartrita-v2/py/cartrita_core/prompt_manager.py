"""
Cartrita V2 - Production Prompt Management System
Versioned prompt storage, retrieval, and template composition for OpenAI agents
Con Miami personality preservation across all versions
"""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field, asdict
from enum import Enum
import hashlib
import re
from string import Template

from pydantic import BaseModel, Field
from .database_manager import DatabaseManager


class PromptType(Enum):
    """Types of prompts in the system"""
    PERSONA_SYSTEM = "persona_system_prompt"
    AGENT_SYSTEM = "agent_system_prompt" 
    CHAIN_SYSTEM = "chain_system_prompt"
    TEMPLATE = "template_prompt"
    USER_INSTRUCTION = "user_instruction"


@dataclass
class PromptVersion:
    """Versioned prompt metadata"""
    id: str
    version: str
    content: str
    prompt_type: PromptType
    description: str
    model_compatibility: List[str]
    tokens_estimated: int
    usage_context: str
    created_at: datetime = field(default_factory=datetime.now)
    hash_signature: str = field(default="")
    
    def __post_init__(self):
        if not self.hash_signature:
            self.hash_signature = hashlib.sha256(self.content.encode()).hexdigest()[:12]


class PromptTemplate(BaseModel):
    """Template for dynamic prompt composition"""
    id: str
    name: str
    base_content: str
    variables: Dict[str, Any] = Field(default_factory=dict)
    required_vars: List[str] = Field(default_factory=list)
    optional_vars: Dict[str, Any] = Field(default_factory=dict)
    
    def render(self, **kwargs) -> str:
        """Render template with provided variables"""
        # Check required variables
        missing_vars = [var for var in self.required_vars if var not in kwargs]
        if missing_vars:
            raise ValueError(f"Missing required variables: {missing_vars}")
        
        # Merge with optional defaults
        render_vars = {**self.optional_vars, **kwargs}
        
        # Simple string formatting (can be extended to Jinja2 if needed)
        try:
            return self.base_content.format(**render_vars)
        except KeyError as e:
            raise ValueError(f"Template variable not provided: {e}")


class PromptManager:
    """
    Enhanced Production Prompt Management System for Cartrita V2
    Handles versioning, Miami personality preservation, and agent-specific prompts
    """
    
    def __init__(
        self, 
        database_manager: Optional[DatabaseManager] = None,
        prompts_dir: Optional[Path] = None, 
        logger: Optional[logging.Logger] = None
    ):
        self.db = database_manager
        self.prompts_dir = prompts_dir or Path(__file__).parent.parent / "prompts"
        self.versioned_dir = self.prompts_dir / "versioned"
        self.logger = logger or logging.getLogger("cartrita.prompt_manager")
        
        # In-memory storage
        self.prompts: Dict[str, Dict[str, PromptVersion]] = {}  # {prompt_id: {version: PromptVersion}}
        self.templates: Dict[str, PromptTemplate] = {}
        self.active_versions: Dict[str, str] = {}  # {prompt_id: active_version}
        
        # Miami personality components
        self.miami_personality_base = {
            "greeting_phrases": ["¡Oye!", "Dale pues", "¿Qué tal?", "Wepa"],
            "confirmations": ["¡Dale!", "¡Perfecto!", "¡Qué bueno!", "¡Así mismo!"],
            "transitions": ["Bueno mira", "OK entonces", "Vamos a ver", "A ver qué tal"],
            "cultural_references": ["como en Miami", "aquí en Hialeah", "estilo Miami", "con sabor"],
            "support_phrases": ["no te preocupes", "todo va a estar bien", "estoy aqui pa' ti"],
            "excitement": ["¡que chevere!", "¡ay dios mío!", "¡increíble!", "¡brutal!"]
        }
        
        # Agent-specific personality adaptations
        self.agent_personalities = {
            "retrieval_specialist": {
                "tone": "helpful_detective",
                "miami_flavor": "I'm your search expert from Hialeah, encontrando what you need!",
                "task_approach": "methodical with Miami efficiency"
            },
            "code_specialist": {
                "tone": "miami_developer", 
                "miami_flavor": "Coding with Miami street smarts and clean style",
                "task_approach": "efficient solutions que work perfectly"
            },
            "dataviz_specialist": {
                "tone": "creative_analyst",
                "miami_flavor": "Making data beautiful como South Beach sunsets",
                "task_approach": "visual storytelling with Miami aesthetic"
            },
            "web_research_specialist": {
                "tone": "curious_investigator",
                "miami_flavor": "Web detective from 305, finding the real info",
                "task_approach": "thorough research with Miami skepticism"
            },
            "image_specialist": {
                "tone": "creative_artist",
                "miami_flavor": "Visual artist from Miami Beach, creating with sabor",
                "task_approach": "artistic vision with tropical vibes"
            },
            "ui_dsl_specialist": {
                "tone": "design_maven",
                "miami_flavor": "UI designer from South Beach, clean and sophisticated",
                "task_approach": "user-friendly design con Miami style"
            },
            "automation_specialist": {
                "tone": "efficiency_expert",
                "miami_flavor": "Automation expert from downtown Miami business district",
                "task_approach": "smart workflows que scale like Miami skyline"
            },
            "moderation_specialist": {
                "tone": "community_guardian",
                "miami_flavor": "Keeping our Miami community safe and respectful",
                "task_approach": "fair but firm, protecting todos"
            }
        }
        
        # Performance tracking
        self.usage_stats: Dict[str, Dict[str, Any]] = {}
        self.version_performance: Dict[str, Dict[str, Any]] = {}
        
        # Initialize directories and load prompts
        self._ensure_directories()
        self._load_prompts()
        
        # Load Miami personality base prompts
        self._ensure_miami_base_prompts()
    
    def _ensure_directories(self):
        """Ensure prompt directories exist"""
        self.prompts_dir.mkdir(exist_ok=True)
        self.versioned_dir.mkdir(exist_ok=True)
        
        # Create manifest file if it doesn't exist
        manifest_path = self.versioned_dir / "manifest.json"
        if not manifest_path.exists():
            self._create_initial_manifest()
    
    def _create_initial_manifest(self):
        """Create initial manifest from extracted prompts"""
        manifest_path = self.versioned_dir / "manifest.json"
        
        initial_manifest = {
            "format_version": "1.0",
            "created_at": datetime.now().isoformat(),
            "prompts": {},
            "active_versions": {},
            "templates": {}
        }
        
        with open(manifest_path, 'w') as f:
            json.dump(initial_manifest, f, indent=2)
        
        self.logger.info(f"Created initial prompt manifest at {manifest_path}")
    
    def _load_prompts(self):
        """Load all prompts from versioned storage"""
        manifest_path = self.versioned_dir / "manifest.json"
        
        if not manifest_path.exists():
            self.logger.warning("No prompt manifest found, starting with empty state")
            return
        
        try:
            with open(manifest_path) as f:
                manifest = json.load(f)
            
            # Load prompt versions
            for prompt_id, versions in manifest.get("prompts", {}).items():
                self.prompts[prompt_id] = {}
                
                for version, prompt_data in versions.items():
                    # Load content from separate file if referenced
                    content = prompt_data.get("content", "")
                    if prompt_data.get("content_file"):
                        content_path = self.versioned_dir / prompt_data["content_file"]
                        if content_path.exists():
                            content = content_path.read_text(encoding="utf-8")
                    
                    self.prompts[prompt_id][version] = PromptVersion(
                        id=prompt_id,
                        version=version,
                        content=content,
                        prompt_type=PromptType(prompt_data.get("prompt_type", "agent_system_prompt")),
                        description=prompt_data.get("description", ""),
                        model_compatibility=prompt_data.get("model_compatibility", ["all"]),
                        tokens_estimated=prompt_data.get("tokens_estimated", 100),
                        usage_context=prompt_data.get("usage_context", "general"),
                        created_at=datetime.fromisoformat(prompt_data.get("created_at", datetime.now().isoformat())),
                        hash_signature=prompt_data.get("hash_signature", "")
                    )
            
            # Load active versions
            self.active_versions = manifest.get("active_versions", {})
            
            # Load templates
            for template_id, template_data in manifest.get("templates", {}).items():
                self.templates[template_id] = PromptTemplate(**template_data)
            
            self.logger.info(f"Loaded {len(self.prompts)} prompts with {sum(len(v) for v in self.prompts.values())} total versions")
            
        except Exception as e:
            self.logger.error(f"Error loading prompts: {e}")
            # Continue with empty state rather than failing
    
    def get_prompt(
        self, 
        prompt_id: str, 
        version: Optional[str] = None,
        model: Optional[str] = None
    ) -> Optional[PromptVersion]:
        """
        Get a specific prompt version
        
        Args:
            prompt_id: Unique prompt identifier
            version: Specific version (defaults to active version)
            model: Target model for compatibility check
        
        Returns:
            PromptVersion object or None if not found
        """
        if prompt_id not in self.prompts:
            self.logger.warning(f"Prompt not found: {prompt_id}")
            return None
        
        # Use active version if not specified
        if version is None:
            version = self.active_versions.get(prompt_id)
            if version is None:
                # Use latest version
                versions = list(self.prompts[prompt_id].keys())
                if not versions:
                    return None
                version = max(versions)  # Assumes semantic versioning
        
        if version not in self.prompts[prompt_id]:
            self.logger.warning(f"Version {version} not found for prompt {prompt_id}")
            return None
        
        prompt_version = self.prompts[prompt_id][version]
        
        # Check model compatibility if specified
        if model and "all" not in prompt_version.model_compatibility:
            if not any(model.startswith(compat) for compat in prompt_version.model_compatibility):
                self.logger.warning(f"Prompt {prompt_id}@{version} not compatible with model {model}")
                # Return anyway but log warning
        
        # Track usage
        self._track_usage(prompt_id, version, model)
        
        return prompt_version
    
    def add_prompt(
        self,
        prompt_id: str,
        content: str,
        version: str,
        prompt_type: PromptType,
        description: str,
        model_compatibility: List[str] = None,
        usage_context: str = "general",
        set_active: bool = True
    ) -> bool:
        """
        Add a new prompt version
        
        Args:
            prompt_id: Unique identifier for the prompt
            content: The actual prompt content
            version: Version string (e.g., "1.0", "2.1", "1.0-beta")
            prompt_type: Type of prompt
            description: Human-readable description
            model_compatibility: List of compatible models
            usage_context: Context where this prompt is used
            set_active: Whether to set this as the active version
        
        Returns:
            True if successfully added
        """
        try:
            if model_compatibility is None:
                model_compatibility = ["all"]
            
            # Estimate tokens (rough approximation)
            tokens_estimated = max(10, len(content) // 4)
            
            prompt_version = PromptVersion(
                id=prompt_id,
                version=version,
                content=content,
                prompt_type=prompt_type,
                description=description,
                model_compatibility=model_compatibility,
                tokens_estimated=tokens_estimated,
                usage_context=usage_context
            )
            
            # Initialize prompt_id if not exists
            if prompt_id not in self.prompts:
                self.prompts[prompt_id] = {}
            
            # Check for duplicate versions
            if version in self.prompts[prompt_id]:
                self.logger.warning(f"Overwriting existing version {version} for prompt {prompt_id}")
            
            self.prompts[prompt_id][version] = prompt_version
            
            # Set as active version if requested
            if set_active:
                self.active_versions[prompt_id] = version
            
            # Persist to disk
            self._save_prompts()
            
            self.logger.info(f"Added prompt {prompt_id}@{version} ({tokens_estimated} tokens)")
            return True
            
        except Exception as e:
            self.logger.error(f"Error adding prompt: {e}")
            return False
    
    def create_template(
        self,
        template_id: str,
        name: str,
        base_content: str,
        required_vars: List[str] = None,
        optional_vars: Dict[str, Any] = None
    ) -> bool:
        """Create a reusable prompt template"""
        try:
            template = PromptTemplate(
                id=template_id,
                name=name,
                base_content=base_content,
                required_vars=required_vars or [],
                optional_vars=optional_vars or {}
            )
            
            self.templates[template_id] = template
            self._save_prompts()
            
            self.logger.info(f"Created template {template_id}: {name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error creating template: {e}")
            return False
    
    def render_template(self, template_id: str, **kwargs) -> Optional[str]:
        """Render a template with provided variables"""
        if template_id not in self.templates:
            self.logger.error(f"Template not found: {template_id}")
            return None
        
        try:
            return self.templates[template_id].render(**kwargs)
        except ValueError as e:
            self.logger.error(f"Template rendering error: {e}")
            return None
    
    def get_prompt_for_agent(
        self,
        agent_type: str,
        model: str = "gpt-5-mini",
        fallback_to_generic: bool = True
    ) -> Optional[str]:
        """
        Get the appropriate prompt content for an agent type and model
        
        Args:
            agent_type: The type of agent (orchestrator, retrieval, code, etc.)
            model: Target model
            fallback_to_generic: Whether to fall back to generic prompts
        
        Returns:
            Prompt content string or None
        """
        # Try agent-specific prompt first
        agent_prompt_id = f"{agent_type}_specialist_v2"
        prompt_version = self.get_prompt(agent_prompt_id, model=model)
        
        if prompt_version:
            return prompt_version.content
        
        # Try legacy mapping
        legacy_mapping = {
            "orchestrator": "supervisor_agent_v2",
            "retrieval": "research_agent_v2", 
            "code": "code_writer_agent_v2",
            "dataviz": "data_scientist_agent_v2",
            "image_vision": "vision_agent_v2",
            "automation": "computer_use_agent_v2",
            "content_creation": "writer_agent_v2"
        }
        
        if agent_type in legacy_mapping:
            legacy_id = legacy_mapping[agent_type]
            prompt_version = self.get_prompt(legacy_id, model=model)
            if prompt_version:
                return prompt_version.content
        
        # Fallback to generic if requested
        if fallback_to_generic:
            generic_prompt = self.get_prompt("cartrita_main_persona_v1", model=model)
            if generic_prompt:
                return generic_prompt.content
        
        return None
    
    def _track_usage(self, prompt_id: str, version: str, model: Optional[str]):
        """Track prompt usage for analytics"""
        key = f"{prompt_id}@{version}"
        
        if key not in self.usage_stats:
            self.usage_stats[key] = {
                "usage_count": 0,
                "models_used": {},
                "first_used": datetime.now().isoformat(),
                "last_used": datetime.now().isoformat()
            }
        
        stats = self.usage_stats[key]
        stats["usage_count"] += 1
        stats["last_used"] = datetime.now().isoformat()
        
        if model:
            if model not in stats["models_used"]:
                stats["models_used"][model] = 0
            stats["models_used"][model] += 1
    
    def _save_prompts(self):
        """Persist prompts to disk"""
        manifest_path = self.versioned_dir / "manifest.json"
        
        try:
            # Build manifest structure
            manifest = {
                "format_version": "1.0",
                "last_updated": datetime.now().isoformat(),
                "prompts": {},
                "active_versions": self.active_versions,
                "templates": {tid: template.model_dump() for tid, template in self.templates.items()},
                "usage_stats": self.usage_stats
            }
            
            # Convert prompts to serializable format
            for prompt_id, versions in self.prompts.items():
                manifest["prompts"][prompt_id] = {}
                
                for version, prompt_version in versions.items():
                    # Save content to separate file for large prompts
                    content_file = None
                    if len(prompt_version.content) > 500:
                        content_file = f"{prompt_id}_{version}.md"
                        content_path = self.versioned_dir / content_file
                        content_path.write_text(prompt_version.content, encoding="utf-8")
                    
                    manifest["prompts"][prompt_id][version] = {
                        "prompt_type": prompt_version.prompt_type.value,
                        "description": prompt_version.description,
                        "model_compatibility": prompt_version.model_compatibility,
                        "tokens_estimated": prompt_version.tokens_estimated,
                        "usage_context": prompt_version.usage_context,
                        "created_at": prompt_version.created_at.isoformat(),
                        "hash_signature": prompt_version.hash_signature,
                        "content": prompt_version.content if content_file is None else "",
                        "content_file": content_file
                    }
            
            # Write manifest
            with open(manifest_path, 'w') as f:
                json.dump(manifest, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Error saving prompts: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get prompt manager statistics"""
        total_prompts = len(self.prompts)
        total_versions = sum(len(versions) for versions in self.prompts.values())
        total_templates = len(self.templates)
        total_usage = sum(stats.get("usage_count", 0) for stats in self.usage_stats.values())
        
        return {
            "total_prompts": total_prompts,
            "total_versions": total_versions, 
            "total_templates": total_templates,
            "total_usage": total_usage,
            "active_versions": len(self.active_versions),
            "usage_stats": self.usage_stats
        }
    
    def migrate_from_extracted_data(self, extracted_data_path: str) -> bool:
        """
        Migrate prompts from the extracted JSON data
        
        Args:
            extracted_data_path: Path to prompts_extracted.json
            
        Returns:
            True if migration successful
        """
        try:
            with open(extracted_data_path) as f:
                data = json.load(f)
            
            extracted_prompts = data["prompt_extraction_report"]["extracted_prompts"]
            
            # Migrate system level prompts
            for prompt_data in extracted_prompts.get("system_level", {}).values():
                self.add_prompt(
                    prompt_id=prompt_data["id"],
                    content=prompt_data["content"],
                    version=prompt_data["version"],
                    prompt_type=PromptType.PERSONA_SYSTEM,
                    description=prompt_data["description"],
                    model_compatibility=prompt_data["model_compatibility"],
                    usage_context=prompt_data["usage"]
                )
            
            # Migrate agent specialists
            for prompt_data in extracted_prompts.get("agent_specialists", {}).values():
                self.add_prompt(
                    prompt_id=prompt_data["id"],
                    content=prompt_data["content"], 
                    version=prompt_data["version"],
                    prompt_type=PromptType.AGENT_SYSTEM,
                    description=prompt_data["description"],
                    model_compatibility=prompt_data["model_compatibility"],
                    usage_context=prompt_data["usage"]
                )
            
            # Migrate enhanced agents
            for prompt_data in extracted_prompts.get("enhanced_agents", {}).values():
                self.add_prompt(
                    prompt_id=prompt_data["id"],
                    content=prompt_data["content"],
                    version=prompt_data["version"], 
                    prompt_type=PromptType.AGENT_SYSTEM,
                    description=prompt_data["description"],
                    model_compatibility=prompt_data["model_compatibility"],
                    usage_context=prompt_data["usage"]
                )
            
            # Migrate legacy chain prompts
            for prompt_data in extracted_prompts.get("legacy_chain_prompts", {}).values():
                self.add_prompt(
                    prompt_id=prompt_data["id"],
                    content=prompt_data["content"],
                    version=prompt_data["version"],
                    prompt_type=PromptType.CHAIN_SYSTEM,
                    description=prompt_data["description"],
                    model_compatibility=prompt_data["model_compatibility"],
                    usage_context=prompt_data["usage"]
                )
            
            self.logger.info("Successfully migrated prompts from extracted data")
            return True
            
        except Exception as e:
            self.logger.error(f"Error migrating prompts: {e}")
            return False


# Global prompt manager instance
_prompt_manager: Optional[PromptManager] = None


def get_prompt_manager() -> PromptManager:
    """Get global prompt manager instance"""
    global _prompt_manager
    if _prompt_manager is None:
        _prompt_manager = PromptManager()
    return _prompt_manager


def initialize_prompt_manager(prompts_dir: Optional[Path] = None, logger: Optional[logging.Logger] = None) -> PromptManager:
    """Initialize global prompt manager"""
    global _prompt_manager
    _prompt_manager = PromptManager(database_manager=None, prompts_dir=prompts_dir, logger=logger)
    return _prompt_manager