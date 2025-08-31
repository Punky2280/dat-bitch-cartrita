"""
Concrete Orchestrator Agent Implementation
Complete working example of the hierarchical agent orchestrator with dynamic routing
"""

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union, Callable, Type
from enum import Enum
import traceback
from pathlib import Path

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

# Import our enhanced components
from responses_adapter import ResponsesAPIAdapter, ModelRouter, RoutingContext
from enhanced_compression_utility import EnhancedContextCompressor, CompressionConfig
from human_override_service import HumanOverrideService, OverrideTargetType, OverrideStatus


logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Task execution status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"
    ESCALATED = "escalated"
    CANCELLED = "cancelled"


class AgentCapability(str, Enum):
    """Agent capabilities"""
    RETRIEVAL = "retrieval"
    CODE_GENERATION = "code_generation"
    CODE_ANALYSIS = "code_analysis"
    DATA_VISUALIZATION = "data_visualization"
    WEB_RESEARCH = "web_research"
    IMAGE_GENERATION = "image_generation"
    UI_GENERATION = "ui_generation"
    AUTOMATION = "automation"
    MODERATION = "moderation"
    VOICE_INTERACTION = "voice_interaction"


class EscalationReason(str, Enum):
    """Reasons for task escalation"""
    REPEATED_FAILURES = "repeated_failures"
    COMPLEXITY_EXCEEDED = "complexity_exceeded"
    SAFETY_CONCERNS = "safety_concerns"
    RESOURCE_CONSTRAINTS = "resource_constraints"
    HUMAN_APPROVAL_REQUIRED = "human_approval_required"
    TOOL_UNAVAILABLE = "tool_unavailable"


@dataclass
class TaskStep:
    """Individual step in a task plan"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    intent: str = ""
    description: str = ""
    assigned_agent: Optional[str] = None
    inputs_needed: List[str] = field(default_factory=list)
    success_criteria: str = ""
    status: TaskStatus = TaskStatus.PENDING
    
    # Execution details
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    attempt_count: int = 0
    max_attempts: int = 3
    
    # Results
    output: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0
    
    # Dependencies
    depends_on: List[str] = field(default_factory=list)
    blocks: List[str] = field(default_factory=list)
    
    # Resource requirements
    required_tools: List[str] = field(default_factory=list)
    estimated_cost: float = 0.0
    timeout_seconds: float = 300.0


@dataclass
class TaskPlan:
    """Complete task execution plan"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    overall_goal: str = ""
    user_id: str = "anonymous"
    conversation_id: Optional[str] = None
    
    # Plan structure
    steps: List[TaskStep] = field(default_factory=list)
    intents: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    success_criteria: str = ""
    
    # Execution state
    status: TaskStatus = TaskStatus.PENDING
    current_step_id: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Resource tracking
    estimated_total_cost: float = 0.0
    actual_total_cost: float = 0.0
    max_budget: float = 1.0
    
    # Quality tracking
    completed_steps: int = 0
    failed_steps: int = 0
    escalated_steps: int = 0
    
    # Context
    original_request: str = ""
    compressed_context: Optional[str] = None
    memory_object: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_complete(self) -> bool:
        return self.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]
    
    @property
    def progress_percentage(self) -> float:
        if not self.steps:
            return 0.0
        completed = sum(1 for step in self.steps if step.status == TaskStatus.COMPLETED)
        return (completed / len(self.steps)) * 100


class SpecialistAgent:
    """Base class for specialist agents"""
    
    def __init__(
        self,
        name: str,
        capabilities: List[AgentCapability],
        prompt_template: str,
        model_preference: str = "gpt-5-mini",
        tools: Optional[List[str]] = None
    ):
        self.name = name
        self.capabilities = capabilities
        self.prompt_template = prompt_template
        self.model_preference = model_preference
        self.tools = tools or []
        self.stats = {
            'tasks_completed': 0,
            'tasks_failed': 0,
            'avg_execution_time': 0.0,
            'success_rate': 1.0
        }
    
    async def execute_step(
        self,
        step: TaskStep,
        context: Dict[str, Any],
        responses_adapter: ResponsesAPIAdapter
    ) -> Dict[str, Any]:
        """Execute a task step"""
        
        start_time = time.time()
        step.started_at = datetime.now(timezone.utc)
        step.status = TaskStatus.IN_PROGRESS
        step.attempt_count += 1
        
        try:
            # Prepare context-aware prompt
            prompt = self._prepare_prompt(step, context)
            
            # Create routing context
            routing_context = RoutingContext(
                intents=[step.intent],
                complexity="high" if step.attempt_count > 1 else "low",
                prior_failures=step.attempt_count - 1
            )
            
            # Prepare tools if needed
            tools = self._prepare_tools(step) if step.required_tools else None
            
            # Execute via Responses API
            result = await responses_adapter.create_response(
                input_messages=[
                    {"role": "system", "content": self.prompt_template},
                    {"role": "user", "content": prompt}
                ],
                routing_context=routing_context,
                tools=tools,
                conversation_id=context.get('conversation_id')
            )
            
            if result.get('success'):
                step.status = TaskStatus.COMPLETED
                step.output = {
                    'content': result.get('content', ''),
                    'tool_calls': result.get('tool_calls', []),
                    'model_used': result.get('model'),
                    'metadata': result.get('usage', {})
                }
                self.stats['tasks_completed'] += 1
            else:
                raise Exception(result.get('error', 'Unknown error'))
        
        except Exception as e:
            logger.error(f"Step execution failed: {e}")
            step.status = TaskStatus.FAILED
            step.error_message = str(e)
            self.stats['tasks_failed'] += 1
            
            # Check for escalation conditions
            if step.attempt_count >= step.max_attempts:
                step.status = TaskStatus.ESCALATED
        
        finally:
            step.completed_at = datetime.now(timezone.utc)
            step.execution_time_ms = (time.time() - start_time) * 1000
            self._update_stats(step.execution_time_ms)
        
        return step.output or {}
    
    def _prepare_prompt(self, step: TaskStep, context: Dict[str, Any]) -> str:
        """Prepare context-aware prompt for the step"""
        
        prompt_parts = [
            f"Task: {step.description}",
            f"Success criteria: {step.success_criteria}",
        ]
        
        # Add context information
        if context.get('overall_goal'):
            prompt_parts.append(f"Overall goal: {context['overall_goal']}")
        
        if context.get('previous_outputs'):
            prompt_parts.append("Previous step outputs:")
            for prev_step_id, output in context['previous_outputs'].items():
                prompt_parts.append(f"- {prev_step_id}: {str(output)[:200]}...")
        
        if step.inputs_needed:
            prompt_parts.append(f"Required inputs: {', '.join(step.inputs_needed)}")
        
        # Add attempt information if this is a retry
        if step.attempt_count > 1:
            prompt_parts.append(f"Attempt #{step.attempt_count} - Previous attempts failed.")
            if step.error_message:
                prompt_parts.append(f"Previous error: {step.error_message}")
        
        return "\n\n".join(prompt_parts)
    
    def _prepare_tools(self, step: TaskStep) -> List[Dict[str, Any]]:
        """Prepare tool configuration for the step"""
        
        # This would map tool names to actual tool definitions
        tool_definitions = {
            'file_search': {
                'type': 'file_search',
                'description': 'Search through uploaded documents'
            },
            'code_interpreter': {
                'type': 'code_interpreter',
                'description': 'Execute Python code in a sandboxed environment'
            },
            'web_search_preview': {
                'type': 'web_search_preview',
                'description': 'Search the web for current information'
            },
            'image_generation': {
                'type': 'image_generation',
                'description': 'Generate images from text descriptions'
            }
        }
        
        return [tool_definitions.get(tool) for tool in step.required_tools if tool in tool_definitions]
    
    def _update_stats(self, execution_time_ms: float):
        """Update agent performance statistics"""
        total_tasks = self.stats['tasks_completed'] + self.stats['tasks_failed']
        if total_tasks > 0:
            self.stats['success_rate'] = self.stats['tasks_completed'] / total_tasks
            
            # Update average execution time
            current_avg = self.stats['avg_execution_time']
            self.stats['avg_execution_time'] = (
                (current_avg * (total_tasks - 1) + execution_time_ms) / total_tasks
            )


class OrchestratorAgent:
    """Main orchestrator agent implementation"""
    
    def __init__(
        self,
        responses_adapter: ResponsesAPIAdapter,
        compression_utility: Optional[EnhancedContextCompressor] = None,
        override_service: Optional[HumanOverrideService] = None
    ):
        self.responses_adapter = responses_adapter
        self.compression_utility = compression_utility
        self.override_service = override_service
        
        # Initialize specialist agents
        self.specialists = self._initialize_specialists()
        
        # Execution state
        self.active_tasks: Dict[str, TaskPlan] = {}
        self.task_history: List[str] = []
        
        # Performance tracking
        self.stats = {
            'total_tasks': 0,
            'successful_tasks': 0,
            'failed_tasks': 0,
            'escalated_tasks': 0,
            'avg_completion_time': 0.0
        }
    
    def _initialize_specialists(self) -> Dict[str, SpecialistAgent]:
        """Initialize specialist agents"""
        
        specialists = {}
        
        # Retrieval Agent
        specialists['retrieval'] = SpecialistAgent(
            name="RetrievalSpecialist",
            capabilities=[AgentCapability.RETRIEVAL],
            prompt_template="""You are a Retrieval Specialist. Your role is to find and synthesize relevant information from available sources.

CAPABILITIES:
- Search through documents using file_search
- Research current information via web_search_preview
- Synthesize multiple sources into coherent summaries
- Provide properly cited responses

OUTPUT REQUIREMENTS:
- Always cite your sources
- Indicate confidence level (high/medium/low)
- Flag any information gaps
- Provide structured JSON output when possible

SAFETY:
- Never fabricate information
- Distinguish between verified facts and claims
- Indicate when information might be outdated""",
            tools=['file_search', 'web_search_preview']
        )
        
        # Code Agent
        specialists['code'] = SpecialistAgent(
            name="CodeSpecialist",
            capabilities=[AgentCapability.CODE_GENERATION, AgentCapability.CODE_ANALYSIS],
            prompt_template="""You are a Code Specialist. Your role is to analyze, generate, and debug code across multiple languages.

CAPABILITIES:
- Write clean, well-documented code
- Debug and fix existing code
- Perform code reviews and analysis
- Execute code for testing and validation

OUTPUT REQUIREMENTS:
- Follow language-specific best practices
- Include comprehensive error handling
- Provide clear documentation
- Test code when possible using code_interpreter

SAFETY:
- Never execute potentially harmful code
- Validate inputs and sanitize outputs
- Follow security best practices
- Avoid network operations in code_interpreter""",
            tools=['code_interpreter', 'file_search']
        )
        
        # Data Visualization Agent
        specialists['dataviz'] = SpecialistAgent(
            name="DataVizSpecialist", 
            capabilities=[AgentCapability.DATA_VISUALIZATION],
            prompt_template="""You are a Data Visualization Specialist. Create insightful charts and analyze datasets.

CAPABILITIES:
- Generate various chart types (bar, line, scatter, etc.)
- Perform statistical analysis
- Identify patterns and trends
- Create interactive visualizations

OUTPUT REQUIREMENTS:
- Choose appropriate visualization types
- Include clear labels and titles
- Provide data insights summary
- Export charts as files when needed

ANALYSIS APPROACH:
1. Understand the data structure
2. Identify key metrics and relationships
3. Select optimal visualization methods
4. Generate charts with proper styling
5. Provide actionable insights""",
            tools=['code_interpreter']
        )
        
        # Web Research Agent
        specialists['web_research'] = SpecialistAgent(
            name="WebResearchSpecialist",
            capabilities=[AgentCapability.WEB_RESEARCH],
            prompt_template="""You are a Web Research Specialist. Find current, accurate information from web sources.

CAPABILITIES:
- Search for recent information and news
- Verify information across multiple sources
- Identify credible and authoritative sources
- Track developing stories and trends

OUTPUT REQUIREMENTS:
- Cite all sources with URLs when available
- Indicate publication dates
- Note any conflicting information
- Provide confidence ratings

SEARCH STRATEGY:
1. Use specific, targeted search queries
2. Cross-reference multiple sources
3. Prioritize authoritative sources
4. Flag potential bias or conflicts of interest""",
            tools=['web_search_preview']
        )
        
        # Image Generation Agent
        specialists['image'] = SpecialistAgent(
            name="ImageSpecialist",
            capabilities=[AgentCapability.IMAGE_GENERATION],
            prompt_template="""You are an Image Generation Specialist. Create visual content based on descriptions.

CAPABILITIES:
- Generate images from text descriptions
- Refine and iterate on visual concepts
- Suggest visual improvements
- Ensure appropriate content

PROMPT ENGINEERING:
- Create detailed, specific prompts
- Include style, composition, and technical details
- Consider lighting, color palette, and mood
- Specify resolution and format requirements

SAFETY:
- Avoid generating inappropriate content
- Respect copyright and intellectual property
- Follow content policy guidelines
- Provide content warnings when necessary""",
            tools=['image_generation']
        )
        
        # UI Generation Agent
        specialists['ui'] = SpecialistAgent(
            name="UISpecialist",
            capabilities=[AgentCapability.UI_GENERATION],
            prompt_template="""You are a UI Generation Specialist. Create user interface specifications and components.

CAPABILITIES:
- Design component hierarchies
- Generate structured UI specifications
- Follow accessibility guidelines
- Create responsive layouts

OUTPUT REQUIREMENTS:
- Use provided JSON schema strictly
- Include proper component nesting
- Specify accessibility attributes
- Provide clear labels and descriptions

DESIGN PRINCIPLES:
- Prioritize usability and accessibility
- Follow consistent design patterns
- Minimize cognitive load
- Ensure mobile-responsive design""",
            model_preference="gpt-5"  # Better for structured output
        )
        
        # Moderation Agent
        specialists['moderation'] = SpecialistAgent(
            name="ModerationSpecialist",
            capabilities=[AgentCapability.MODERATION],
            prompt_template="""You are a Moderation Specialist. Classify and assess content for safety and compliance.

CAPABILITIES:
- Detect policy violations
- Assess content safety
- Provide remediation guidance
- Flag edge cases for human review

CLASSIFICATION CATEGORIES:
- Violence and harm
- Sexual content
- Hate speech
- Self-harm
- Privacy violations (PII)
- Misinformation

OUTPUT REQUIREMENTS:
- Provide structured JSON assessments
- Include confidence scores
- Suggest remediation actions
- Flag borderline cases for human review""",
            model_preference="gpt-5-nano"  # Fast classification
        )
        
        return specialists
    
    async def execute_task(
        self,
        request: str,
        user_id: str = "anonymous",
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        constraints: Optional[List[str]] = None
    ) -> TaskPlan:
        """Execute a complete task with orchestration"""
        
        start_time = time.time()
        self.stats['total_tasks'] += 1
        
        try:
            # Step 1: Plan the task
            task_plan = await self._create_task_plan(
                request, user_id, conversation_id, context, constraints
            )
            
            # Store in active tasks
            self.active_tasks[task_plan.id] = task_plan
            task_plan.status = TaskStatus.IN_PROGRESS
            task_plan.started_at = datetime.now(timezone.utc)
            
            # Step 2: Execute plan steps
            await self._execute_task_plan(task_plan)
            
            # Step 3: Finalize results
            self._finalize_task(task_plan)
            
            # Update statistics
            completion_time = (time.time() - start_time) * 1000
            self._update_orchestrator_stats(task_plan, completion_time)
            
            return task_plan
            
        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            logger.error(traceback.format_exc())
            
            # Create failure task plan if one doesn't exist
            if 'task_plan' not in locals():
                task_plan = TaskPlan(
                    overall_goal=request,
                    user_id=user_id,
                    conversation_id=conversation_id,
                    status=TaskStatus.FAILED,
                    original_request=request
                )
            else:
                task_plan.status = TaskStatus.FAILED
            
            self.stats['failed_tasks'] += 1
            return task_plan
    
    async def _create_task_plan(
        self,
        request: str,
        user_id: str,
        conversation_id: Optional[str],
        context: Optional[Dict[str, Any]],
        constraints: Optional[List[str]]
    ) -> TaskPlan:
        """Create a detailed task execution plan"""
        
        # Prepare planning context
        planning_context = {
            'user_request': request,
            'user_id': user_id,
            'conversation_id': conversation_id,
            'available_agents': list(self.specialists.keys()),
            'constraints': constraints or []
        }
        
        if context:
            planning_context['additional_context'] = context
        
        # Create orchestrator prompt
        orchestrator_prompt = self._create_orchestrator_prompt(planning_context)
        
        # Use structured output for plan generation
        structured_schema = {
            "type": "json_schema",
            "json_schema": {
                "name": "task_plan",
                "strict": True,
                "schema": {
                    "type": "object",
                    "required": ["overall_goal", "intents", "plan_steps", "success_criteria", "estimated_cost"],
                    "properties": {
                        "overall_goal": {"type": "string"},
                        "intents": {"type": "array", "items": {"type": "string"}},
                        "plan_steps": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["intent", "description", "assigned_agent", "success_criteria"],
                                "properties": {
                                    "intent": {"type": "string"},
                                    "description": {"type": "string"},
                                    "assigned_agent": {"type": "string"},
                                    "inputs_needed": {"type": "array", "items": {"type": "string"}},
                                    "success_criteria": {"type": "string"},
                                    "required_tools": {"type": "array", "items": {"type": "string"}},
                                    "depends_on": {"type": "array", "items": {"type": "string"}},
                                    "estimated_cost": {"type": "number"}
                                },
                                "additionalProperties": False
                            }
                        },
                        "success_criteria": {"type": "string"},
                        "estimated_cost": {"type": "number"},
                        "constraints": {"type": "array", "items": {"type": "string"}},
                        "escalation_needed": {"type": "boolean"}
                    },
                    "additionalProperties": False
                }
            }
        }
        
        # Generate plan via Responses API
        routing_context = RoutingContext(
            intents=['orchestration', 'planning'],
            complexity='high',
            estimated_output_tokens=800
        )
        
        result = await self.responses_adapter.create_response(
            input_messages=[
                {"role": "system", "content": self._get_orchestrator_system_prompt()},
                {"role": "user", "content": orchestrator_prompt}
            ],
            routing_context=routing_context,
            structured_output=structured_schema,
            conversation_id=conversation_id
        )
        
        if not result.get('success'):
            raise Exception(f"Failed to create task plan: {result.get('error')}")
        
        # Parse plan from structured output
        try:
            plan_data = json.loads(result['content']) if isinstance(result['content'], str) else result['content']
        except json.JSONDecodeError:
            raise Exception("Failed to parse task plan JSON")
        
        # Create TaskPlan object
        task_plan = TaskPlan(
            overall_goal=plan_data['overall_goal'],
            user_id=user_id,
            conversation_id=conversation_id,
            intents=plan_data['intents'],
            success_criteria=plan_data['success_criteria'],
            estimated_total_cost=plan_data.get('estimated_cost', 0.0),
            constraints=plan_data.get('constraints', constraints or []),
            original_request=request
        )
        
        # Create TaskStep objects
        for i, step_data in enumerate(plan_data['plan_steps']):
            step = TaskStep(
                intent=step_data['intent'],
                description=step_data['description'],
                assigned_agent=step_data['assigned_agent'],
                success_criteria=step_data['success_criteria'],
                inputs_needed=step_data.get('inputs_needed', []),
                required_tools=step_data.get('required_tools', []),
                depends_on=step_data.get('depends_on', []),
                estimated_cost=step_data.get('estimated_cost', 0.0)
            )
            
            task_plan.steps.append(step)
        
        return task_plan
    
    async def _execute_task_plan(self, task_plan: TaskPlan):
        """Execute all steps in the task plan"""
        
        max_parallel_steps = 3  # Limit parallel execution
        executing_steps = {}
        completed_outputs = {}
        
        while not task_plan.is_complete:
            # Find next steps to execute
            ready_steps = self._find_ready_steps(task_plan, executing_steps.keys())
            
            if not ready_steps and not executing_steps:
                # No steps ready and none executing - check for deadlock
                pending_steps = [s for s in task_plan.steps if s.status == TaskStatus.PENDING]
                if pending_steps:
                    logger.error("Task execution deadlock detected")
                    task_plan.status = TaskStatus.FAILED
                    break
                else:
                    # All steps completed
                    break
            
            # Start new steps (up to parallel limit)
            while ready_steps and len(executing_steps) < max_parallel_steps:
                step = ready_steps.pop(0)
                
                # Check for human override if needed
                if await self._check_override_needed(step, task_plan):
                    step.status = TaskStatus.BLOCKED
                    continue
                
                # Start step execution
                specialist = self.specialists.get(step.assigned_agent)
                if not specialist:
                    logger.error(f"Unknown specialist: {step.assigned_agent}")
                    step.status = TaskStatus.FAILED
                    continue
                
                # Prepare execution context
                execution_context = {
                    'overall_goal': task_plan.overall_goal,
                    'conversation_id': task_plan.conversation_id,
                    'previous_outputs': completed_outputs,
                    'constraints': task_plan.constraints
                }
                
                # Execute step asynchronously
                task = asyncio.create_task(
                    specialist.execute_step(step, execution_context, self.responses_adapter)
                )
                executing_steps[step.id] = task
                
                logger.info(f"Started executing step: {step.description}")
            
            # Wait for at least one step to complete
            if executing_steps:
                done, pending = await asyncio.wait(
                    executing_steps.values(),
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=300.0  # 5 minute timeout
                )
                
                # Process completed steps
                for task in done:
                    # Find which step completed
                    completed_step_id = None
                    for step_id, step_task in executing_steps.items():
                        if step_task == task:
                            completed_step_id = step_id
                            break
                    
                    if completed_step_id:
                        step = next(s for s in task_plan.steps if s.id == completed_step_id)
                        
                        try:
                            output = await task
                            if step.status == TaskStatus.COMPLETED:
                                completed_outputs[step.id] = output
                                task_plan.completed_steps += 1
                                logger.info(f"Step completed: {step.description}")
                            elif step.status == TaskStatus.FAILED:
                                task_plan.failed_steps += 1
                                logger.error(f"Step failed: {step.description}")
                            elif step.status == TaskStatus.ESCALATED:
                                task_plan.escalated_steps += 1
                                await self._handle_escalation(step, task_plan)
                        
                        except Exception as e:
                            logger.error(f"Step execution error: {e}")
                            step.status = TaskStatus.FAILED
                            task_plan.failed_steps += 1
                        
                        del executing_steps[completed_step_id]
                
                # Handle timeouts
                for task in pending:
                    task.cancel()
            
            else:
                # No steps executing, wait briefly
                await asyncio.sleep(0.1)
        
        # Determine final task status
        if all(step.status == TaskStatus.COMPLETED for step in task_plan.steps):
            task_plan.status = TaskStatus.COMPLETED
        elif any(step.status == TaskStatus.ESCALATED for step in task_plan.steps):
            task_plan.status = TaskStatus.ESCALATED
        else:
            task_plan.status = TaskStatus.FAILED
    
    def _find_ready_steps(self, task_plan: TaskPlan, executing_step_ids: List[str]) -> List[TaskStep]:
        """Find steps that are ready to execute"""
        
        ready_steps = []
        completed_step_ids = {s.id for s in task_plan.steps if s.status == TaskStatus.COMPLETED}
        
        for step in task_plan.steps:
            if (
                step.status == TaskStatus.PENDING and
                step.id not in executing_step_ids and
                all(dep_id in completed_step_ids for dep_id in step.depends_on)
            ):
                ready_steps.append(step)
        
        # Sort by priority (estimated cost as proxy for complexity)
        ready_steps.sort(key=lambda s: s.estimated_cost)
        return ready_steps
    
    async def _check_override_needed(self, step: TaskStep, task_plan: TaskPlan) -> bool:
        """Check if human override is needed for this step"""
        
        if not self.override_service:
            return False
        
        # Check conditions that require override
        override_needed = (
            step.estimated_cost > 0.5 or  # High cost
            'safety' in step.required_tools or
            any('sensitive' in constraint.lower() for constraint in task_plan.constraints)
        )
        
        if override_needed:
            try:
                override_request = await self.override_service.create_override_request(
                    task_id=task_plan.id,
                    target_type=OverrideTargetType.ESCALATE_TO_HUMAN,
                    current_value="automatic_execution",
                    requested_value="human_approval",
                    justification=f"Step requires approval: {step.description}",
                    user_id=task_plan.user_id,
                    conversation_id=task_plan.conversation_id
                )
                
                # For demo purposes, auto-approve after 5 seconds
                # In production, this would wait for actual human decision
                await asyncio.sleep(5)
                
                logger.info(f"Override auto-approved for step: {step.description}")
                return False
                
            except Exception as e:
                logger.error(f"Override request failed: {e}")
                return True  # Block execution on override failure
        
        return False
    
    async def _handle_escalation(self, step: TaskStep, task_plan: TaskPlan):
        """Handle step escalation"""
        
        escalation_reason = self._determine_escalation_reason(step)
        
        logger.warning(f"Step escalated: {step.description}, Reason: {escalation_reason}")
        
        # Try escalation strategies based on reason
        if escalation_reason == EscalationReason.REPEATED_FAILURES:
            # Retry with higher-tier model
            step.max_attempts += 1
            step.status = TaskStatus.PENDING
            logger.info("Escalation: Added retry attempt with higher model tier")
        
        elif escalation_reason == EscalationReason.COMPLEXITY_EXCEEDED:
            # Break down into smaller steps
            logger.info("Escalation: Task complexity exceeded - manual intervention needed")
        
        elif escalation_reason == EscalationReason.SAFETY_CONCERNS:
            # Route to human review
            if self.override_service:
                await self.override_service.create_override_request(
                    task_id=task_plan.id,
                    target_type=OverrideTargetType.ESCALATE_TO_HUMAN,
                    current_value="automated_handling",
                    requested_value="human_review",
                    justification=f"Safety concerns in step: {step.description}"
                )
    
    def _determine_escalation_reason(self, step: TaskStep) -> EscalationReason:
        """Determine why a step was escalated"""
        
        if step.attempt_count >= step.max_attempts:
            return EscalationReason.REPEATED_FAILURES
        elif step.estimated_cost > 1.0:
            return EscalationReason.RESOURCE_CONSTRAINTS
        elif 'safety' in step.description.lower():
            return EscalationReason.SAFETY_CONCERNS
        else:
            return EscalationReason.COMPLEXITY_EXCEEDED
    
    def _finalize_task(self, task_plan: TaskPlan):
        """Finalize task execution"""
        
        task_plan.completed_at = datetime.now(timezone.utc)
        
        # Calculate actual cost
        task_plan.actual_total_cost = sum(step.estimated_cost for step in task_plan.steps if step.status == TaskStatus.COMPLETED)
        
        # Move to history
        self.task_history.append(task_plan.id)
        if task_plan.id in self.active_tasks:
            del self.active_tasks[task_plan.id]
        
        logger.info(f"Task finalized: {task_plan.overall_goal}, Status: {task_plan.status}, Progress: {task_plan.progress_percentage:.1f}%")
    
    def _update_orchestrator_stats(self, task_plan: TaskPlan, completion_time_ms: float):
        """Update orchestrator performance statistics"""
        
        if task_plan.status == TaskStatus.COMPLETED:
            self.stats['successful_tasks'] += 1
        elif task_plan.status == TaskStatus.ESCALATED:
            self.stats['escalated_tasks'] += 1
        
        # Update average completion time
        total_completed = self.stats['successful_tasks'] + self.stats['escalated_tasks']
        if total_completed > 0:
            current_avg = self.stats['avg_completion_time']
            self.stats['avg_completion_time'] = (
                (current_avg * (total_completed - 1) + completion_time_ms) / total_completed
            )
    
    def _create_orchestrator_prompt(self, context: Dict[str, Any]) -> str:
        """Create orchestrator planning prompt"""
        
        return f"""Analyze the user request and create a detailed execution plan.

USER REQUEST: {context['user_request']}

AVAILABLE AGENTS: {', '.join(context['available_agents'])}

CONSTRAINTS: {context.get('constraints', [])}

Create a plan that:
1. Breaks down the request into logical steps
2. Assigns each step to the most appropriate specialist agent
3. Identifies dependencies between steps  
4. Estimates resource requirements
5. Defines clear success criteria

Consider:
- Task complexity and required expertise
- Available tools for each agent
- Potential failure points and retry strategies
- Cost optimization opportunities
- Safety and compliance requirements

Output a structured plan following the provided JSON schema."""
    
    def _get_orchestrator_system_prompt(self) -> str:
        """Get the orchestrator system prompt"""
        
        return """You are the Orchestrator Meta-Agent v4. You coordinate complex tasks by planning and delegating to specialist agents.

CORE RESPONSIBILITIES:
- Analyze user requests and classify intents
- Create detailed execution plans with clear steps
- Assign tasks to appropriate specialist agents
- Manage dependencies and coordination
- Handle escalations and failures
- Optimize for cost and performance

AVAILABLE SPECIALISTS:
- retrieval: Information search and synthesis
- code: Code generation, analysis, and debugging  
- dataviz: Data visualization and analysis
- web_research: Current information research
- image: Image generation and visual content
- ui: User interface design and generation
- moderation: Content safety and compliance

PLANNING PRINCIPLES:
- Break complex tasks into atomic steps
- Minimize dependencies where possible
- Choose the most cost-effective agent for each step
- Plan for failure scenarios and retries
- Ensure all steps have clear success criteria
- Consider user constraints and preferences

SAFETY:
- Never plan steps that could cause harm
- Escalate sensitive operations for approval
- Respect privacy and data protection
- Follow content policies and guidelines

OUTPUT: Always return valid JSON matching the required schema exactly."""
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of a task"""
        
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
        else:
            return None
        
        return {
            'task_id': task.id,
            'status': task.status.value,
            'progress_percentage': task.progress_percentage,
            'completed_steps': task.completed_steps,
            'total_steps': len(task.steps),
            'failed_steps': task.failed_steps,
            'escalated_steps': task.escalated_steps,
            'estimated_cost': task.estimated_total_cost,
            'actual_cost': task.actual_total_cost,
            'created_at': task.created_at.isoformat(),
            'started_at': task.started_at.isoformat() if task.started_at else None,
            'current_step': task.current_step_id
        }
    
    def get_orchestrator_stats(self) -> Dict[str, Any]:
        """Get orchestrator performance statistics"""
        
        specialist_stats = {
            name: agent.stats for name, agent in self.specialists.items()
        }
        
        return {
            'orchestrator': self.stats,
            'specialists': specialist_stats,
            'active_tasks': len(self.active_tasks),
            'task_history_size': len(self.task_history)
        }


# Example usage and testing
async def example_orchestrator_usage():
    """Example of how to use the orchestrator"""
    
    # Initialize components
    client = AsyncOpenAI()
    responses_adapter = ResponsesAPIAdapter(client=client)
    
    compression_config = CompressionConfig(target_token_budget=2000)
    compression_utility = EnhancedContextCompressor(client, compression_config)
    
    override_service = HumanOverrideService()
    await override_service.start()
    
    # Create orchestrator
    orchestrator = OrchestratorAgent(
        responses_adapter=responses_adapter,
        compression_utility=compression_utility,
        override_service=override_service
    )
    
    try:
        # Example task execution
        task_plan = await orchestrator.execute_task(
            request="Create a comprehensive data analysis dashboard for our sales data. Include charts showing monthly trends, regional performance, and customer segmentation. Also generate a summary report with key insights and recommendations.",
            user_id="demo_user",
            conversation_id="demo_conversation",
            constraints=["Budget limit: $0.50", "Timeline: 30 minutes", "Data privacy: anonymize customer names"]
        )
        
        print(f"Task Status: {task_plan.status}")
        print(f"Progress: {task_plan.progress_percentage:.1f}%")
        print(f"Completed Steps: {task_plan.completed_steps}/{len(task_plan.steps)}")
        print(f"Total Cost: ${task_plan.actual_total_cost:.4f}")
        
        # Print step details
        print("\nStep Details:")
        for step in task_plan.steps:
            print(f"- {step.description}: {step.status} ({step.execution_time_ms:.0f}ms)")
        
        # Get statistics
        stats = orchestrator.get_orchestrator_stats()
        print(f"\nOrchestrator Stats: {json.dumps(stats, indent=2)}")
        
    finally:
        await override_service.stop()


if __name__ == "__main__":
    # Run example
    asyncio.run(example_orchestrator_usage())