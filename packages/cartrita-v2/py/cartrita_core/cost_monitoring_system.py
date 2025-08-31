"""
Comprehensive Cost Monitoring and Budget Enforcement System
Real-time cost tracking, budget enforcement, and financial analytics for the agent hierarchy
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Union, Callable
from enum import Enum
import uuid
from pathlib import Path
import sqlite3
import aiosqlite

try:
    import redis.asyncio as redis
except ImportError:
    redis = None

logger = logging.getLogger(__name__)


class BudgetType(str, Enum):
    """Types of budgets"""
    DAILY = "daily"
    WEEKLY = "weekly" 
    MONTHLY = "monthly"
    TASK = "task"
    USER = "user"
    PROJECT = "project"


class CostCategory(str, Enum):
    """Cost categories for tracking"""
    MODEL_INFERENCE = "model_inference"
    TOOL_EXECUTION = "tool_execution" 
    STORAGE = "storage"
    NETWORK = "network"
    EMBEDDINGS = "embeddings"
    IMAGE_GENERATION = "image_generation"
    COMPUTE = "compute"
    OVERRIDE_PROCESSING = "override_processing"


class AlertSeverity(str, Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


@dataclass
class ModelPricing:
    """Model pricing information"""
    model_id: str
    input_cost_per_token: float
    output_cost_per_token: float
    cost_per_request: float = 0.0
    effective_date: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def calculate_cost(self, input_tokens: int, output_tokens: int, requests: int = 1) -> float:
        """Calculate total cost for usage"""
        return (
            input_tokens * self.input_cost_per_token +
            output_tokens * self.output_cost_per_token +
            requests * self.cost_per_request
        )


@dataclass
class CostEntry:
    """Individual cost tracking entry"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Context
    user_id: str = "anonymous"
    task_id: Optional[str] = None
    conversation_id: Optional[str] = None
    agent_name: Optional[str] = None
    
    # Cost details
    category: CostCategory = CostCategory.MODEL_INFERENCE
    model_id: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0
    requests: int = 1
    
    # Costs
    cost_usd: float = 0.0
    estimated_cost_usd: Optional[float] = None
    
    # Additional metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)


@dataclass 
class BudgetLimit:
    """Budget limit definition"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    budget_type: BudgetType = BudgetType.DAILY
    
    # Scope
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    category: Optional[CostCategory] = None
    
    # Limits
    limit_usd: float = 0.0
    warning_threshold_pct: float = 0.8  # 80%
    critical_threshold_pct: float = 0.95  # 95%
    
    # Time window
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    
    # Status
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    @property
    def warning_amount_usd(self) -> float:
        return self.limit_usd * self.warning_threshold_pct
    
    @property
    def critical_amount_usd(self) -> float:
        return self.limit_usd * self.critical_threshold_pct


@dataclass
class CostAlert:
    """Cost monitoring alert"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    severity: AlertSeverity = AlertSeverity.WARNING
    budget_id: str = ""
    message: str = ""
    
    # Current state
    current_cost_usd: float = 0.0
    budget_limit_usd: float = 0.0
    utilization_pct: float = 0.0
    
    # Actions taken
    actions_taken: List[str] = field(default_factory=list)
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    
    # Metadata
    context: Dict[str, Any] = field(default_factory=dict)


class CostCalculator:
    """Handles cost calculations for different services"""
    
    def __init__(self):
        self.pricing_data: Dict[str, ModelPricing] = {}
        self._load_default_pricing()
    
    def _load_default_pricing(self):
        """Load default pricing for known models"""
        
        # GPT-5 family pricing (estimated based on performance tiers)
        self.pricing_data.update({
            "gpt-5-nano": ModelPricing(
                model_id="gpt-5-nano",
                input_cost_per_token=0.0000005,
                output_cost_per_token=0.000001
            ),
            "gpt-5-mini": ModelPricing(
                model_id="gpt-5-mini", 
                input_cost_per_token=0.0000015,
                output_cost_per_token=0.000002
            ),
            "gpt-5": ModelPricing(
                model_id="gpt-5",
                input_cost_per_token=0.000004,
                output_cost_per_token=0.000008
            ),
            "gpt-4.1": ModelPricing(
                model_id="gpt-4.1",
                input_cost_per_token=0.00001,
                output_cost_per_token=0.00003
            ),
            "gpt-4o-realtime-preview": ModelPricing(
                model_id="gpt-4o-realtime-preview",
                input_cost_per_token=0.000006,
                output_cost_per_token=0.000024
            ),
            "text-embedding-3-small": ModelPricing(
                model_id="text-embedding-3-small",
                input_cost_per_token=0.00000002,
                output_cost_per_token=0.0
            ),
            "text-embedding-3-large": ModelPricing(
                model_id="text-embedding-3-large",
                input_cost_per_token=0.00000013,
                output_cost_per_token=0.0
            )
        })
        
        # Tool execution costs (estimated)
        self.tool_costs = {
            "code_interpreter": 0.001,  # per execution
            "file_search": 0.0001,     # per search
            "image_generation": 0.020,  # per image
            "web_search_preview": 0.002, # per search
            "computer_use_preview": 0.005 # per action
        }
    
    def calculate_model_cost(
        self,
        model_id: str,
        input_tokens: int,
        output_tokens: int,
        requests: int = 1
    ) -> float:
        """Calculate cost for model usage"""
        
        pricing = self.pricing_data.get(model_id)
        if not pricing:
            logger.warning(f"No pricing data for model {model_id}, using default")
            # Use GPT-5-mini as default
            pricing = self.pricing_data["gpt-5-mini"]
        
        return pricing.calculate_cost(input_tokens, output_tokens, requests)
    
    def calculate_tool_cost(self, tool_name: str, usage_count: int = 1) -> float:
        """Calculate cost for tool usage"""
        
        base_cost = self.tool_costs.get(tool_name, 0.001)  # Default small cost
        return base_cost * usage_count
    
    def update_pricing(self, model_id: str, pricing: ModelPricing):
        """Update pricing for a model"""
        self.pricing_data[model_id] = pricing
        logger.info(f"Updated pricing for {model_id}")


class CostStorage:
    """Handles cost data storage and retrieval"""
    
    def __init__(self, db_path: str = ":memory:", use_redis: bool = True):
        self.db_path = db_path
        self.use_redis = use_redis and redis is not None
        self.redis_client: Optional[redis.Redis] = None
        self.db_connection: Optional[aiosqlite.Connection] = None
    
    async def initialize(self):
        """Initialize storage backends"""
        
        # Initialize SQLite
        self.db_connection = await aiosqlite.connect(self.db_path)
        await self._create_tables()
        
        # Initialize Redis if available
        if self.use_redis:
            try:
                self.redis_client = redis.from_url("redis://localhost:6379", decode_responses=True)
                await self.redis_client.ping()
                logger.info("Redis connection established")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}, using SQLite only")
                self.use_redis = False
    
    async def _create_tables(self):
        """Create SQLite tables"""
        
        await self.db_connection.execute("""
        CREATE TABLE IF NOT EXISTS cost_entries (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            user_id TEXT NOT NULL,
            task_id TEXT,
            conversation_id TEXT,
            agent_name TEXT,
            category TEXT NOT NULL,
            model_id TEXT,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            requests INTEGER DEFAULT 1,
            cost_usd REAL NOT NULL,
            estimated_cost_usd REAL,
            metadata TEXT,
            tags TEXT
        )
        """)
        
        await self.db_connection.execute("""
        CREATE TABLE IF NOT EXISTS budget_limits (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            budget_type TEXT NOT NULL,
            user_id TEXT,
            project_id TEXT,
            category TEXT,
            limit_usd REAL NOT NULL,
            warning_threshold_pct REAL DEFAULT 0.8,
            critical_threshold_pct REAL DEFAULT 0.95,
            start_date TEXT,
            end_date TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at TEXT NOT NULL
        )
        """)
        
        await self.db_connection.execute("""
        CREATE TABLE IF NOT EXISTS cost_alerts (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            severity TEXT NOT NULL,
            budget_id TEXT NOT NULL,
            message TEXT NOT NULL,
            current_cost_usd REAL NOT NULL,
            budget_limit_usd REAL NOT NULL,
            utilization_pct REAL NOT NULL,
            actions_taken TEXT,
            acknowledged BOOLEAN DEFAULT 0,
            acknowledged_by TEXT,
            acknowledged_at TEXT,
            context TEXT
        )
        """)
        
        # Create indexes
        await self.db_connection.execute("CREATE INDEX IF NOT EXISTS idx_cost_entries_timestamp ON cost_entries(timestamp)")
        await self.db_connection.execute("CREATE INDEX IF NOT EXISTS idx_cost_entries_user ON cost_entries(user_id)")
        await self.db_connection.execute("CREATE INDEX IF NOT EXISTS idx_cost_entries_task ON cost_entries(task_id)")
        
        await self.db_connection.commit()
    
    async def store_cost_entry(self, entry: CostEntry):
        """Store a cost entry"""
        
        # Store in SQLite
        await self.db_connection.execute("""
        INSERT INTO cost_entries (
            id, timestamp, user_id, task_id, conversation_id, agent_name,
            category, model_id, input_tokens, output_tokens, requests,
            cost_usd, estimated_cost_usd, metadata, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            entry.id,
            entry.timestamp.isoformat(),
            entry.user_id,
            entry.task_id,
            entry.conversation_id,
            entry.agent_name,
            entry.category.value,
            entry.model_id,
            entry.input_tokens,
            entry.output_tokens,
            entry.requests,
            entry.cost_usd,
            entry.estimated_cost_usd,
            json.dumps(entry.metadata),
            json.dumps(entry.tags)
        ))
        await self.db_connection.commit()
        
        # Store in Redis cache if available
        if self.use_redis and self.redis_client:
            try:
                cache_key = f"cost_entry:{entry.id}"
                await self.redis_client.setex(
                    cache_key,
                    3600,  # 1 hour TTL
                    json.dumps(asdict(entry), default=str)
                )
                
                # Update user total cache
                user_key = f"user_cost:{entry.user_id}:{datetime.now().date().isoformat()}"
                await self.redis_client.incrbyfloat(user_key, entry.cost_usd)
                await self.redis_client.expire(user_key, 86400)  # 24 hour TTL
                
            except Exception as e:
                logger.warning(f"Redis cache update failed: {e}")
    
    async def get_cost_summary(
        self,
        user_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        category: Optional[CostCategory] = None
    ) -> Dict[str, Any]:
        """Get cost summary with filters"""
        
        # Build query
        where_conditions = []
        params = []
        
        if user_id:
            where_conditions.append("user_id = ?")
            params.append(user_id)
        
        if start_date:
            where_conditions.append("timestamp >= ?")
            params.append(start_date.isoformat())
        
        if end_date:
            where_conditions.append("timestamp <= ?")
            params.append(end_date.isoformat())
        
        if category:
            where_conditions.append("category = ?")
            params.append(category.value)
        
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        # Execute query
        async with self.db_connection.execute(f"""
        SELECT 
            COUNT(*) as total_entries,
            SUM(cost_usd) as total_cost,
            AVG(cost_usd) as avg_cost,
            SUM(input_tokens) as total_input_tokens,
            SUM(output_tokens) as total_output_tokens,
            category,
            model_id
        FROM cost_entries 
        WHERE {where_clause}
        GROUP BY category, model_id
        """, params) as cursor:
            
            results = await cursor.fetchall()
            
            summary = {
                "total_cost": 0.0,
                "total_entries": 0,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "by_category": {},
                "by_model": {},
                "period": {
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None
                }
            }
            
            for row in results:
                (entries, cost, avg_cost, input_tokens, output_tokens, category, model_id) = row
                
                summary["total_entries"] += entries or 0
                summary["total_cost"] += cost or 0.0
                summary["total_input_tokens"] += input_tokens or 0
                summary["total_output_tokens"] += output_tokens or 0
                
                # By category
                if category not in summary["by_category"]:
                    summary["by_category"][category] = {"cost": 0.0, "entries": 0}
                summary["by_category"][category]["cost"] += cost or 0.0
                summary["by_category"][category]["entries"] += entries or 0
                
                # By model
                if model_id:
                    if model_id not in summary["by_model"]:
                        summary["by_model"][model_id] = {"cost": 0.0, "entries": 0}
                    summary["by_model"][model_id]["cost"] += cost or 0.0
                    summary["by_model"][model_id]["entries"] += entries or 0
            
            return summary
    
    async def store_budget_limit(self, budget: BudgetLimit):
        """Store budget limit"""
        
        await self.db_connection.execute("""
        INSERT OR REPLACE INTO budget_limits (
            id, name, budget_type, user_id, project_id, category,
            limit_usd, warning_threshold_pct, critical_threshold_pct,
            start_date, end_date, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            budget.id,
            budget.name,
            budget.budget_type.value,
            budget.user_id,
            budget.project_id,
            budget.category.value if budget.category else None,
            budget.limit_usd,
            budget.warning_threshold_pct,
            budget.critical_threshold_pct,
            budget.start_date.isoformat() if budget.start_date else None,
            budget.end_date.isoformat() if budget.end_date else None,
            budget.is_active,
            budget.created_at.isoformat()
        ))
        await self.db_connection.commit()
    
    async def get_active_budgets(self) -> List[BudgetLimit]:
        """Get all active budget limits"""
        
        async with self.db_connection.execute("""
        SELECT * FROM budget_limits WHERE is_active = 1
        """) as cursor:
            
            rows = await cursor.fetchall()
            budgets = []
            
            for row in rows:
                budget = BudgetLimit(
                    id=row[0],
                    name=row[1],
                    budget_type=BudgetType(row[2]),
                    user_id=row[3],
                    project_id=row[4],
                    category=CostCategory(row[5]) if row[5] else None,
                    limit_usd=row[6],
                    warning_threshold_pct=row[7],
                    critical_threshold_pct=row[8],
                    start_date=datetime.fromisoformat(row[9]) if row[9] else None,
                    end_date=datetime.fromisoformat(row[10]) if row[10] else None,
                    is_active=row[11],
                    created_at=datetime.fromisoformat(row[12])
                )
                budgets.append(budget)
            
            return budgets
    
    async def store_alert(self, alert: CostAlert):
        """Store cost alert"""
        
        await self.db_connection.execute("""
        INSERT INTO cost_alerts (
            id, timestamp, severity, budget_id, message,
            current_cost_usd, budget_limit_usd, utilization_pct,
            actions_taken, acknowledged, acknowledged_by, acknowledged_at, context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alert.id,
            alert.timestamp.isoformat(),
            alert.severity.value,
            alert.budget_id,
            alert.message,
            alert.current_cost_usd,
            alert.budget_limit_usd,
            alert.utilization_pct,
            json.dumps(alert.actions_taken),
            alert.acknowledged,
            alert.acknowledged_by,
            alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
            json.dumps(alert.context)
        ))
        await self.db_connection.commit()
    
    async def close(self):
        """Close storage connections"""
        
        if self.db_connection:
            await self.db_connection.close()
        
        if self.redis_client:
            await self.redis_client.close()


class BudgetEnforcer:
    """Enforces budget limits and takes preventive actions"""
    
    def __init__(self, storage: CostStorage):
        self.storage = storage
        self.enforcement_actions: Dict[str, Callable] = {}
        self.active_limits: Dict[str, BudgetLimit] = {}
        
    def register_enforcement_action(self, name: str, action: Callable):
        """Register an enforcement action"""
        self.enforcement_actions[name] = action
        logger.info(f"Registered enforcement action: {name}")
    
    async def check_budget_compliance(
        self,
        user_id: str,
        estimated_cost: float,
        task_id: Optional[str] = None,
        category: Optional[CostCategory] = None
    ) -> Dict[str, Any]:
        """Check if a proposed action would violate budget limits"""
        
        # Get applicable budgets
        applicable_budgets = await self._get_applicable_budgets(user_id, task_id, category)
        
        compliance_result = {
            "allowed": True,
            "warnings": [],
            "blocks": [],
            "budget_checks": []
        }
        
        for budget in applicable_budgets:
            # Get current usage for this budget
            current_usage = await self._get_current_usage(budget)
            projected_usage = current_usage + estimated_cost
            
            utilization_pct = (projected_usage / budget.limit_usd) * 100 if budget.limit_usd > 0 else 0
            
            check_result = {
                "budget_id": budget.id,
                "budget_name": budget.name,
                "current_usage": current_usage,
                "projected_usage": projected_usage,
                "limit": budget.limit_usd,
                "utilization_pct": utilization_pct,
                "status": "ok"
            }
            
            # Check thresholds
            if projected_usage >= budget.limit_usd:
                check_result["status"] = "blocked"
                compliance_result["allowed"] = False
                compliance_result["blocks"].append(f"Budget '{budget.name}' would be exceeded")
                
            elif projected_usage >= budget.critical_amount_usd:
                check_result["status"] = "critical"
                compliance_result["warnings"].append(f"Budget '{budget.name}' is at critical level")
                
            elif projected_usage >= budget.warning_amount_usd:
                check_result["status"] = "warning"
                compliance_result["warnings"].append(f"Budget '{budget.name}' is approaching limit")
            
            compliance_result["budget_checks"].append(check_result)
        
        return compliance_result
    
    async def _get_applicable_budgets(
        self,
        user_id: str,
        task_id: Optional[str] = None,
        category: Optional[CostCategory] = None
    ) -> List[BudgetLimit]:
        """Get budgets applicable to this user/task/category"""
        
        all_budgets = await self.storage.get_active_budgets()
        applicable = []
        
        for budget in all_budgets:
            # Check user scope
            if budget.user_id and budget.user_id != user_id:
                continue
            
            # Check category scope
            if budget.category and budget.category != category:
                continue
            
            # Check time scope
            now = datetime.now(timezone.utc)
            if budget.start_date and now < budget.start_date:
                continue
            if budget.end_date and now > budget.end_date:
                continue
            
            applicable.append(budget)
        
        return applicable
    
    async def _get_current_usage(self, budget: BudgetLimit) -> float:
        """Get current usage for a budget"""
        
        # Calculate time window for budget type
        now = datetime.now(timezone.utc)
        
        if budget.budget_type == BudgetType.DAILY:
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif budget.budget_type == BudgetType.WEEKLY:
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif budget.budget_type == BudgetType.MONTHLY:
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            start_date = budget.start_date
        
        # Get cost summary for the period
        summary = await self.storage.get_cost_summary(
            user_id=budget.user_id,
            start_date=start_date,
            end_date=budget.end_date,
            category=budget.category
        )
        
        return summary["total_cost"]
    
    async def enforce_budget_action(self, budget: BudgetLimit, current_usage: float) -> List[str]:
        """Take enforcement actions for budget violations"""
        
        actions_taken = []
        utilization_pct = (current_usage / budget.limit_usd) * 100
        
        # Critical threshold actions
        if current_usage >= budget.critical_amount_usd:
            actions_taken.extend(await self._execute_critical_actions(budget))
        
        # Warning threshold actions
        elif current_usage >= budget.warning_amount_usd:
            actions_taken.extend(await self._execute_warning_actions(budget))
        
        return actions_taken
    
    async def _execute_warning_actions(self, budget: BudgetLimit) -> List[str]:
        """Execute warning-level enforcement actions"""
        
        actions = []
        
        # Send notification
        if "send_warning_notification" in self.enforcement_actions:
            await self.enforcement_actions["send_warning_notification"](budget)
            actions.append("warning_notification_sent")
        
        # Reduce model tier for new requests
        if "downgrade_model_tier" in self.enforcement_actions:
            await self.enforcement_actions["downgrade_model_tier"](budget)
            actions.append("model_tier_downgraded")
        
        return actions
    
    async def _execute_critical_actions(self, budget: BudgetLimit) -> List[str]:
        """Execute critical-level enforcement actions"""
        
        actions = []
        
        # Send critical notification
        if "send_critical_notification" in self.enforcement_actions:
            await self.enforcement_actions["send_critical_notification"](budget)
            actions.append("critical_notification_sent")
        
        # Block new expensive operations
        if "block_expensive_operations" in self.enforcement_actions:
            await self.enforcement_actions["block_expensive_operations"](budget)
            actions.append("expensive_operations_blocked")
        
        # Request human approval for further spending
        if "require_approval" in self.enforcement_actions:
            await self.enforcement_actions["require_approval"](budget)
            actions.append("approval_required")
        
        return actions


class CostMonitor:
    """Main cost monitoring system"""
    
    def __init__(self, storage: CostStorage, calculator: CostCalculator):
        self.storage = storage
        self.calculator = calculator
        self.enforcer = BudgetEnforcer(storage)
        
        # Monitoring state
        self.monitoring_active = False
        self.alert_callbacks: List[Callable] = []
        self.monitoring_task: Optional[asyncio.Task] = None
        
        # Performance metrics
        self.metrics = {
            "total_entries_processed": 0,
            "alerts_generated": 0,
            "enforcement_actions_taken": 0,
            "avg_processing_time_ms": 0.0
        }
    
    async def initialize(self):
        """Initialize the monitoring system"""
        
        await self.storage.initialize()
        
        # Register default enforcement actions
        self._register_default_enforcement_actions()
        
        logger.info("Cost monitoring system initialized")
    
    def _register_default_enforcement_actions(self):
        """Register default enforcement actions"""
        
        async def send_warning_notification(budget: BudgetLimit):
            logger.warning(f"Budget warning: {budget.name} approaching limit")
        
        async def send_critical_notification(budget: BudgetLimit):
            logger.critical(f"Budget critical: {budget.name} near/at limit")
        
        async def downgrade_model_tier(budget: BudgetLimit):
            logger.info(f"Downgrading model tier for budget: {budget.name}")
        
        async def block_expensive_operations(budget: BudgetLimit):
            logger.info(f"Blocking expensive operations for budget: {budget.name}")
        
        async def require_approval(budget: BudgetLimit):
            logger.info(f"Requiring approval for budget: {budget.name}")
        
        self.enforcer.register_enforcement_action("send_warning_notification", send_warning_notification)
        self.enforcer.register_enforcement_action("send_critical_notification", send_critical_notification)
        self.enforcer.register_enforcement_action("downgrade_model_tier", downgrade_model_tier)
        self.enforcer.register_enforcement_action("block_expensive_operations", block_expensive_operations)
        self.enforcer.register_enforcement_action("require_approval", require_approval)
    
    async def record_model_usage(
        self,
        model_id: str,
        input_tokens: int,
        output_tokens: int,
        user_id: str,
        task_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        agent_name: Optional[str] = None,
        **metadata
    ) -> CostEntry:
        """Record model usage and calculate cost"""
        
        start_time = time.time()
        
        # Calculate cost
        cost = self.calculator.calculate_model_cost(model_id, input_tokens, output_tokens)
        
        # Create cost entry
        entry = CostEntry(
            user_id=user_id,
            task_id=task_id,
            conversation_id=conversation_id,
            agent_name=agent_name,
            category=CostCategory.MODEL_INFERENCE,
            model_id=model_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            metadata=metadata
        )
        
        # Store entry
        await self.storage.store_cost_entry(entry)
        
        # Check budget compliance
        await self._check_and_alert(user_id, cost, entry.category, task_id)
        
        # Update metrics
        self.metrics["total_entries_processed"] += 1
        processing_time = (time.time() - start_time) * 1000
        self._update_avg_processing_time(processing_time)
        
        return entry
    
    async def record_tool_usage(
        self,
        tool_name: str,
        usage_count: int,
        user_id: str,
        task_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        agent_name: Optional[str] = None,
        **metadata
    ) -> CostEntry:
        """Record tool usage and calculate cost"""
        
        # Calculate cost
        cost = self.calculator.calculate_tool_cost(tool_name, usage_count)
        
        # Create cost entry
        entry = CostEntry(
            user_id=user_id,
            task_id=task_id,
            conversation_id=conversation_id,
            agent_name=agent_name,
            category=CostCategory.TOOL_EXECUTION,
            cost_usd=cost,
            metadata={**metadata, "tool_name": tool_name, "usage_count": usage_count}
        )
        
        # Store entry
        await self.storage.store_cost_entry(entry)
        
        # Check budget compliance
        await self._check_and_alert(user_id, cost, entry.category, task_id)
        
        return entry
    
    async def check_budget_before_action(
        self,
        user_id: str,
        estimated_cost: float,
        task_id: Optional[str] = None,
        category: Optional[CostCategory] = None
    ) -> Dict[str, Any]:
        """Check budget compliance before taking an action"""
        
        return await self.enforcer.check_budget_compliance(
            user_id, estimated_cost, task_id, category
        )
    
    async def create_budget(
        self,
        name: str,
        budget_type: BudgetType,
        limit_usd: float,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        category: Optional[CostCategory] = None,
        warning_threshold_pct: float = 0.8,
        critical_threshold_pct: float = 0.95
    ) -> BudgetLimit:
        """Create a new budget limit"""
        
        budget = BudgetLimit(
            name=name,
            budget_type=budget_type,
            limit_usd=limit_usd,
            user_id=user_id,
            project_id=project_id,
            category=category,
            warning_threshold_pct=warning_threshold_pct,
            critical_threshold_pct=critical_threshold_pct
        )
        
        await self.storage.store_budget_limit(budget)
        logger.info(f"Created budget: {name} (${limit_usd:.2f})")
        
        return budget
    
    async def get_cost_report(
        self,
        user_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Generate comprehensive cost report"""
        
        # Get basic cost summary
        summary = await self.storage.get_cost_summary(user_id, start_date, end_date)
        
        # Add additional insights
        report = {
            **summary,
            "insights": await self._generate_cost_insights(summary),
            "recommendations": await self._generate_cost_recommendations(summary),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "system_metrics": self.metrics
        }
        
        return report
    
    async def _check_and_alert(
        self,
        user_id: str,
        cost_incurred: float,
        category: CostCategory,
        task_id: Optional[str] = None
    ):
        """Check budgets and generate alerts if needed"""
        
        applicable_budgets = await self.enforcer._get_applicable_budgets(user_id, task_id, category)
        
        for budget in applicable_budgets:
            current_usage = await self.enforcer._get_current_usage(budget)
            utilization_pct = (current_usage / budget.limit_usd) * 100
            
            # Check if alerts are needed
            alert_needed = False
            severity = AlertSeverity.INFO
            
            if current_usage >= budget.limit_usd:
                alert_needed = True
                severity = AlertSeverity.EMERGENCY
            elif current_usage >= budget.critical_amount_usd:
                alert_needed = True
                severity = AlertSeverity.CRITICAL
            elif current_usage >= budget.warning_amount_usd:
                alert_needed = True
                severity = AlertSeverity.WARNING
            
            if alert_needed:
                alert = CostAlert(
                    severity=severity,
                    budget_id=budget.id,
                    message=f"Budget '{budget.name}' at {utilization_pct:.1f}% utilization",
                    current_cost_usd=current_usage,
                    budget_limit_usd=budget.limit_usd,
                    utilization_pct=utilization_pct,
                    context={"user_id": user_id, "task_id": task_id, "category": category.value}
                )
                
                # Take enforcement actions
                actions = await self.enforcer.enforce_budget_action(budget, current_usage)
                alert.actions_taken = actions
                
                # Store alert
                await self.storage.store_alert(alert)
                
                # Notify callbacks
                for callback in self.alert_callbacks:
                    try:
                        await callback(alert)
                    except Exception as e:
                        logger.error(f"Alert callback failed: {e}")
                
                self.metrics["alerts_generated"] += 1
                self.metrics["enforcement_actions_taken"] += len(actions)
    
    def register_alert_callback(self, callback: Callable[[CostAlert], None]):
        """Register a callback for cost alerts"""
        self.alert_callbacks.append(callback)
    
    async def _generate_cost_insights(self, summary: Dict[str, Any]) -> List[str]:
        """Generate insights from cost data"""
        
        insights = []
        
        # Top spending categories
        if summary["by_category"]:
            top_category = max(summary["by_category"].items(), key=lambda x: x[1]["cost"])
            insights.append(f"Highest spending category: {top_category[0]} (${top_category[1]['cost']:.4f})")
        
        # Cost per token analysis
        total_tokens = summary["total_input_tokens"] + summary["total_output_tokens"]
        if total_tokens > 0:
            cost_per_token = summary["total_cost"] / total_tokens
            insights.append(f"Average cost per token: ${cost_per_token:.6f}")
        
        # Model efficiency
        if summary["by_model"]:
            models = [(k, v["cost"] / v["entries"]) for k, v in summary["by_model"].items()]
            most_expensive_model = max(models, key=lambda x: x[1])
            insights.append(f"Most expensive model per request: {most_expensive_model[0]} (${most_expensive_model[1]:.4f})")
        
        return insights
    
    async def _generate_cost_recommendations(self, summary: Dict[str, Any]) -> List[str]:
        """Generate cost optimization recommendations"""
        
        recommendations = []
        
        # Model recommendations
        if summary["by_model"]:
            expensive_models = [k for k, v in summary["by_model"].items() if v["cost"] / v["entries"] > 0.01]
            if expensive_models:
                recommendations.append("Consider using lighter models for simple tasks to reduce costs")
        
        # Usage pattern recommendations
        if summary["total_cost"] > 1.0:
            recommendations.append("Consider implementing request batching to optimize costs")
            recommendations.append("Set up budget alerts to monitor spending")
        
        return recommendations
    
    def _update_avg_processing_time(self, processing_time_ms: float):
        """Update average processing time metric"""
        
        total_processed = self.metrics["total_entries_processed"]
        current_avg = self.metrics["avg_processing_time_ms"]
        
        new_avg = ((current_avg * (total_processed - 1)) + processing_time_ms) / total_processed
        self.metrics["avg_processing_time_ms"] = new_avg
    
    async def start_monitoring(self):
        """Start continuous cost monitoring"""
        
        if self.monitoring_active:
            logger.warning("Cost monitoring already active")
            return
        
        self.monitoring_active = True
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        logger.info("Cost monitoring started")
    
    async def stop_monitoring(self):
        """Stop cost monitoring"""
        
        self.monitoring_active = False
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Cost monitoring stopped")
    
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        
        while self.monitoring_active:
            try:
                # Periodic budget compliance checks
                budgets = await self.storage.get_active_budgets()
                
                for budget in budgets:
                    current_usage = await self.enforcer._get_current_usage(budget)
                    utilization_pct = (current_usage / budget.limit_usd) * 100
                    
                    # Check for threshold breaches
                    if utilization_pct >= 80:  # Warning threshold
                        logger.info(f"Budget {budget.name} at {utilization_pct:.1f}% utilization")
                
                # Sleep for monitoring interval
                await asyncio.sleep(60)  # Check every minute
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                await asyncio.sleep(10)  # Brief pause on error
    
    async def cleanup(self):
        """Cleanup resources"""
        
        await self.stop_monitoring()
        await self.storage.close()
        logger.info("Cost monitoring system cleaned up")


# Example usage and integration
async def example_cost_monitoring():
    """Example of cost monitoring usage"""
    
    # Initialize components
    storage = CostStorage(":memory:")  # Use in-memory SQLite for demo
    calculator = CostCalculator()
    monitor = CostMonitor(storage, calculator)
    
    await monitor.initialize()
    
    try:
        # Create a daily budget for a user
        await monitor.create_budget(
            name="Daily User Budget",
            budget_type=BudgetType.DAILY,
            limit_usd=10.0,
            user_id="demo_user"
        )
        
        # Record some model usage
        entry1 = await monitor.record_model_usage(
            model_id="gpt-5-mini",
            input_tokens=1000,
            output_tokens=500,
            user_id="demo_user",
            task_id="task_123",
            agent_name="retrieval_agent"
        )
        
        entry2 = await monitor.record_tool_usage(
            tool_name="code_interpreter",
            usage_count=3,
            user_id="demo_user",
            task_id="task_123",
            agent_name="code_agent"
        )
        
        # Check budget before a large operation
        compliance = await monitor.check_budget_before_action(
            user_id="demo_user",
            estimated_cost=0.50
        )
        
        print(f"Budget compliance: {compliance}")
        
        # Generate cost report
        report = await monitor.get_cost_report(user_id="demo_user")
        print(f"Cost report: {json.dumps(report, indent=2)}")
        
    finally:
        await monitor.cleanup()


if __name__ == "__main__":
    asyncio.run(example_cost_monitoring())