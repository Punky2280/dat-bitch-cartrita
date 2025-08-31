# Cartrita Hybrid System Testing Suite
# Comprehensive integration tests for Node.js/Python hybrid architecture

import asyncio
import aiohttp
import pytest
import logging
import time
from pathlib import Path
import sys

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HybridSystemTester:
    """Comprehensive testing suite for the Cartrita hybrid architecture."""
    
    def __init__(self):
        self.nodejs_base_url = "http://localhost:8000"
        self.python_base_url = "http://localhost:8002"
        self.v2_base_url = "http://localhost:3002"
        self.frontend_url = "http://localhost:3000"
        
    async def test_service_health(self) -> dict:
        """Test health endpoints for all services."""
        results = {}
        
        services = {
            'nodejs_backend': f"{self.nodejs_base_url}/health",
            'python_backend': f"{self.python_base_url}/health",
            'cartrita_v2': f"{self.v2_base_url}/health",
            'frontend': self.frontend_url
        }
        
        async with aiohttp.ClientSession() as session:
            for service, url in services.items():
                try:
                    async with session.get(url, timeout=5) as response:
                        if response.status == 200:
                            results[service] = {'status': 'healthy', 'response_time': response.headers.get('x-response-time')}
                        else:
                            results[service] = {'status': f'unhealthy ({response.status})'}
                except Exception as e:
                    results[service] = {'status': f'error: {str(e)}'}
        
        return results
    
    async def test_mcp_communication(self) -> dict:
        """Test MCP communication between Node.js and Python."""
        results = {}
        
        async with aiohttp.ClientSession() as session:
            # Test MCP status from Node.js side
            try:
                async with session.get(f"{self.nodejs_base_url}/api/mcp/status") as response:
                    if response.status == 200:
                        data = await response.json()
                        results['nodejs_mcp'] = data
                    else:
                        results['nodejs_mcp'] = {'error': f'Status {response.status}'}
            except Exception as e:
                results['nodejs_mcp'] = {'error': str(e)}
            
            # Test Python agent registration
            try:
                async with session.get(f"{self.python_base_url}/api/agents/status") as response:
                    if response.status == 200:
                        data = await response.json()
                        results['python_agents'] = data
                    else:
                        results['python_agents'] = {'error': f'Status {response.status}'}
            except Exception as e:
                results['python_agents'] = {'error': str(e)}
        
        return results
    
    async def test_language_routing(self) -> dict:
        """Test intelligent language routing between Node.js and Python."""
        results = {}
        
        test_tasks = [
            {
                'name': 'ml_task',
                'data': {
                    'task_type': 'machine_learning',
                    'description': 'Train a sentiment analysis model',
                    'data': ['happy text', 'sad text', 'neutral text']
                },
                'expected_language': 'python'
            },
            {
                'name': 'api_task',
                'data': {
                    'task_type': 'api_integration',
                    'description': 'Handle HTTP request routing',
                    'endpoint': '/api/users'
                },
                'expected_language': 'nodejs'
            },
            {
                'name': 'vector_search',
                'data': {
                    'task_type': 'vector_search',
                    'query': 'find similar documents',
                    'dimension': 1536
                },
                'expected_language': 'python'
            }
        ]
        
        async with aiohttp.ClientSession() as session:
            for task in test_tasks:
                try:
                    async with session.post(
                        f"{self.nodejs_base_url}/api/language-router/route",
                        json=task['data']
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            results[task['name']] = {
                                'routed_to': data.get('selected_language'),
                                'expected': task['expected_language'],
                                'correct': data.get('selected_language') == task['expected_language'],
                                'confidence': data.get('confidence'),
                                'reasoning': data.get('reasoning')
                            }
                        else:
                            results[task['name']] = {'error': f'Status {response.status}'}
                except Exception as e:
                    results[task['name']] = {'error': str(e)}
        
        return results
    
    async def test_ai_agents(self) -> dict:
        """Test AI agent functionality."""
        results = {}
        
        agent_tests = [
            {
                'name': 'ml_model_agent',
                'endpoint': f"{self.python_base_url}/api/ml/inference",
                'data': {
                    'model_type': 'sentiment',
                    'input_text': 'I love this hybrid architecture!'
                }
            },
            {
                'name': 'data_analysis_agent',
                'endpoint': f"{self.python_base_url}/api/data/analysis",
                'data': {
                    'data': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                    'analysis_type': 'statistics'
                }
            },
            {
                'name': 'vector_search_agent',
                'endpoint': f"{self.python_base_url}/api/vector/search",
                'data': {
                    'query': 'test query',
                    'top_k': 5
                }
            }
        ]
        
        async with aiohttp.ClientSession() as session:
            for test in agent_tests:
                try:
                    async with session.post(test['endpoint'], json=test['data']) as response:
                        if response.status == 200:
                            data = await response.json()
                            results[test['name']] = {
                                'status': 'success',
                                'response': data,
                                'response_time': response.headers.get('x-response-time')
                            }
                        else:
                            results[test['name']] = {'error': f'Status {response.status}'}
                except Exception as e:
                    results[test['name']] = {'error': str(e)}
        
        return results
    
    async def test_v2_api_routes(self) -> dict:
        """Test Cartrita V2 API routes."""
        results = {}
        
        v2_routes = [
            '/api/v2/system/health',
            '/api/v2/system/metrics',
            '/api/v2/ai/chat',
            '/api/v2/knowledge/search',
            '/api/v2/huggingface/models'
        ]
        
        async with aiohttp.ClientSession() as session:
            for route in v2_routes:
                try:
                    url = f"{self.v2_base_url}{route}"
                    async with session.get(url) as response:
                        results[route] = {
                            'status_code': response.status,
                            'accessible': response.status < 500,
                            'response_time': response.headers.get('x-response-time')
                        }
                except Exception as e:
                    results[route] = {'error': str(e)}
        
        return results
    
    async def test_cross_service_integration(self) -> dict:
        """Test integration between all services."""
        results = {}
        
        # Test workflow that involves multiple services
        async with aiohttp.ClientSession() as session:
            # 1. Start a task on Node.js that should be routed to Python
            try:
                task_data = {
                    'task_type': 'data_analysis',
                    'input_data': [1, 2, 3, 4, 5],
                    'analysis_type': 'statistical_summary'
                }
                
                async with session.post(
                    f"{self.nodejs_base_url}/api/hybrid/execute",
                    json=task_data
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        results['hybrid_execution'] = {
                            'status': 'success',
                            'execution_path': data.get('execution_path'),
                            'result': data.get('result'),
                            'performance': data.get('performance_metrics')
                        }
                    else:
                        results['hybrid_execution'] = {'error': f'Status {response.status}'}
            except Exception as e:
                results['hybrid_execution'] = {'error': str(e)}
        
        return results
    
    async def generate_report(self) -> dict:
        """Generate comprehensive test report."""
        logger.info("🧪 Starting comprehensive hybrid system tests...")
        
        test_results = {}
        
        # Run all test suites
        test_suites = [
            ('Service Health', self.test_service_health),
            ('MCP Communication', self.test_mcp_communication),
            ('Language Routing', self.test_language_routing),
            ('AI Agents', self.test_ai_agents),
            ('V2 API Routes', self.test_v2_api_routes),
            ('Cross-Service Integration', self.test_cross_service_integration)
        ]
        
        for suite_name, test_func in test_suites:
            logger.info(f"Running {suite_name} tests...")
            start_time = time.time()
            try:
                results = await test_func()
                test_results[suite_name] = {
                    'status': 'completed',
                    'results': results,
                    'duration': time.time() - start_time
                }
                logger.info(f"✅ {suite_name} tests completed")
            except Exception as e:
                test_results[suite_name] = {
                    'status': 'failed',
                    'error': str(e),
                    'duration': time.time() - start_time
                }
                logger.error(f"❌ {suite_name} tests failed: {e}")
        
        # Generate summary
        total_tests = sum(
            len(suite['results']) if 'results' in suite else 0
            for suite in test_results.values()
        )
        
        passed_tests = sum(
            sum(1 for test in suite['results'].values() 
                if isinstance(test, dict) and test.get('status') == 'success')
            if 'results' in suite else 0
            for suite in test_results.values()
        )
        
        test_results['summary'] = {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failed_tests': total_tests - passed_tests,
            'success_rate': f"{(passed_tests / total_tests * 100):.1f}%" if total_tests > 0 else "0%"
        }
        
        return test_results


async def main():
    """Main test execution."""
    tester = HybridSystemTester()
    
    # Wait for services to be ready
    logger.info("⏳ Waiting for services to be ready...")
    await asyncio.sleep(5)
    
    # Run tests
    report = await tester.generate_report()
    
    # Print results
    print("\n" + "="*60)
    print("🧪 CARTRITA HYBRID SYSTEM TEST REPORT")
    print("="*60)
    
    summary = report.get('summary', {})
    print(f"\n📊 Summary:")
    print(f"   Total Tests: {summary.get('total_tests', 0)}")
    print(f"   Passed: {summary.get('passed_tests', 0)}")
    print(f"   Failed: {summary.get('failed_tests', 0)}")
    print(f"   Success Rate: {summary.get('success_rate', '0%')}")
    
    print(f"\n📋 Test Suite Results:")
    for suite_name, results in report.items():
        if suite_name == 'summary':
            continue
        
        status_icon = "✅" if results['status'] == 'completed' else "❌"
        duration = results.get('duration', 0)
        print(f"   {status_icon} {suite_name}: {results['status']} ({duration:.2f}s)")
        
        if 'error' in results:
            print(f"      Error: {results['error']}")
    
    # Save detailed report
    import json
    report_file = '/tmp/cartrita_test_report.json'
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n📄 Detailed report saved to: {report_file}")
    print("="*60)
    
    # Exit with appropriate code
    success_rate = float(summary.get('success_rate', '0%').rstrip('%'))
    sys.exit(0 if success_rate >= 80 else 1)


if __name__ == "__main__":
    asyncio.run(main())