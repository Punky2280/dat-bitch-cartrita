"""
Cartrita V2 - Structured Output Validation System
JSON schema validation for all agent responses with Miami-style error handling
"""

import json
import logging
from typing import Dict, List, Optional, Any, Union, Tuple, Type
from dataclasses import dataclass, asdict
from enum import Enum
import jsonschema
from jsonschema import ValidationError, Draft7Validator
from datetime import datetime, timezone
import re

from .database_manager import DatabaseManager


class SchemaCategory(Enum):
    """Categories of response schemas"""
    AGENT_RESPONSE = "agent_response"
    TOOL_OUTPUT = "tool_output" 
    USER_INPUT = "user_input"
    SYSTEM_MESSAGE = "system_message"
    ORCHESTRATOR_DECISION = "orchestrator_decision"
    ANALYSIS_RESULT = "analysis_result"
    ERROR_RESPONSE = "error_response"


class ValidationLevel(Enum):
    """Validation strictness levels"""
    STRICT = "strict"  # All fields required, no extra fields
    LENIENT = "lenient"  # Required fields only, extra fields allowed
    LOOSE = "loose"  # Advisory validation, log warnings only


@dataclass
class ValidationResult:
    """Result of schema validation"""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    schema_version: str
    validation_level: ValidationLevel
    miami_error_message: Optional[str] = None
    suggestions: List[str] = None
    
    def __post_init__(self):
        if self.suggestions is None:
            self.suggestions = []


class MiamiErrorTranslator:
    """
    Translates technical JSON schema errors into Miami-style friendly messages
    """
    
    def __init__(self):
        self.error_translations = {
            "required": {
                "pattern": r"'(.+?)' is a required property",
                "miami_template": "Oye, falta el campo '{field}' que necesitamos para que esto funcione bien.",
                "suggestion": "Add the required field to your response"
            },
            "type_mismatch": {
                "pattern": r"(.+?) is not of type '(.+?)'",
                "miami_template": "Dale, el valor '{value}' no es del tipo {expected_type} que esperamos.",
                "suggestion": "Check the data type of your response"
            },
            "additional_properties": {
                "pattern": r"Additional properties are not allowed",
                "miami_template": "¡Wepa! Hay campos extra que no esperábamos en la respuesta.",
                "suggestion": "Remove unexpected fields from the response"
            },
            "enum_validation": {
                "pattern": r"'(.+?)' is not one of (.+)",
                "miami_template": "Mira, '{value}' no está en las opciones válidas: {options}.",
                "suggestion": "Use one of the allowed values"
            },
            "format_validation": {
                "pattern": r"'(.+?)' is not a '(.+?)'",
                "miami_template": "El formato de '{value}' no está correcto para {format_type}.",
                "suggestion": "Check the format requirements"
            }
        }
        
        self.miami_encouragements = [
            "¡No te preocupes! Vamos a arreglar esto juntos.",
            "¡Dale que podemos! Solo unos ajustes pequeños.",
            "¡Tranquilo! En Miami sabemos resolver problemas.",
            "¡Todo bien! Vamos paso a paso que llegamos."
        ]
    
    def translate_error(self, error_message: str) -> Dict[str, str]:
        """Translate technical error to Miami-friendly message"""
        for error_type, config in self.error_translations.items():
            match = re.search(config["pattern"], error_message, re.IGNORECASE)
            if match:
                groups = match.groups()
                miami_message = config["miami_template"]
                
                # Replace placeholders based on error type
                if error_type == "required" and groups:
                    miami_message = miami_message.format(field=groups[0])
                elif error_type == "type_mismatch" and len(groups) >= 2:
                    miami_message = miami_message.format(value=groups[0], expected_type=groups[1])
                elif error_type == "enum_validation" and len(groups) >= 2:
                    miami_message = miami_message.format(value=groups[0], options=groups[1])
                elif error_type == "format_validation" and len(groups) >= 2:
                    miami_message = miami_message.format(value=groups[0], format_type=groups[1])
                
                return {
                    "miami_error": miami_message,
                    "suggestion": config["suggestion"],
                    "error_type": error_type
                }
        
        # Fallback for unrecognized errors
        return {
            "miami_error": f"¡Ay! Algo no está bien con la respuesta: {error_message}",
            "suggestion": "Review the response format",
            "error_type": "unknown"
        }
    
    def get_encouragement(self) -> str:
        """Get random Miami encouragement"""
        import random
        return random.choice(self.miami_encouragements)


class CartritalSchemaRegistry:
    """
    Registry of all Cartrita response schemas
    Organized by agent type and response category
    """
    
    def __init__(self):
        self.schemas: Dict[str, Dict[str, Any]] = {}
        self.miami_translator = MiamiErrorTranslator()
        self._initialize_base_schemas()
    
    def _initialize_base_schemas(self):
        """Initialize core Cartrita response schemas"""
        
        # Base agent response schema
        self.schemas["agent_response_base"] = {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "Main response content with Miami personality"
                },
                "agent_type": {
                    "type": "string",
                    "enum": ["orchestrator", "retrieval", "code", "dataviz", "web_research", 
                            "image", "ui_dsl", "automation", "moderation"]
                },
                "success": {
                    "type": "boolean", 
                    "description": "Whether the task was completed successfully"
                },
                "miami_personality_indicators": {
                    "type": "object",
                    "properties": {
                        "greeting_used": {"type": ["string", "null"]},
                        "cultural_references": {"type": "array", "items": {"type": "string"}},
                        "spanish_phrases": {"type": "array", "items": {"type": "string"}},
                        "enthusiasm_level": {"type": "integer", "minimum": 1, "maximum": 5}
                    }
                },
                "metadata": {
                    "type": "object",
                    "additionalProperties": True
                },
                "timestamp": {
                    "type": "string",
                    "format": "date-time"
                }
            },
            "required": ["content", "agent_type", "success"],
            "additionalProperties": False
        }
        
        # Orchestrator decision schema
        self.schemas["orchestrator_decision"] = {
            "type": "object",
            "properties": {
                "primary_intent": {
                    "type": "string",
                    "description": "Main user intent identified"
                },
                "task_complexity": {
                    "type": "string",
                    "enum": ["simple", "moderate", "complex", "expert"]
                },
                "agents_needed": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["retrieval", "code", "dataviz", "web_research", 
                               "image", "ui_dsl", "automation", "moderation"]
                    }
                },
                "tools_required": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "estimated_tokens": {
                    "type": "integer",
                    "minimum": 0
                },
                "miami_mood": {
                    "type": "string",
                    "enum": ["excited", "focused", "supportive", "casual", "professional"]
                },
                "reasoning_path": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "urgency_level": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "critical"]
                }
            },
            "required": ["primary_intent", "task_complexity", "agents_needed"],
            "additionalProperties": False
        }
        
        # Tool execution result schema
        self.schemas["tool_execution_result"] = {
            "type": "object",
            "properties": {
                "tool_name": {
                    "type": "string",
                    "description": "Name of the executed tool"
                },
                "success": {
                    "type": "boolean"
                },
                "result": {
                    "type": ["string", "object", "array"],
                    "description": "Tool execution result"
                },
                "error_message": {
                    "type": ["string", "null"],
                    "description": "Error message if tool failed"
                },
                "miami_feedback": {
                    "type": "string",
                    "description": "Miami-style feedback about the tool execution"
                },
                "execution_time_ms": {
                    "type": "number",
                    "minimum": 0
                }
            },
            "required": ["tool_name", "success", "result"],
            "additionalProperties": False
        }
        
        # Error response schema
        self.schemas["error_response"] = {
            "type": "object",
            "properties": {
                "error": {
                    "type": "boolean",
                    "enum": [True]
                },
                "error_type": {
                    "type": "string",
                    "enum": ["validation", "execution", "timeout", "quota", "system", "user_input"]
                },
                "technical_message": {
                    "type": "string",
                    "description": "Technical error details"
                },
                "miami_message": {
                    "type": "string", 
                    "description": "User-friendly Miami-style error message"
                },
                "suggestions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Helpful suggestions to resolve the error"
                },
                "can_retry": {
                    "type": "boolean",
                    "description": "Whether the operation can be retried"
                },
                "support_reference": {
                    "type": ["string", "null"],
                    "description": "Reference ID for support if needed"
                }
            },
            "required": ["error", "error_type", "miami_message"],
            "additionalProperties": False
        }
        
        # Specialist agent schemas
        self._add_specialist_schemas()
    
    def _add_specialist_schemas(self):
        """Add schemas for each specialist agent"""
        
        # Retrieval specialist schema
        self.schemas["retrieval_response"] = {
            "allOf": [
                {"$ref": "#/definitions/agent_response_base"},
                {
                    "properties": {
                        "search_results": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "source": {"type": "string"},
                                    "relevance_score": {"type": "number", "minimum": 0, "maximum": 1},
                                    "content_snippet": {"type": "string"},
                                    "metadata": {"type": "object"}
                                },
                                "required": ["source", "relevance_score", "content_snippet"]
                            }
                        },
                        "total_results": {"type": "integer", "minimum": 0},
                        "search_quality": {"type": "string", "enum": ["excellent", "good", "fair", "poor"]}
                    }
                }
            ]
        }
        
        # Code specialist schema
        self.schemas["code_response"] = {
            "allOf": [
                {"$ref": "#/definitions/agent_response_base"},
                {
                    "properties": {
                        "code_blocks": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "language": {"type": "string"},
                                    "code": {"type": "string"},
                                    "explanation": {"type": "string"},
                                    "miami_comment": {"type": "string"}
                                },
                                "required": ["language", "code", "explanation"]
                            }
                        },
                        "execution_safe": {"type": "boolean"},
                        "dependencies": {"type": "array", "items": {"type": "string"}},
                        "miami_coding_tips": {"type": "array", "items": {"type": "string"}}
                    }
                }
            ]
        }
        
        # DataViz specialist schema  
        self.schemas["dataviz_response"] = {
            "allOf": [
                {"$ref": "#/definitions/agent_response_base"},
                {
                    "properties": {
                        "chart_config": {
                            "type": "object",
                            "properties": {
                                "chart_type": {"type": "string"},
                                "data": {"type": "array"},
                                "miami_color_scheme": {"type": "string"},
                                "responsive": {"type": "boolean"}
                            },
                            "required": ["chart_type", "data"]
                        },
                        "data_insights": {"type": "array", "items": {"type": "string"}},
                        "miami_aesthetic_notes": {"type": "string"}
                    }
                }
            ]
        }


class StructuredOutputValidator:
    """
    Main validation engine for Cartrita structured outputs
    Validates against schemas with Miami-style error reporting
    """
    
    def __init__(
        self, 
        database_manager: DatabaseManager,
        default_validation_level: ValidationLevel = ValidationLevel.LENIENT
    ):
        self.db = database_manager
        self.default_level = default_validation_level
        self.schema_registry = CartritalSchemaRegistry()
        self.logger = logging.getLogger("cartrita.schema_validator")
        
        # Performance tracking
        self.validation_stats = {
            "total_validations": 0,
            "successful_validations": 0,
            "failed_validations": 0,
            "schema_cache_hits": 0
        }
    
    def validate_agent_response(
        self,
        response_data: Dict[str, Any],
        agent_type: str,
        validation_level: Optional[ValidationLevel] = None
    ) -> ValidationResult:
        """
        Validate agent response against appropriate schema
        """
        try:
            level = validation_level or self.default_level
            schema_name = f"{agent_type}_response"
            
            # Fallback to base schema if agent-specific not found
            if schema_name not in self.schema_registry.schemas:
                schema_name = "agent_response_base"
            
            result = self._validate_against_schema(
                response_data, 
                schema_name, 
                level
            )
            
            # Add Miami personality check
            if result.is_valid:
                personality_check = self._validate_miami_personality(response_data)
                if personality_check["warnings"]:
                    result.warnings.extend(personality_check["warnings"])
            
            self._track_validation_result(agent_type, schema_name, result)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Validation error for {agent_type}: {e}")
            return ValidationResult(
                is_valid=False,
                errors=[f"Validation system error: {str(e)}"],
                warnings=[],
                schema_version="unknown",
                validation_level=level,
                miami_error_message="¡Ay! Something went wrong with validation, pero don't worry!"
            )
    
    def validate_orchestrator_decision(
        self,
        decision_data: Dict[str, Any],
        validation_level: Optional[ValidationLevel] = None
    ) -> ValidationResult:
        """
        Validate orchestrator routing decision
        """
        level = validation_level or self.default_level
        
        result = self._validate_against_schema(
            decision_data,
            "orchestrator_decision", 
            level
        )
        
        # Additional business logic validation
        if result.is_valid:
            business_validation = self._validate_orchestrator_business_logic(decision_data)
            result.warnings.extend(business_validation.get("warnings", []))
            if business_validation.get("errors"):
                result.is_valid = False
                result.errors.extend(business_validation["errors"])
        
        return result
    
    def validate_tool_output(
        self,
        tool_output: Dict[str, Any],
        tool_name: str,
        validation_level: Optional[ValidationLevel] = None
    ) -> ValidationResult:
        """
        Validate tool execution output
        """
        level = validation_level or self.default_level
        
        # Add tool name to data if not present
        if "tool_name" not in tool_output:
            tool_output["tool_name"] = tool_name
        
        return self._validate_against_schema(
            tool_output,
            "tool_execution_result",
            level
        )
    
    def _validate_against_schema(
        self,
        data: Dict[str, Any],
        schema_name: str,
        validation_level: ValidationLevel
    ) -> ValidationResult:
        """
        Core validation logic against JSON schema
        """
        self.validation_stats["total_validations"] += 1
        
        try:
            schema = self.schema_registry.schemas.get(schema_name)
            if not schema:
                self.logger.warning(f"Schema not found: {schema_name}")
                return ValidationResult(
                    is_valid=False,
                    errors=[f"Schema {schema_name} not found"],
                    warnings=[],
                    schema_version="unknown",
                    validation_level=validation_level,
                    miami_error_message="¡Oye! No encontramos el esquema para validar esto."
                )
            
            # Create validator with schema definitions
            schema_with_definitions = {
                **schema,
                "definitions": {
                    name: schema_def for name, schema_def in self.schema_registry.schemas.items()
                }
            }
            
            validator = Draft7Validator(schema_with_definitions)
            errors = []
            warnings = []
            miami_errors = []
            suggestions = []
            
            # Perform validation based on level
            if validation_level in [ValidationLevel.STRICT, ValidationLevel.LENIENT]:
                validation_errors = list(validator.iter_errors(data))
                
                for error in validation_errors:
                    error_message = error.message
                    errors.append(error_message)
                    
                    # Translate to Miami-friendly message
                    miami_translation = self.schema_registry.miami_translator.translate_error(error_message)
                    miami_errors.append(miami_translation["miami_error"])
                    suggestions.append(miami_translation["suggestion"])
                
                is_valid = len(errors) == 0
                
                if validation_level == ValidationLevel.STRICT:
                    # In strict mode, warnings become errors
                    pass  # Already handled above
                
            else:  # ValidationLevel.LOOSE
                # In loose mode, log warnings but don't fail validation
                validation_errors = list(validator.iter_errors(data))
                for error in validation_errors:
                    warnings.append(f"Advisory: {error.message}")
                
                is_valid = True  # Always pass in loose mode
            
            # Combine Miami error messages
            combined_miami_error = None
            if miami_errors:
                combined_miami_error = " ".join(miami_errors)
                encouragement = self.schema_registry.miami_translator.get_encouragement()
                combined_miami_error += f" {encouragement}"
            
            result = ValidationResult(
                is_valid=is_valid,
                errors=errors,
                warnings=warnings,
                schema_version=schema.get("$schema", "draft-07"),
                validation_level=validation_level,
                miami_error_message=combined_miami_error,
                suggestions=suggestions
            )
            
            if is_valid:
                self.validation_stats["successful_validations"] += 1
            else:
                self.validation_stats["failed_validations"] += 1
            
            return result
            
        except Exception as e:
            self.logger.error(f"Schema validation error: {e}")
            self.validation_stats["failed_validations"] += 1
            
            return ValidationResult(
                is_valid=False,
                errors=[f"Validation exception: {str(e)}"],
                warnings=[],
                schema_version="unknown",
                validation_level=validation_level,
                miami_error_message="¡Ay caramba! Validation broke pero we'll fix it!"
            )
    
    def _validate_miami_personality(self, response_data: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Check for Miami personality indicators in response
        """
        warnings = []
        content = response_data.get("content", "")
        
        if not content:
            return {"warnings": warnings}
        
        # Check for Spanish phrases
        spanish_indicators = ["dale", "oye", "wepa", "que tal", "bueno", "mira"]
        has_spanish = any(phrase in content.lower() for phrase in spanish_indicators)
        
        # Check for cultural references
        miami_references = ["miami", "hialeah", "south beach", "305", "doral", "biscayne"]
        has_cultural = any(ref in content.lower() for ref in miami_references)
        
        # Check for enthusiasm
        has_enthusiasm = "!" in content or any(word in content.lower() for word in ["increible", "brutal", "chevere"])
        
        if not has_spanish and not has_cultural:
            warnings.append("Oye, this response could use more Miami personality - add some Spanish phrases or cultural references!")
        
        if not has_enthusiasm:
            warnings.append("Add some Miami enthusiasm with exclamations or positive expressions!")
        
        return {"warnings": warnings}
    
    def _validate_orchestrator_business_logic(self, decision_data: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Validate orchestrator decision business logic
        """
        warnings = []
        errors = []
        
        agents_needed = decision_data.get("agents_needed", [])
        tools_required = decision_data.get("tools_required", [])
        task_complexity = decision_data.get("task_complexity", "moderate")
        
        # Business rule: Complex tasks should involve multiple agents
        if task_complexity in ["complex", "expert"] and len(agents_needed) < 2:
            warnings.append("Complex tasks typically benefit from multiple specialist agents")
        
        # Business rule: Ensure tool-agent compatibility
        tool_agent_mapping = {
            "file_search": ["retrieval"],
            "code_execution": ["code"],
            "chart_generation": ["dataviz"],
            "web_search": ["web_research"],
            "image_generation": ["image"]
        }
        
        for tool in tools_required:
            if tool in tool_agent_mapping:
                required_agents = tool_agent_mapping[tool]
                if not any(agent in agents_needed for agent in required_agents):
                    errors.append(f"Tool {tool} requires agent {required_agents} but none assigned")
        
        return {"warnings": warnings, "errors": errors}
    
    def _track_validation_result(self, agent_type: str, schema_name: str, result: ValidationResult):
        """
        Track validation results for analytics
        """
        # This could store validation metrics in the database for monitoring
        pass
    
    def get_validation_stats(self) -> Dict[str, Any]:
        """
        Get validation performance statistics
        """
        total = self.validation_stats["total_validations"]
        success_rate = (self.validation_stats["successful_validations"] / total * 100) if total > 0 else 0
        
        return {
            **self.validation_stats,
            "success_rate": round(success_rate, 2),
            "failure_rate": round(100 - success_rate, 2)
        }
    
    def register_custom_schema(
        self,
        schema_name: str,
        schema_definition: Dict[str, Any],
        category: SchemaCategory = SchemaCategory.AGENT_RESPONSE
    ) -> bool:
        """
        Register a custom schema for validation
        """
        try:
            # Validate the schema itself
            Draft7Validator.check_schema(schema_definition)
            
            # Add to registry
            self.schema_registry.schemas[schema_name] = schema_definition
            
            self.logger.info(f"Registered custom schema: {schema_name}")
            return True
            
        except jsonschema.SchemaError as e:
            self.logger.error(f"Invalid schema definition for {schema_name}: {e}")
            return False
        except Exception as e:
            self.logger.error(f"Failed to register schema {schema_name}: {e}")
            return False