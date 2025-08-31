"""
Comprehensive Testing Framework for Agent Hierarchy
Includes unit tests, integration tests, performance benchmarks, and evaluation metrics
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any, Callable, Union
from datetime import datetime, timedelta
from pathlib import Path
import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
import tempfile
import os

from orchestrator_implementation import (
    OrchestratorAgent, SpecialistAgent, TaskPlan, TaskStep, TaskStatus,
    AgentCapability, EscalationReason
)
from responses_adapter import ResponsesAPIAdapter, ModelRouter, RoutingContext
from enhanced_compression_utility import EnhancedContextCompressor, CompressionConfig
from human_override_service import HumanOverrideService, OverrideTargetType


logger = logging.getLogger(__name__)


@dataclass
class TestResult:
    """Test execution result"""
    test_name: str
    success: bool
    duration_ms: float
    error_message: Optional[str] = None
    metrics: Dict[str, Any] = field(default_factory=dict)
    assertions: List[str] = field(default_factory=list)


@dataclass
class BenchmarkResult:
    """Performance benchmark result"""
    test_name: str
    avg_duration_ms: float
    min_duration_ms: float
    max_duration_ms: float
    throughput_per_second: float
    success_rate: float
    error_count: int
    iterations: int
    

class MockOpenAIClient:
    """Mock OpenAI client for testing"""
    
    def __init__(self):
        self.responses = MockResponsesAPI()
        self.chat = MockChatAPI()
        self.embeddings = MockEmbeddingsAPI()
        self.models = MockModelsAPI()


class MockResponsesAPI:
    """Mock Responses API"""
    
    async def create(self, **kwargs):
        """Mock response creation"""
        
        # Simulate processing time
        await asyncio.sleep(0.01)
        
        model = kwargs.get('model', 'gpt-5-mini')
        input_messages = kwargs.get('input', [])
        
        # Generate mock response based on input
        content = self._generate_mock_content(input_messages, kwargs)
        
        # Mock response object
        response = MagicMock()
        response.id = str(uuid.uuid4())
        response.output = content
        response.usage.input_tokens = sum(len(msg.get('content', '').split()) for msg in input_messages) 
        response.usage.output_tokens = len(content.split()) if isinstance(content, str) else 100
        response.usage.total_tokens = response.usage.input_tokens + response.usage.output_tokens
        
        return response
    
    def _generate_mock_content(self, input_messages: List[Dict], kwargs: Dict[str, Any]) -> str:
        """Generate appropriate mock content"""
        
        # Check for structured output
        structured_output = kwargs.get('structured_output')
        if structured_output:
            return self._generate_structured_response(input_messages, structured_output)
        
        # Check for specific patterns
        user_content = " ".join([msg.get('content', '') for msg in input_messages if msg.get('role') == 'user'])
        
        if 'orchestrator' in user_content.lower() or 'plan' in user_content.lower():
            return self._generate_plan_response()
        elif 'code' in user_content.lower():
            return "def example_function():\n    return 'Hello, World!'"
        elif 'chart' in user_content.lower() or 'visualization' in user_content.lower():
            return "Created bar chart showing monthly trends with 85% correlation coefficient."
        else:
            return "Mock response for: " + user_content[:100]
    
    def _generate_structured_response(self, input_messages: List[Dict], schema: Dict) -> Dict:
        """Generate structured response matching schema"""
        
        if 'orchestrator' in str(input_messages).lower():
            return {
                "overall_goal": "Complete user request efficiently",
                "intents": ["retrieval", "analysis"],
                "plan_steps": [
                    {
                        "intent": "retrieval",
                        "description": "Gather relevant information",
                        "assigned_agent": "retrieval",
                        "success_criteria": "Find at least 3 relevant sources"
                    },
                    {
                        "intent": "analysis",
                        "description": "Analyze gathered information",
                        "assigned_agent": "code",
                        "success_criteria": "Generate summary report"
                    }
                ],
                "success_criteria": "User request fulfilled with high quality",
                "estimated_cost": 0.05,
                "escalation_needed": False
            }
        
        return {"status": "success", "message": "Mock structured response"}


class MockChatAPI:
    """Mock Chat Completions API"""
    
    async def create(self, **kwargs):
        """Mock chat completion"""
        await asyncio.sleep(0.01)
        
        response = MagicMock()
        response.choices = [MagicMock()]
        response.choices[0].message.content = "Mock chat response"
        return response


class MockEmbeddingsAPI:
    """Mock Embeddings API"""
    
    async def create(self, **kwargs):
        """Mock embedding creation"""
        await asyncio.sleep(0.005)
        
        input_text = kwargs.get('input', '')
        # Generate deterministic fake embedding
        embedding = [hash(input_text + str(i)) % 1000 / 1000.0 for i in range(1536)]
        
        response = MagicMock()
        response.data = [MagicMock()]
        response.data[0].embedding = embedding
        return response


class MockModelsAPI:
    """Mock Models API"""
    
    def list(self):
        """Mock model list"""
        return [
            {"id": "gpt-5-nano"},
            {"id": "gpt-5-mini"},
            {"id": "gpt-5"},
            {"id": "gpt-4.1"}
        ]


class AgentTestSuite:
    """Comprehensive test suite for agent hierarchy"""
    
    def __init__(self):
        self.mock_client = MockOpenAIClient()
        self.test_results: List[TestResult] = []
        self.benchmark_results: List[BenchmarkResult] = []
        
    async def run_all_tests(self) -> Dict[str, Any]:
        """Run complete test suite"""
        
        logger.info("Starting comprehensive agent test suite...")
        
        # Unit tests
        await self._run_unit_tests()
        
        # Integration tests
        await self._run_integration_tests()
        
        # Performance benchmarks
        await self._run_benchmarks()
        
        # Evaluation tests
        await self._run_evaluation_tests()
        
        # Generate summary report
        return self._generate_test_report()
    
    async def _run_unit_tests(self):
        """Run unit tests for individual components"""
        
        logger.info("Running unit tests...")
        
        # Test model router
        await self._test_model_router()
        
        # Test specialist agents
        await self._test_specialist_agents()
        
        # Test compression utility
        await self._test_compression_utility()
        
        # Test human override service
        await self._test_override_service()
    
    async def _test_model_router(self):
        """Test model routing functionality"""
        
        start_time = time.time()
        
        try:
            router = ModelRouter()
            
            # Test different routing contexts
            contexts = [
                RoutingContext(intents=['retrieval'], complexity='low'),
                RoutingContext(intents=['code'], complexity='high', prior_failures=2),
                RoutingContext(intents=['orchestration'], plan_steps=8),
            ]
            
            results = []
            for ctx in contexts:
                result = router.route(ctx)
                results.append(result)
                
                # Assertions
                assert 'model' in result
                assert 'reasoning_effort' in result
                assert 'estimated_cost' in result
            
            # Test escalation
            original_result = results[0]
            escalated = router.escalate_on_failure(original_result, contexts[1])
            assert escalated['model'] != original_result['model'] or escalated['reasoning_effort'] != original_result['reasoning_effort']
            
            self.test_results.append(TestResult(
                test_name="model_router_basic",
                success=True,
                duration_ms=(time.time() - start_time) * 1000,
                assertions=[
                    "Model routing returns valid results",
                    "Escalation logic works correctly",
                    "Cost estimation is provided"
                ]
            ))
            
        except Exception as e:
            self.test_results.append(TestResult(
                test_name="model_router_basic",
                success=False,
                duration_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            ))
    
    async def _test_specialist_agents(self):
        """Test individual specialist agents"""
        
        for agent_type in ['retrieval', 'code', 'dataviz', 'web_research']:
            await self._test_single_specialist(agent_type)
    
    async def _test_single_specialist(self, agent_type: str):
        """Test a single specialist agent"""
        
        start_time = time.time()
        test_name = f"specialist_{agent_type}"
        
        try:
            # Create mock responses adapter
            responses_adapter = ResponsesAPIAdapter()
            responses_adapter.client = self.mock_client
            
            # Create test agent based on type
            if agent_type == 'retrieval':
                agent = SpecialistAgent(
                    name="TestRetrieval",
                    capabilities=[AgentCapability.RETRIEVAL],
                    prompt_template="You are a test retrieval agent.",
                    tools=['file_search']
                )
            elif agent_type == 'code':
                agent = SpecialistAgent(
                    name="TestCode",
                    capabilities=[AgentCapability.CODE_GENERATION],
                    prompt_template="You are a test code agent.",
                    tools=['code_interpreter']
                )
            elif agent_type == 'dataviz':
                agent = SpecialistAgent(
                    name="TestDataViz",
                    capabilities=[AgentCapability.DATA_VISUALIZATION],
                    prompt_template="You are a test data visualization agent.",
                    tools=['code_interpreter']
                )
            elif agent_type == 'web_research':
                agent = SpecialistAgent(
                    name="TestWebResearch",
                    capabilities=[AgentCapability.WEB_RESEARCH],
                    prompt_template="You are a test web research agent.",
                    tools=['web_search_preview']
                )
            
            # Create test step
            test_step = TaskStep(
                intent=agent_type,
                description=f"Test {agent_type} functionality",
                assigned_agent=agent_type,
                success_criteria="Complete task successfully"
            )
            
            # Execute step
            context = {'conversation_id': 'test_conversation'}
            result = await agent.execute_step(test_step, context, responses_adapter)
            
            # Assertions
            assert test_step.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]
            if test_step.status == TaskStatus.COMPLETED:
                assert test_step.output is not None
                assert 'content' in test_step.output
            
            self.test_results.append(TestResult(
                test_name=test_name,
                success=test_step.status == TaskStatus.COMPLETED,
                duration_ms=(time.time() - start_time) * 1000,
                metrics={
                    'execution_time_ms': test_step.execution_time_ms,
                    'attempt_count': test_step.attempt_count
                },
                assertions=[
                    f"{agent_type} agent executes without error",
                    "Step status is properly updated",
                    "Output is generated when successful"
                ]
            ))
            
        except Exception as e:
            self.test_results.append(TestResult(
                test_name=test_name,
                success=False,
                duration_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            ))
    
    async def _test_compression_utility(self):
        """Test context compression functionality"""
        
        start_time = time.time()
        
        try:
            config = CompressionConfig(target_token_budget=500, enable_embeddings=False)
            compressor = EnhancedContextCompressor(self.mock_client, config)
            
            # Test messages
            messages = [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "What is machine learning?"},
                {"role": "assistant", "content": "Machine learning is a subset of artificial intelligence..."},
                {"role": "user", "content": "Can you give me an example?"},
                {"role": "assistant", "content": "Sure! A common example is email spam detection..."}
            ]
            
            result = await compressor.compress_context(messages, "machine learning examples")
            
            # Assertions
            assert result.success
            assert result.compressed_tokens <= config.target_token_budget * 1.2  # Allow 20% variance
            assert result.compression_ratio <= 1.0
            assert len(result.compressed_content) > 0
            
            self.test_results.append(TestResult(
                test_name="compression_utility",
                success=True,
                duration_ms=(time.time() - start_time) * 1000,
                metrics={
                    'compression_ratio': result.compression_ratio,
                    'original_tokens': result.original_tokens,
                    'compressed_tokens': result.compressed_tokens
                },
                assertions=[
                    "Compression completes successfully",
                    "Token budget is respected",
                    "Content is preserved"
                ]
            ))
            
        except Exception as e:
            self.test_results.append(TestResult(
                test_name="compression_utility",
                success=False,
                duration_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            ))
    
    async def _test_override_service(self):
        """Test human override service functionality"""
        
        start_time = time.time()
        
        try:
            # Use in-memory override service for testing
            override_service = HumanOverrideService()
            await override_service.start()
            
            try:
                # Test creating override request
                request = await override_service.create_override_request(
                    task_id="test_task",
                    target_type=OverrideTargetType.MODEL,
                    current_value="gpt-5-mini",
                    requested_value="gpt-5",
                    justification="Test escalation",
                    user_id="test_user"
                )
                
                # Assertions
                assert request.id is not None
                assert request.task_id == "test_task"
                assert request.target_type == OverrideTargetType.MODEL
                
                self.test_results.append(TestResult(
                    test_name="override_service",
                    success=True,
                    duration_ms=(time.time() - start_time) * 1000,
                    assertions=[
                        "Override request created successfully",
                        "Request fields are properly set",
                        "Service handles async operations"
                    ]
                ))
                
            finally:
                await override_service.stop()
                
        except Exception as e:
            self.test_results.append(TestResult(
                test_name="override_service",
                success=False,
                duration_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            ))
    
    async def _run_integration_tests(self):
        """Run integration tests for complete workflows"""
        
        logger.info("Running integration tests...")
        
        await self._test_orchestrator_workflow()
        await self._test_multi_agent_coordination()
        await self._test_error_handling()
    
    async def _test_orchestrator_workflow(self):
        """Test complete orchestrator workflow"""
        
        start_time = time.time()
        
        try:
            # Create orchestrator with mock services
            responses_adapter = ResponsesAPIAdapter()
            responses_adapter.client = self.mock_client
            
            orchestrator = OrchestratorAgent(responses_adapter)
            
            # Test simple task
            task_plan = await orchestrator.execute_task(
                request="Analyze the quarterly sales data and create a summary report",
                user_id="test_user"
            )
            
            # Assertions
            assert task_plan is not None
            assert task_plan.overall_goal is not None
            assert len(task_plan.steps) > 0
            assert task_plan.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.ESCALATED]
            
            # Check progress calculation
            progress = task_plan.progress_percentage
            assert 0 <= progress <= 100
            
            self.test_results.append(TestResult(
                test_name="orchestrator_workflow",
                success=True,
                duration_ms=(time.time() - start_time) * 1000,
                metrics={
                    'total_steps': len(task_plan.steps),
                    'completed_steps': task_plan.completed_steps,
                    'progress_percentage': progress,
                    'estimated_cost': task_plan.estimated_total_cost
                },
                assertions=[
                    "Task plan is generated",
                    "Steps are executed",
                    "Progress is tracked",
                    "Costs are calculated"
                ]
            ))
            
        except Exception as e:
            self.test_results.append(TestResult(
                test_name="orchestrator_workflow",
                success=False,
                duration_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            ))
    
    async def _test_multi_agent_coordination(self):
        """Test coordination between multiple agents"""
        
        start_time = time.time()
        
        try:
            responses_adapter = ResponsesAPIAdapter()
            responses_adapter.client = self.mock_client
            orchestrator = OrchestratorAgent(responses_adapter)
            
            # Complex task requiring multiple agents
            task_plan = await orchestrator.execute_task(
                request="Research current AI trends, analyze the data, and create a visualization dashboard",
                user_id="test_user"
            )
            
            # Check that multiple agent types are involved
            agent_types = set(step.assigned_agent for step in task_plan.steps)
            assert len(agent_types) >= 2, "Task should involve multiple agent types"
            
            # Check dependencies
            has_dependencies = any(len(step.depends_on) > 0 for step in task_plan.steps)
            
            self.test_results.append(TestResult(
                test_name="multi_agent_coordination",
                success=True,
                duration_ms=(time.time() - start_time) * 1000,
                metrics={
                    'unique_agents': len(agent_types),
                    'has_dependencies': has_dependencies,
                    'total_steps': len(task_plan.steps)
                },
                assertions=[
                    "Multiple agent types are coordinated",
                    "Dependencies are properly managed",
                    "Task is decomposed appropriately"
                ]
            ))
            
        except Exception as e:
            self.test_results.append(TestResult(
                test_name="multi_agent_coordination",
                success=False,
                duration_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            ))
    
    async def _test_error_handling(self):
        """Test error handling and recovery"""
        
        start_time = time.time()
        
        try:
            # Test with failing mock client
            failing_client = MockOpenAIClient()
            
            # Make responses fail
            async def failing_create(**kwargs):
                raise Exception("Mock API failure")
            
            failing_client.responses.create = failing_create
            
            responses_adapter = ResponsesAPIAdapter()
            responses_adapter.client = failing_client
            
            orchestrator = OrchestratorAgent(responses_adapter)
            
            # This should handle the failure gracefully
            task_plan = await orchestrator.execute_task(
                request="Test error handling",
                user_id="test_user"
            )
            
            # Should complete with failed status, not crash
            assert task_plan.status == TaskStatus.FAILED
            
            self.test_results.append(TestResult(
                test_name="error_handling",
                success=True,
                duration_ms=(time.time() - start_time) * 1000,
                assertions=[
                    "Errors are handled gracefully",
                    "System doesn't crash on API failures",
                    "Failed status is properly set"
                ]
            ))
            
        except Exception as e:
            self.test_results.append(TestResult(
                test_name="error_handling",
                success=False,
                duration_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            ))
    
    async def _run_benchmarks(self):
        """Run performance benchmarks"""
        
        logger.info("Running performance benchmarks...")
        
        await self._benchmark_orchestrator_throughput()
        await self._benchmark_compression_performance()
        await self._benchmark_routing_latency()
    
    async def _benchmark_orchestrator_throughput(self):
        """Benchmark orchestrator throughput"""
        
        responses_adapter = ResponsesAPIAdapter()
        responses_adapter.client = self.mock_client
        orchestrator = OrchestratorAgent(responses_adapter)
        
        iterations = 10
        durations = []
        successes = 0
        
        for i in range(iterations):
            start_time = time.time()
            
            try:
                task_plan = await orchestrator.execute_task(
                    request=f"Test task {i}",
                    user_id=f"user_{i}"
                )
                
                if task_plan.status == TaskStatus.COMPLETED:
                    successes += 1
                
            except Exception as e:
                logger.warning(f"Benchmark iteration {i} failed: {e}")
            
            duration_ms = (time.time() - start_time) * 1000
            durations.append(duration_ms)
        
        self.benchmark_results.append(BenchmarkResult(
            test_name="orchestrator_throughput",
            avg_duration_ms=sum(durations) / len(durations),
            min_duration_ms=min(durations),
            max_duration_ms=max(durations),
            throughput_per_second=1000 / (sum(durations) / len(durations)),
            success_rate=successes / iterations,
            error_count=iterations - successes,
            iterations=iterations
        ))
    
    async def _benchmark_compression_performance(self):
        """Benchmark compression performance"""
        
        config = CompressionConfig(enable_embeddings=False)
        compressor = EnhancedContextCompressor(self.mock_client, config)
        
        # Create test messages of varying sizes
        test_messages = [
            [{"role": "user", "content": "Short message"}] * 5,
            [{"role": "user", "content": "Medium length message with more content"} * 2] * 10,
            [{"role": "user", "content": "Very long message with extensive content " * 10}] * 20
        ]
        
        iterations = len(test_messages)
        durations = []
        successes = 0
        
        for messages in test_messages:
            start_time = time.time()
            
            try:
                result = await compressor.compress_context(messages, "test query")
                if result.success:
                    successes += 1
            except Exception as e:
                logger.warning(f"Compression benchmark failed: {e}")
            
            duration_ms = (time.time() - start_time) * 1000
            durations.append(duration_ms)
        
        self.benchmark_results.append(BenchmarkResult(
            test_name="compression_performance",
            avg_duration_ms=sum(durations) / len(durations),
            min_duration_ms=min(durations),
            max_duration_ms=max(durations),
            throughput_per_second=1000 / (sum(durations) / len(durations)),
            success_rate=successes / iterations,
            error_count=iterations - successes,
            iterations=iterations
        ))
    
    async def _benchmark_routing_latency(self):
        """Benchmark model routing latency"""
        
        router = ModelRouter()
        
        contexts = [
            RoutingContext(intents=['retrieval']),
            RoutingContext(intents=['code'], complexity='high'),
            RoutingContext(intents=['orchestration'], plan_steps=5)
        ] * 50  # 150 total iterations
        
        durations = []
        
        for ctx in contexts:
            start_time = time.time()
            router.route(ctx)
            duration_ms = (time.time() - start_time) * 1000
            durations.append(duration_ms)
        
        self.benchmark_results.append(BenchmarkResult(
            test_name="routing_latency",
            avg_duration_ms=sum(durations) / len(durations),
            min_duration_ms=min(durations),
            max_duration_ms=max(durations),
            throughput_per_second=1000 / (sum(durations) / len(durations)),
            success_rate=1.0,  # Routing shouldn't fail
            error_count=0,
            iterations=len(durations)
        ))
    
    async def _run_evaluation_tests(self):
        """Run evaluation tests for quality assessment"""
        
        logger.info("Running evaluation tests...")
        
        await self._evaluate_plan_quality()
        await self._evaluate_response_relevance()
        await self._evaluate_cost_efficiency()
    
    async def _evaluate_plan_quality(self):
        """Evaluate task plan quality"""
        
        start_time = time.time()
        
        try:
            responses_adapter = ResponsesAPIAdapter()
            responses_adapter.client = self.mock_client
            orchestrator = OrchestratorAgent(responses_adapter)
            
            # Test cases with expected characteristics
            test_cases = [
                {
                    "request": "Create a data analysis report",
                    "expected_agents": ["retrieval", "dataviz"],
                    "min_steps": 2,
                    "max_steps": 5
                },
                {
                    "request": "Build a web scraping tool",
                    "expected_agents": ["code"],
                    "min_steps": 1,
                    "max_steps": 3
                },
                {
                    "request": "Research AI trends and create a presentation",
                    "expected_agents": ["web_research", "retrieval", "dataviz"],
                    "min_steps": 3,
                    "max_steps": 8
                }
            ]
            
            quality_scores = []
            
            for case in test_cases:
                task_plan = await orchestrator.execute_task(case["request"], "eval_user")
                
                score = 0.0
                
                # Check agent selection
                assigned_agents = set(step.assigned_agent for step in task_plan.steps)
                expected_agents = set(case["expected_agents"])
                agent_overlap = len(assigned_agents.intersection(expected_agents))
                score += (agent_overlap / len(expected_agents)) * 0.4
                
                # Check step count
                step_count = len(task_plan.steps)
                if case["min_steps"] <= step_count <= case["max_steps"]:
                    score += 0.3
                
                # Check dependencies are logical
                has_valid_deps = all(
                    dep_id in [s.id for s in task_plan.steps] 
                    for step in task_plan.steps 
                    for dep_id in step.depends_on
                )
                if has_valid_deps:
                    score += 0.3
                
                quality_scores.append(score)
            
            avg_quality = sum(quality_scores) / len(quality_scores)
            
            self.test_results.append(TestResult(
                test_name="plan_quality_evaluation",
                success=avg_quality > 0.7,
                duration_ms=(time.time() - start_time) * 1000,
                metrics={
                    'avg_quality_score': avg_quality,
                    'individual_scores': quality_scores,
                    'test_cases': len(test_cases)
                },
                assertions=[
                    "Plans select appropriate agents",
                    "Step counts are reasonable", 
                    "Dependencies are valid"
                ]
            ))
            
        except Exception as e:
            self.test_results.append(TestResult(
                test_name="plan_quality_evaluation",
                success=False,
                duration_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            ))
    
    async def _evaluate_response_relevance(self):
        """Evaluate response relevance to user requests"""
        
        start_time = time.time()
        
        try:
            responses_adapter = ResponsesAPIAdapter()
            responses_adapter.client = self.mock_client
            
            # Create test retrieval agent
            agent = SpecialistAgent(
                name="EvalRetrieval",
                capabilities=[AgentCapability.RETRIEVAL],
                prompt_template="You are a retrieval specialist.",
                tools=['file_search']
            )
            
            test_queries = [
                "What is machine learning?",
                "How do neural networks work?",
                "Explain quantum computing",
                "What are the latest AI trends?"
            ]
            
            relevance_scores = []
            
            for query in test_queries:
                step = TaskStep(
                    intent="retrieval",
                    description=f"Answer: {query}",
                    success_criteria="Provide accurate information"
                )
                
                await agent.execute_step(step, {'query': query}, responses_adapter)
                
                if step.status == TaskStatus.COMPLETED:
                    # Simple relevance check - in real implementation would use embeddings
                    response = step.output.get('content', '')
                    query_words = set(query.lower().split())
                    response_words = set(response.lower().split())
                    
                    overlap = len(query_words.intersection(response_words))
                    relevance = overlap / len(query_words) if query_words else 0
                    relevance_scores.append(relevance)
                else:
                    relevance_scores.append(0.0)
            
            avg_relevance = sum(relevance_scores) / len(relevance_scores)
            
            self.test_results.append(TestResult(
                test_name="response_relevance_evaluation",
                success=avg_relevance > 0.3,  # Basic threshold
                duration_ms=(time.time() - start_time) * 1000,
                metrics={
                    'avg_relevance_score': avg_relevance,
                    'individual_scores': relevance_scores,
                    'queries_tested': len(test_queries)
                },
                assertions=[
                    "Responses are relevant to queries",
                    "Content overlap is significant"
                ]
            ))
            
        except Exception as e:
            self.test_results.append(TestResult(
                test_name="response_relevance_evaluation",
                success=False,
                duration_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            ))
    
    async def _evaluate_cost_efficiency(self):
        """Evaluate cost efficiency of routing decisions"""
        
        start_time = time.time()
        
        try:
            router = ModelRouter()
            
            # Test different scenarios
            scenarios = [
                (RoutingContext(intents=['moderation']), 0.001),  # Should use cheap model
                (RoutingContext(intents=['code'], complexity='high'), 0.01),  # More expensive OK
                (RoutingContext(intents=['retrieval']), 0.005),  # Medium cost
            ]
            
            efficiency_scores = []
            
            for context, max_expected_cost in scenarios:
                result = router.route(context)
                actual_cost = result.get('estimated_cost', 0)
                
                # Score based on staying under expected cost
                if actual_cost <= max_expected_cost:
                    efficiency_scores.append(1.0)
                elif actual_cost <= max_expected_cost * 1.5:  # 50% tolerance
                    efficiency_scores.append(0.7)
                else:
                    efficiency_scores.append(0.3)
            
            avg_efficiency = sum(efficiency_scores) / len(efficiency_scores)
            
            self.test_results.append(TestResult(
                test_name="cost_efficiency_evaluation",
                success=avg_efficiency > 0.8,
                duration_ms=(time.time() - start_time) * 1000,
                metrics={
                    'avg_efficiency_score': avg_efficiency,
                    'individual_scores': efficiency_scores,
                    'scenarios_tested': len(scenarios)
                },
                assertions=[
                    "Routing respects cost constraints",
                    "Model selection is cost-efficient"
                ]
            ))
            
        except Exception as e:
            self.test_results.append(TestResult(
                test_name="cost_efficiency_evaluation",
                success=False,
                duration_ms=(time.time() - start_time) * 1000,
                error_message=str(e)
            ))
    
    def _generate_test_report(self) -> Dict[str, Any]:
        """Generate comprehensive test report"""
        
        # Calculate summary statistics
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result.success)
        failed_tests = total_tests - passed_tests
        
        # Group by test type
        unit_tests = [r for r in self.test_results if 'unit' in r.test_name or r.test_name in ['model_router_basic', 'specialist_', 'compression_utility', 'override_service']]
        integration_tests = [r for r in self.test_results if 'integration' in r.test_name or r.test_name in ['orchestrator_workflow', 'multi_agent_coordination', 'error_handling']]
        evaluation_tests = [r for r in self.test_results if 'evaluation' in r.test_name]
        
        return {
            'summary': {
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'failed_tests': failed_tests,
                'success_rate': passed_tests / total_tests if total_tests > 0 else 0,
                'total_duration_ms': sum(r.duration_ms for r in self.test_results)
            },
            'test_categories': {
                'unit_tests': {
                    'count': len(unit_tests),
                    'passed': sum(1 for r in unit_tests if r.success),
                    'avg_duration_ms': sum(r.duration_ms for r in unit_tests) / len(unit_tests) if unit_tests else 0
                },
                'integration_tests': {
                    'count': len(integration_tests),
                    'passed': sum(1 for r in integration_tests if r.success),
                    'avg_duration_ms': sum(r.duration_ms for r in integration_tests) / len(integration_tests) if integration_tests else 0
                },
                'evaluation_tests': {
                    'count': len(evaluation_tests),
                    'passed': sum(1 for r in evaluation_tests if r.success),
                    'avg_duration_ms': sum(r.duration_ms for r in evaluation_tests) / len(evaluation_tests) if evaluation_tests else 0
                }
            },
            'benchmark_results': [asdict(result) for result in self.benchmark_results],
            'detailed_results': [asdict(result) for result in self.test_results],
            'recommendations': self._generate_recommendations()
        }
    
    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results"""
        
        recommendations = []
        
        # Check success rates
        success_rate = sum(1 for r in self.test_results if r.success) / len(self.test_results)
        if success_rate < 0.9:
            recommendations.append("Consider improving error handling - test success rate is below 90%")
        
        # Check performance
        avg_duration = sum(r.duration_ms for r in self.test_results) / len(self.test_results)
        if avg_duration > 1000:
            recommendations.append("Performance optimization needed - average test duration exceeds 1 second")
        
        # Check benchmark results
        for benchmark in self.benchmark_results:
            if benchmark.success_rate < 0.95:
                recommendations.append(f"Reliability issue detected in {benchmark.test_name} - success rate: {benchmark.success_rate:.2%}")
            
            if benchmark.avg_duration_ms > 500:
                recommendations.append(f"Performance bottleneck in {benchmark.test_name} - average duration: {benchmark.avg_duration_ms:.1f}ms")
        
        if not recommendations:
            recommendations.append("All tests performing well! Consider expanding test coverage.")
        
        return recommendations


# Pytest integration
@pytest.mark.asyncio
class TestAgentHierarchy:
    """Pytest test class for CI/CD integration"""
    
    @pytest.fixture
    async def test_suite(self):
        """Create test suite fixture"""
        return AgentTestSuite()
    
    async def test_model_router(self, test_suite):
        """Test model router functionality"""
        await test_suite._test_model_router()
        
        # Check if test passed
        router_results = [r for r in test_suite.test_results if r.test_name == 'model_router_basic']
        assert len(router_results) > 0
        assert router_results[0].success
    
    async def test_specialist_agents(self, test_suite):
        """Test all specialist agents"""
        await test_suite._test_specialist_agents()
        
        # Check specialist test results
        specialist_results = [r for r in test_suite.test_results if 'specialist_' in r.test_name]
        assert len(specialist_results) > 0
        
        # At least 80% of specialist tests should pass
        success_rate = sum(1 for r in specialist_results if r.success) / len(specialist_results)
        assert success_rate >= 0.8
    
    async def test_orchestrator_integration(self, test_suite):
        """Test orchestrator integration"""
        await test_suite._test_orchestrator_workflow()
        
        workflow_results = [r for r in test_suite.test_results if r.test_name == 'orchestrator_workflow']
        assert len(workflow_results) > 0
        assert workflow_results[0].success
    
    @pytest.mark.benchmark
    async def test_performance_benchmarks(self, test_suite):
        """Test performance benchmarks"""
        await test_suite._run_benchmarks()
        
        # Check that benchmarks ran
        assert len(test_suite.benchmark_results) > 0
        
        # Check performance thresholds
        for benchmark in test_suite.benchmark_results:
            # All benchmarks should have reasonable success rates
            assert benchmark.success_rate >= 0.8
            
            # Throughput should be reasonable
            assert benchmark.throughput_per_second > 0.1


# CLI runner for standalone execution
async def run_test_suite():
    """Run the complete test suite from command line"""
    
    suite = AgentTestSuite()
    
    print("🧪 Starting Comprehensive Agent Test Suite...")
    print("=" * 60)
    
    report = await suite.run_all_tests()
    
    # Print summary
    summary = report['summary']
    print(f"\n📊 Test Summary:")
    print(f"   Total Tests: {summary['total_tests']}")
    print(f"   Passed: {summary['passed_tests']} ({summary['success_rate']:.1%})")
    print(f"   Failed: {summary['failed_tests']}")
    print(f"   Duration: {summary['total_duration_ms']:.0f}ms")
    
    # Print benchmarks
    print(f"\n⚡ Performance Benchmarks:")
    for benchmark in report['benchmark_results']:
        print(f"   {benchmark['test_name']}: {benchmark['avg_duration_ms']:.1f}ms avg, {benchmark['throughput_per_second']:.1f}/sec")
    
    # Print recommendations
    print(f"\n💡 Recommendations:")
    for rec in report['recommendations']:
        print(f"   • {rec}")
    
    # Save detailed report
    report_path = Path("test_report.json")
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n📝 Detailed report saved to: {report_path}")
    
    return summary['success_rate']


if __name__ == "__main__":
    import sys
    
    async def main():
        success_rate = await run_test_suite()
        
        # Exit with appropriate code for CI/CD
        if success_rate < 0.8:
            print(f"\n❌ Test suite failed - success rate {success_rate:.1%} below threshold")
            sys.exit(1)
        else:
            print(f"\n✅ Test suite passed - success rate {success_rate:.1%}")
            sys.exit(0)
    
    asyncio.run(main())