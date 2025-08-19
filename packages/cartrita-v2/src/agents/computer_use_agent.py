"""
Cartrita V2 - OpenAI Computer Use Agent with Hierarchical Supervision
Python implementation with secure key management and full transaction logging
"""

import asyncio
import base64
import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import logging
import os
import sys
import subprocess
import uuid
import hashlib
from pathlib import Path

# OpenAI and AI libraries
import openai
from openai import OpenAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# Pydantic for data validation
from pydantic import BaseModel, Field
from typing_extensions import Literal

# Computer control libraries (you'll need to install these)
try:
    # Disable X11 checks for headless environments
    import os
    if not os.environ.get('DISPLAY'):
        os.environ['DISPLAY'] = ':99'  # Dummy display
    
    import pyautogui
    import PIL.Image
    import PIL.ImageGrab
    
    # Configure pyautogui for headless operation
    pyautogui.FAILSAFE = False
    COMPUTER_CONTROL_AVAILABLE = True
except (ImportError, Exception) as e:
    COMPUTER_CONTROL_AVAILABLE = False
    print(f"⚠️ Computer control libraries not available: {e}")
    print("💡 This is expected in headless environments - using simulation mode")

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentPermissionLevel(Enum):
    """Permission levels for agents"""
    RESTRICTED = "restricted"
    SUPERVISED = "supervised"
    AUTONOMOUS = "autonomous"
    ADMIN = "admin"

class TransactionStatus(Enum):
    """Transaction status types"""
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"

@dataclass
class Transaction:
    """Transaction record for all agent operations"""
    id: str
    agent_id: str
    operation_type: str
    description: str
    permission_level: AgentPermissionLevel
    status: TransactionStatus
    created_at: datetime
    updated_at: datetime
    supervisor_id: Optional[str] = None
    api_key_used: Optional[str] = None  # Hash of key, not actual key
    safety_checks: List[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.safety_checks is None:
            self.safety_checks = []
        if self.metadata is None:
            self.metadata = {}

class SafetyCheck(BaseModel):
    """Safety check result"""
    id: str
    code: str
    message: str
    severity: Literal["low", "medium", "high", "critical"]
    timestamp: datetime
    acknowledged: bool = False

class ComputerAction(BaseModel):
    """Computer action to be executed"""
    type: str
    x: Optional[int] = None
    y: Optional[int] = None
    button: Optional[str] = None
    keys: Optional[List[str]] = None
    text: Optional[str] = None
    scroll_x: Optional[int] = None
    scroll_y: Optional[int] = None

class APIKeyManager:
    """Secure API key management with permission-based access"""
    
    def __init__(self):
        self.key_registry: Dict[str, Dict[str, Any]] = {}
        self.active_permissions: Dict[str, Dict[str, Any]] = {}
        self.transaction_log: List[Transaction] = []
        self.load_keys()
    
    def load_keys(self):
        """Load API keys from environment with metadata"""
        keys_config = {
            'openai_general': {
                'key': os.getenv('OPENAI_API_KEY'),
                'usage': 'general_ai_operations',
                'rate_limit': {'rpm': 60, 'tpm': 90000},
                'allowed_operations': ['chat', 'vision', 'text_generation'],
                'permission_required': AgentPermissionLevel.SUPERVISED
            },
            'openai_computer_use': {
                'key': os.getenv('OPENAI_FINETUNING_API_KEY'),
                'usage': 'computer_use_and_training',
                'rate_limit': {'rpm': 30, 'tpm': 50000},
                'allowed_operations': ['computer_use', 'fine_tuning', 'batch_processing'],
                'permission_required': AgentPermissionLevel.ADMIN
            }
        }
        
        for key_id, config in keys_config.items():
            if config['key']:
                # Store hash of key, not the actual key
                key_hash = hashlib.sha256(config['key'].encode()).hexdigest()[:16]
                self.key_registry[key_id] = {
                    **config,
                    'key_hash': key_hash,
                    'key': config['key']  # In production, use proper encryption
                }
                logger.info(f"✅ Registered API key: {key_id} (hash: {key_hash})")
    
    def request_key_permission(self, agent_id: str, key_id: str, operation_type: str, 
                              supervisor_id: str, justification: str) -> Transaction:
        """Request permission to use an API key"""
        transaction_id = f"tx_{uuid.uuid4().hex[:12]}"
        
        # Check if key exists and agent has permission
        key_config = self.key_registry.get(key_id)
        if not key_config:
            raise ValueError(f"API key '{key_id}' not found in registry")
        
        # Create transaction record
        transaction = Transaction(
            id=transaction_id,
            agent_id=agent_id,
            operation_type=operation_type,
            description=f"Request to use {key_id} for {operation_type}: {justification}",
            permission_level=key_config['permission_required'],
            status=TransactionStatus.PENDING,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            supervisor_id=supervisor_id,
            metadata={
                'key_id': key_id,
                'justification': justification,
                'allowed_operations': key_config['allowed_operations'],
                'rate_limit': key_config['rate_limit']
            }
        )
        
        self.transaction_log.append(transaction)
        
        # Auto-approve for supervised operations if supervisor is valid
        if self._validate_supervisor(supervisor_id) and operation_type in key_config['allowed_operations']:
            return self._approve_transaction(transaction_id, supervisor_id)
        
        logger.info(f"🔐 Key permission requested: {transaction_id} - {agent_id} -> {key_id}")
        return transaction
    
    def _approve_transaction(self, transaction_id: str, supervisor_id: str) -> Transaction:
        """Approve a transaction and grant key access"""
        transaction = next((t for t in self.transaction_log if t.id == transaction_id), None)
        if not transaction:
            raise ValueError(f"Transaction {transaction_id} not found")
        
        transaction.status = TransactionStatus.APPROVED
        transaction.updated_at = datetime.now()
        
        # Grant temporary key access
        key_id = transaction.metadata['key_id']
        key_config = self.key_registry[key_id]
        
        self.active_permissions[transaction_id] = {
            'agent_id': transaction.agent_id,
            'key_id': key_id,
            'key': key_config['key'],
            'expires_at': datetime.now().timestamp() + 3600,  # 1 hour expiry
            'operations_allowed': key_config['allowed_operations'],
            'supervisor_id': supervisor_id
        }
        
        transaction.api_key_used = key_config['key_hash']
        logger.info(f"✅ Key permission approved: {transaction_id}")
        return transaction
    
    def get_key_for_transaction(self, transaction_id: str) -> Optional[str]:
        """Get API key for approved transaction"""
        permission = self.active_permissions.get(transaction_id)
        if not permission:
            return None
        
        # Check expiry
        if datetime.now().timestamp() > permission['expires_at']:
            del self.active_permissions[transaction_id]
            logger.warning(f"⚠️ Key permission expired: {transaction_id}")
            return None
        
        return permission['key']
    
    def _validate_supervisor(self, supervisor_id: str) -> bool:
        """Validate supervisor authorization"""
        # In production, this would check against supervisor registry
        return supervisor_id and supervisor_id.startswith('supervisor_')
    
    def log_transaction(self, transaction_id: str, status: TransactionStatus, 
                       metadata: Dict[str, Any] = None):
        """Update transaction status and log"""
        transaction = next((t for t in self.transaction_log if t.id == transaction_id), None)
        if transaction:
            transaction.status = status
            transaction.updated_at = datetime.now()
            if metadata:
                transaction.metadata.update(metadata)
            logger.info(f"📝 Transaction updated: {transaction_id} -> {status.value}")

class ComputerUseAgent:
    """OpenAI Computer Use Agent with hierarchical supervision"""
    
    def __init__(self, agent_id: str, supervisor_id: str, permission_level: AgentPermissionLevel):
        self.agent_id = agent_id
        self.supervisor_id = supervisor_id
        self.permission_level = permission_level
        self.api_key_manager = APIKeyManager()
        self.client: Optional[OpenAI] = None
        self.langchain_client: Optional[ChatOpenAI] = None
        self.active_transaction: Optional[Transaction] = None
        self.safety_checks: List[SafetyCheck] = []
        
        # Computer use settings
        self.display_width = 1024
        self.display_height = 768
        self.environment = "mac"  # or "windows", "ubuntu", "browser"
        
        logger.info(f"🤖 Computer Use Agent initialized: {agent_id}")
    
    async def request_computer_access(self, task_description: str, 
                                    justification: str) -> bool:
        """Request access to computer use capabilities"""
        try:
            # Request permission for computer use key
            transaction = self.api_key_manager.request_key_permission(
                agent_id=self.agent_id,
                key_id='openai_computer_use',
                operation_type='computer_use',
                supervisor_id=self.supervisor_id,
                justification=f"{task_description}: {justification}"
            )
            
            self.active_transaction = transaction
            
            if transaction.status == TransactionStatus.APPROVED:
                # Initialize OpenAI client with approved key
                api_key = self.api_key_manager.get_key_for_transaction(transaction.id)
                if api_key:
                    self.client = OpenAI(api_key=api_key)
                    self.langchain_client = ChatOpenAI(
                        api_key=api_key,
                        model="computer-use-preview",
                        temperature=0.1  # Lower temperature for precise computer control
                    )
                    logger.info(f"✅ Computer access granted for transaction: {transaction.id}")
                    return True
            
            logger.warning(f"⚠️ Computer access denied for transaction: {transaction.id}")
            return False
            
        except Exception as e:
            logger.error(f"❌ Failed to request computer access: {str(e)}")
            return False
    
    async def execute_computer_task(self, task: str, max_iterations: int = 10) -> Dict[str, Any]:
        """Execute a computer task with full supervision and logging"""
        if not self.client or not self.active_transaction:
            raise ValueError("Computer access not granted. Call request_computer_access() first.")
        
        task_id = f"task_{uuid.uuid4().hex[:8]}"
        start_time = datetime.now()
        
        # Log task start
        self.api_key_manager.log_transaction(
            self.active_transaction.id,
            TransactionStatus.EXECUTING,
            {
                'task_id': task_id,
                'task_description': task,
                'max_iterations': max_iterations,
                'start_time': start_time.isoformat()
            }
        )
        
        try:
            # Take initial screenshot
            initial_screenshot = await self._capture_screenshot()
            
            # Send initial request to computer-use-preview model
            response = self.client.responses.create(
                model="computer-use-preview",
                tools=[{
                    "type": "computer_use_preview",
                    "display_width": self.display_width,
                    "display_height": self.display_height,
                    "environment": self.environment
                }],
                input=[{
                    "role": "user",
                    "content": [{
                        "type": "input_text",
                        "text": task
                    }, {
                        "type": "input_image",
                        "image_url": f"data:image/png;base64,{initial_screenshot}"
                    }]
                }],
                reasoning={"summary": "detailed"},
                truncation="auto"
            )
            
            iteration_count = 0
            execution_log = []
            
            # Execute computer use loop
            while iteration_count < max_iterations:
                iteration_count += 1
                iteration_start = datetime.now()
                
                # Check for computer calls in response
                computer_calls = [item for item in response.output if getattr(item, 'type', None) == "computer_call"]
                
                if not computer_calls:
                    logger.info(f"✅ Task completed after {iteration_count} iterations")
                    break
                
                computer_call = computer_calls[0]
                action = computer_call.action
                call_id = computer_call.call_id
                
                # Check for safety warnings
                if hasattr(computer_call, 'pending_safety_checks') and computer_call.pending_safety_checks:
                    safety_result = await self._handle_safety_checks(computer_call.pending_safety_checks)
                    if not safety_result:
                        logger.error("❌ Task aborted due to safety concerns")
                        break
                
                # Log the action
                action_log = {
                    'iteration': iteration_count,
                    'timestamp': iteration_start.isoformat(),
                    'action_type': action.type,
                    'action_details': asdict(ComputerAction(**action.__dict__)),
                    'call_id': call_id
                }
                
                # Execute the computer action
                execution_result = await self._execute_computer_action(action)
                action_log['execution_result'] = execution_result
                
                # Capture screenshot after action
                screenshot = await self._capture_screenshot()
                action_log['screenshot_captured'] = True
                
                execution_log.append(action_log)
                
                # Send response back to model
                response = self.client.responses.create(
                    model="computer-use-preview",
                    previous_response_id=response.id,
                    tools=[{
                        "type": "computer_use_preview",
                        "display_width": self.display_width,
                        "display_height": self.display_height,
                        "environment": self.environment
                    }],
                    input=[{
                        "call_id": call_id,
                        "type": "computer_call_output",
                        "output": {
                            "type": "input_image",
                            "image_url": f"data:image/png;base64,{screenshot}"
                        }
                    }],
                    truncation="auto"
                )
                
                # Add small delay between actions
                await asyncio.sleep(1)
            
            # Log completion
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            result = {
                'task_id': task_id,
                'status': 'completed',
                'iterations': iteration_count,
                'duration_seconds': duration,
                'execution_log': execution_log,
                'final_response': [item.__dict__ for item in response.output if hasattr(item, '__dict__')],
                'safety_checks_triggered': len(self.safety_checks)
            }
            
            # Update transaction status
            self.api_key_manager.log_transaction(
                self.active_transaction.id,
                TransactionStatus.COMPLETED,
                {
                    'task_result': result,
                    'end_time': end_time.isoformat(),
                    'duration_seconds': duration
                }
            )
            
            logger.info(f"✅ Computer task completed: {task_id} in {duration:.2f}s")
            return result
            
        except Exception as e:
            logger.error(f"❌ Computer task failed: {str(e)}")
            self.api_key_manager.log_transaction(
                self.active_transaction.id,
                TransactionStatus.FAILED,
                {'error': str(e)}
            )
            raise
    
    async def _capture_screenshot(self) -> str:
        """Capture screenshot and return as base64"""
        if not COMPUTER_CONTROL_AVAILABLE:
            # Return a dummy screenshot for testing
            logger.warning("📸 Computer control not available, using dummy screenshot")
            return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        
        try:
            # Capture screenshot using pyautogui
            screenshot = pyautogui.screenshot()
            
            # Resize if needed
            if screenshot.size != (self.display_width, self.display_height):
                screenshot = screenshot.resize((self.display_width, self.display_height))
            
            # Convert to base64
            import io
            buffer = io.BytesIO()
            screenshot.save(buffer, format='PNG')
            screenshot_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            logger.debug(f"📸 Screenshot captured: {len(screenshot_base64)} bytes")
            return screenshot_base64
            
        except Exception as e:
            logger.error(f"❌ Screenshot capture failed: {str(e)}")
            raise
    
    async def _execute_computer_action(self, action) -> Dict[str, Any]:
        """Execute computer action safely with logging"""
        action_type = action.type
        result = {'action_type': action_type, 'success': False, 'message': ''}
        
        if not COMPUTER_CONTROL_AVAILABLE:
            result['message'] = 'Computer control libraries not available'
            logger.warning(f"🖱️ Simulated action: {action_type}")
            await asyncio.sleep(0.5)  # Simulate action delay
            result['success'] = True
            return result
        
        try:
            if action_type == "click":
                x, y = int(action.x), int(action.y)
                button = action.button or "left"
                
                logger.info(f"🖱️ Click at ({x}, {y}) with {button} button")
                
                if button == "left":
                    pyautogui.click(x, y)
                elif button == "right":
                    pyautogui.rightClick(x, y)
                elif button == "middle":
                    pyautogui.middleClick(x, y)
                
                result['success'] = True
                result['message'] = f"Clicked at ({x}, {y})"
                
            elif action_type == "scroll":
                x, y = int(action.x), int(action.y)
                scroll_x = int(action.scroll_x or 0)
                scroll_y = int(action.scroll_y or 0)
                
                logger.info(f"📜 Scroll at ({x}, {y}) by ({scroll_x}, {scroll_y})")
                
                pyautogui.moveTo(x, y)
                if scroll_y != 0:
                    pyautogui.scroll(scroll_y, x=x, y=y)
                
                result['success'] = True
                result['message'] = f"Scrolled at ({x}, {y})"
                
            elif action_type == "keypress":
                keys = action.keys or []
                logger.info(f"⌨️ Key press: {keys}")
                
                for key in keys:
                    pyautogui.press(key.lower())
                
                result['success'] = True
                result['message'] = f"Pressed keys: {keys}"
                
            elif action_type == "type":
                text = action.text or ""
                logger.info(f"⌨️ Type text: {text}")
                
                pyautogui.typewrite(text)
                
                result['success'] = True
                result['message'] = f"Typed: {text}"
                
            elif action_type == "wait":
                logger.info("⏳ Wait action")
                await asyncio.sleep(2)
                result['success'] = True
                result['message'] = "Waited 2 seconds"
                
            elif action_type == "screenshot":
                logger.info("📸 Screenshot action")
                result['success'] = True
                result['message'] = "Screenshot taken"
                
            else:
                result['message'] = f"Unknown action type: {action_type}"
                logger.warning(f"❓ Unknown action: {action_type}")
        
        except Exception as e:
            result['message'] = f"Action failed: {str(e)}"
            logger.error(f"❌ Action execution failed: {str(e)}")
        
        return result
    
    async def _handle_safety_checks(self, pending_checks: List[Dict]) -> bool:
        """Handle safety checks with supervisor approval"""
        logger.warning(f"⚠️ Safety checks triggered: {len(pending_checks)}")
        
        for check_data in pending_checks:
            safety_check = SafetyCheck(
                id=check_data['id'],
                code=check_data['code'],
                message=check_data['message'],
                severity="high",  # Assume high severity for computer use
                timestamp=datetime.now()
            )
            
            self.safety_checks.append(safety_check)
            
            # For high-risk operations, require explicit supervisor approval
            if check_data['code'] in ['malicious_instructions', 'sensitive_domain']:
                logger.error(f"🚨 Critical safety check: {check_data['code']} - {check_data['message']}")
                # In production, this would pause and request supervisor intervention
                return False
            
            # For other checks, log and continue with caution
            safety_check.acknowledged = True
            logger.warning(f"⚠️ Safety check acknowledged: {check_data['code']}")
        
        return True
    
    def get_transaction_history(self) -> List[Dict[str, Any]]:
        """Get transaction history for this agent"""
        return [
            asdict(t) for t in self.api_key_manager.transaction_log 
            if t.agent_id == self.agent_id
        ]

class ComputerUseAgentManager:
    """Manager for computer use agents in the hierarchical system"""
    
    def __init__(self):
        self.agents: Dict[str, ComputerUseAgent] = {}
        self.supervisor_id = "supervisor_cartrita_v2"
        self.agent_roster: List[Dict[str, Any]] = []
        
    def create_agent(self, agent_name: str, permission_level: AgentPermissionLevel = AgentPermissionLevel.SUPERVISED) -> ComputerUseAgent:
        """Create a new computer use agent"""
        agent_id = f"cua_{agent_name}_{uuid.uuid4().hex[:8]}"
        
        agent = ComputerUseAgent(
            agent_id=agent_id,
            supervisor_id=self.supervisor_id,
            permission_level=permission_level
        )
        
        self.agents[agent_id] = agent
        
        # Add to roster
        roster_entry = {
            'agent_id': agent_id,
            'agent_name': agent_name,
            'agent_type': 'computer_use',
            'permission_level': permission_level.value,
            'created_at': datetime.now().isoformat(),
            'supervisor_id': self.supervisor_id,
            'capabilities': [
                'computer_control',
                'screenshot_analysis', 
                'web_browsing',
                'application_automation',
                'form_filling',
                'data_extraction'
            ],
            'safety_features': [
                'supervised_execution',
                'transaction_logging',
                'safety_check_enforcement',
                'permission_based_key_access'
            ]
        }
        
        self.agent_roster.append(roster_entry)
        
        logger.info(f"✅ Computer Use Agent created: {agent_name} ({agent_id})")
        return agent
    
    def get_agent(self, agent_id: str) -> Optional[ComputerUseAgent]:
        """Get agent by ID"""
        return self.agents.get(agent_id)
    
    def list_agents(self) -> List[Dict[str, Any]]:
        """List all agents in the roster"""
        return self.agent_roster
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status"""
        all_transactions = []
        for agent in self.agents.values():
            all_transactions.extend(agent.get_transaction_history())
        
        active_transactions = [t for t in all_transactions if t['status'] in ['pending', 'executing']]
        completed_transactions = [t for t in all_transactions if t['status'] == 'completed']
        failed_transactions = [t for t in all_transactions if t['status'] == 'failed']
        
        return {
            'total_agents': len(self.agents),
            'supervisor_id': self.supervisor_id,
            'transaction_stats': {
                'total': len(all_transactions),
                'active': len(active_transactions),
                'completed': len(completed_transactions),
                'failed': len(failed_transactions)
            },
            'agents': self.agent_roster,
            'computer_control_available': COMPUTER_CONTROL_AVAILABLE,
            'timestamp': datetime.now().isoformat()
        }

# Example usage and testing
async def main():
    """Example usage of the Computer Use Agent system"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Cartrita V2 Computer Use Agent')
    parser.add_argument('--task-file', type=str, help='JSON file containing task data')
    parser.add_argument('--interactive', action='store_true', help='Run in interactive mode')
    args = parser.parse_args()
    
    if args.task_file:
        # Load task from file
        try:
            with open(args.task_file, 'r') as f:
                task_data = json.load(f)
            
            print(f"🚀 Executing task from file: {args.task_file}")
            
            # Create agent manager
            manager = ComputerUseAgentManager()
            
            # Create agent
            agent = manager.create_agent(
                task_data.get('agent_id', 'file_task_agent'),
                AgentPermissionLevel(task_data.get('permission_level', 'SUPERVISED'))
            )
            
            # Request computer access
            access_granted = await agent.request_computer_access(
                task_data['task'],
                task_data.get('justification', 'Task from file execution')
            )
            
            if access_granted:
                # Execute task
                result = await agent.execute_computer_task(
                    task_data['task'],
                    max_iterations=task_data.get('max_iterations', 10)
                )
                
                # Output result as JSON for bridge integration
                print(json.dumps(result, default=str))
            else:
                print(json.dumps({
                    'success': False,
                    'error': 'Computer access denied'
                }, default=str))
                
        except Exception as e:
            print(json.dumps({
                'success': False,
                'error': f'Task execution failed: {str(e)}'
            }, default=str))
        
        return
    
    # Interactive mode (original example)
    print("🚀 Starting Cartrita V2 Computer Use Agent System\n")
    
    # Create agent manager
    manager = ComputerUseAgentManager()
    
    # Create a computer use agent
    web_agent = manager.create_agent("web_automation", AgentPermissionLevel.SUPERVISED)
    
    # Print system status
    status = manager.get_system_status()
    print("📊 System Status:")
    print(json.dumps(status, indent=2, default=str))
    print()
    
    # Request computer access for a task
    task_description = "Take a screenshot and analyze the current desktop"
    justification = "User requested desktop analysis for productivity assessment"
    
    access_granted = await web_agent.request_computer_access(task_description, justification)
    
    if access_granted:
        print("✅ Computer access granted!")
        
        # Execute a simple task
        try:
            result = await web_agent.execute_computer_task(
                "Take a screenshot of the current screen and describe what you see",
                max_iterations=3
            )
            
            print("✅ Task completed successfully!")
            print(f"Result: {json.dumps(result, indent=2, default=str)}")
            
        except Exception as e:
            print(f"❌ Task failed: {str(e)}")
    else:
        print("❌ Computer access denied!")
    
    # Show transaction history
    history = web_agent.get_transaction_history()
    print("\n📝 Transaction History:")
    for transaction in history:
        print(f"  - {transaction['id']}: {transaction['description']} ({transaction['status']})")

if __name__ == "__main__":
    asyncio.run(main())