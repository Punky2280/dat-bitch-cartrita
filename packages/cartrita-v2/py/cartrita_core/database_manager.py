"""
Cartrita V2 - Database Manager
Production database operations for agent orchestration and performance tracking
"""

import asyncio
import json
import logging
import os
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any, Union, Tuple
from decimal import Decimal
import uuid
import hashlib

import asyncpg
from pathlib import Path


class DatabaseManager:
    """
    Production database manager for Cartrita V2 agent orchestration
    Handles all database operations with connection pooling and error handling
    """
    
    def __init__(
        self,
        connection_url: Optional[str] = None,
        pool_min_size: int = 5,
        pool_max_size: int = 20,
        logger: Optional[logging.Logger] = None
    ):
        self.connection_url = connection_url or self._get_connection_url()
        self.pool_min_size = pool_min_size
        self.pool_max_size = pool_max_size
        self.logger = logger or logging.getLogger("cartrita.database")
        
        # Connection pool
        self.pool: Optional[asyncpg.Pool] = None
        
        # Performance tracking
        self.query_stats = {
            "total_queries": 0,
            "successful_queries": 0,
            "failed_queries": 0,
            "total_execution_time": 0.0,
            "connection_errors": 0
        }
    
    def _get_connection_url(self) -> str:
        """Get database connection URL from environment"""
        # Try different environment variable names
        url = (
            os.getenv("DATABASE_URL") or 
            os.getenv("POSTGRES_URL") or
            os.getenv("CARTRITA_DB_URL")
        )
        
        if not url:
            # Build from individual components
            host = os.getenv("POSTGRES_HOST", "localhost")
            port = os.getenv("POSTGRES_PORT", "5432") 
            database = os.getenv("POSTGRES_DATABASE", "cartrita_v2")
            username = os.getenv("POSTGRES_USERNAME", "postgres")
            password = os.getenv("POSTGRES_PASSWORD", "")
            
            if password:
                url = f"postgresql://{username}:{password}@{host}:{port}/{database}"
            else:
                url = f"postgresql://{username}@{host}:{port}/{database}"
        
        return url
    
    async def initialize(self):
        """Initialize database connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                self.connection_url,
                min_size=self.pool_min_size,
                max_size=self.pool_max_size,
                command_timeout=30
            )
            
            # Test connection
            async with self.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            
            self.logger.info(f"Database pool initialized: {self.pool_min_size}-{self.pool_max_size} connections")
            
        except Exception as e:
            self.logger.error(f"Database initialization failed: {e}")
            raise
    
    async def close(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            self.logger.info("Database pool closed")
    
    async def health_check(self):
        """Check database health and connectivity"""
        if not self.pool:
            raise RuntimeError("Database pool not initialized")
        
        try:
            async with self.pool.acquire() as conn:
                result = await conn.fetchval("SELECT 1")
                if result != 1:
                    raise RuntimeError("Database health check failed")
            self.logger.info("Database health check passed")
        except Exception as e:
            self.logger.error(f"Database health check failed: {e}")
            raise
    
    async def execute_query(
        self,
        query: str,
        *args,
        fetch: str = "none"  # "none", "one", "all", "val"
    ) -> Any:
        """Execute database query with error handling"""
        if not self.pool:
            raise RuntimeError("Database not initialized")
        
        start_time = asyncio.get_event_loop().time()
        self.query_stats["total_queries"] += 1
        
        try:
            async with self.pool.acquire() as conn:
                if fetch == "one":
                    result = await conn.fetchrow(query, *args)
                elif fetch == "all":
                    result = await conn.fetch(query, *args)
                elif fetch == "val":
                    result = await conn.fetchval(query, *args)
                else:  # "none"
                    result = await conn.execute(query, *args)
                
                execution_time = asyncio.get_event_loop().time() - start_time
                self.query_stats["successful_queries"] += 1
                self.query_stats["total_execution_time"] += execution_time
                
                return result
                
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            self.query_stats["failed_queries"] += 1
            self.query_stats["total_execution_time"] += execution_time
            
            self.logger.error(f"Query failed: {str(e)[:200]}...")
            raise
    
    # Conversation Session Operations
    
    async def create_conversation_session(
        self,
        session_id: str,
        user_id: str,
        context_summary: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a new conversation session"""
        query = """
        INSERT INTO conversation_sessions (session_id, user_id, context_summary, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """
        
        result = await self.execute_query(
            query, session_id, user_id, context_summary, 
            json.dumps(metadata or {}), fetch="val"
        )
        
        self.logger.debug(f"Created conversation session: {session_id}")
        return str(result)
    
    async def update_conversation_session(
        self,
        session_id: str,
        context_summary: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        increment_messages: bool = False,
        add_tokens: int = 0,
        add_cost: Decimal = Decimal('0.00')
    ) -> bool:
        """Update conversation session with new activity"""
        query = """
        UPDATE conversation_sessions SET
            last_activity = NOW(),
            context_summary = COALESCE($2, context_summary),
            metadata = COALESCE($3::jsonb, metadata),
            total_messages = CASE WHEN $4 THEN total_messages + 1 ELSE total_messages END,
            total_tokens_used = total_tokens_used + $5,
            total_cost_usd = total_cost_usd + $6
        WHERE session_id = $1
        """
        
        result = await self.execute_query(
            query, session_id, context_summary, 
            json.dumps(metadata) if metadata else None,
            increment_messages, add_tokens, add_cost
        )
        
        return "UPDATE 1" in str(result)
    
    async def get_conversation_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get conversation session details"""
        query = """
        SELECT * FROM conversation_sessions 
        WHERE session_id = $1 AND is_active = true
        """
        
        result = await self.execute_query(query, session_id, fetch="one")
        
        if result:
            return {
                "id": str(result["id"]),
                "session_id": result["session_id"],
                "user_id": result["user_id"],
                "created_at": result["created_at"].isoformat(),
                "updated_at": result["updated_at"].isoformat(),
                "last_activity": result["last_activity"].isoformat(),
                "context_summary": result["context_summary"],
                "metadata": result["metadata"],
                "total_messages": result["total_messages"],
                "total_tokens_used": result["total_tokens_used"],
                "total_cost_usd": float(result["total_cost_usd"])
            }
        return None
    
    # Agent Instance Operations
    
    async def register_agent_instance(
        self,
        agent_id: str,
        agent_type: str,
        name: str,
        description: str,
        model_config: Dict[str, Any],
        capabilities: List[str],
        tools_allowed: List[str],
        prompt_id: Optional[str] = None,
        prompt_version: Optional[str] = None
    ) -> bool:
        """Register a new agent instance"""
        query = """
        INSERT INTO agent_instances (
            agent_id, agent_type, name, description, 
            model_config, capabilities, tools_allowed,
            prompt_id, prompt_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (agent_id) DO UPDATE SET
            agent_type = EXCLUDED.agent_type,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            model_config = EXCLUDED.model_config,
            capabilities = EXCLUDED.capabilities,
            tools_allowed = EXCLUDED.tools_allowed,
            prompt_id = EXCLUDED.prompt_id,
            prompt_version = EXCLUDED.prompt_version,
            updated_at = NOW()
        """
        
        await self.execute_query(
            query, agent_id, agent_type, name, description,
            json.dumps(model_config), json.dumps(capabilities), 
            json.dumps(tools_allowed), prompt_id, prompt_version
        )
        
        self.logger.info(f"Registered agent instance: {agent_id}")
        return True
    
    async def update_agent_last_used(self, agent_id: str) -> bool:
        """Update agent's last used timestamp"""
        query = "UPDATE agent_instances SET last_used = NOW() WHERE agent_id = $1"
        result = await self.execute_query(query, agent_id)
        return "UPDATE 1" in str(result)
    
    async def get_active_agents(self) -> List[Dict[str, Any]]:
        """Get all active agents"""
        query = "SELECT * FROM v_active_agents ORDER BY total_tasks_24h DESC"
        results = await self.execute_query(query, fetch="all")
        
        return [
            {
                "agent_id": row["agent_id"],
                "agent_type": row["agent_type"],
                "name": row["name"],
                "status": row["status"],
                "last_used": row["last_used"].isoformat() if row["last_used"] else None,
                "total_tasks_24h": row["total_tasks_24h"] or 0,
                "avg_execution_time_ms": float(row["avg_execution_time_ms"]) if row["avg_execution_time_ms"] else 0,
                "total_cost_24h_usd": float(row["total_cost_24h_usd"]) if row["total_cost_24h_usd"] else 0
            }
            for row in results
        ]
    
    # Task Execution Operations
    
    async def create_task_execution(
        self,
        task_id: str,
        session_id: Optional[str],
        user_id: str,
        orchestrator_agent_id: str,
        task_description: str,
        task_classification: Dict[str, Any],
        routing_decision: Dict[str, Any],
        priority: str = "medium",
        parent_task_id: Optional[str] = None
    ) -> str:
        """Create a new task execution record"""
        
        # Get session UUID if session_id provided
        session_uuid = None
        if session_id:
            session_uuid = await self.execute_query(
                "SELECT id FROM conversation_sessions WHERE session_id = $1",
                session_id, fetch="val"
            )
        
        parent_uuid = None
        if parent_task_id:
            parent_uuid = await self.execute_query(
                "SELECT id FROM task_executions WHERE task_id = $1",
                parent_task_id, fetch="val"
            )
        
        query = """
        INSERT INTO task_executions (
            task_id, session_id, user_id, orchestrator_agent_id,
            task_description, task_classification, routing_decision,
            priority, parent_task_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
        RETURNING id
        """
        
        result = await self.execute_query(
            query, task_id, session_uuid, user_id, orchestrator_agent_id,
            task_description, json.dumps(task_classification), 
            json.dumps(routing_decision), priority, parent_uuid, fetch="val"
        )
        
        return str(result)
    
    async def update_task_execution_status(
        self,
        task_id: str,
        status: str,
        assigned_agent_id: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cost_usd: Decimal = Decimal('0.00'),
        result_content: Optional[str] = None,
        result_metadata: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
        error_details: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Update task execution with results"""
        
        # Build dynamic UPDATE query based on provided parameters
        updates = ["status = $2"]
        params = [task_id, status]
        param_count = 2
        
        if assigned_agent_id:
            param_count += 1
            updates.append(f"assigned_agent_id = ${param_count}")
            params.append(assigned_agent_id)
        
        if execution_time_ms is not None:
            param_count += 1
            updates.append(f"execution_time_ms = ${param_count}")
            params.append(execution_time_ms)
            
            param_count += 1
            updates.append(f"completed_at = NOW()")
        
        if input_tokens > 0:
            param_count += 1
            updates.append(f"input_tokens = ${param_count}")
            params.append(input_tokens)
        
        if output_tokens > 0:
            param_count += 1
            updates.append(f"output_tokens = ${param_count}")
            params.append(output_tokens)
        
        if cost_usd > 0:
            param_count += 1
            updates.append(f"cost_usd = ${param_count}")
            params.append(cost_usd)
        
        if result_content:
            param_count += 1
            updates.append(f"result_content = ${param_count}")
            params.append(result_content)
        
        if result_metadata:
            param_count += 1
            updates.append(f"result_metadata = ${param_count}")
            params.append(json.dumps(result_metadata))
        
        if error_message:
            param_count += 1
            updates.append(f"error_message = ${param_count}")
            params.append(error_message)
        
        if error_details:
            param_count += 1
            updates.append(f"error_details = ${param_count}")
            params.append(json.dumps(error_details))
        
        query = f"""
        UPDATE task_executions SET
            {', '.join(updates)},
            updated_at = NOW()
        WHERE task_id = $1
        """
        
        result = await self.execute_query(query, *params)
        return "UPDATE 1" in str(result)
    
    async def get_task_execution(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task execution details"""
        query = """
        SELECT te.*, cs.session_id as session_identifier
        FROM task_executions te
        LEFT JOIN conversation_sessions cs ON te.session_id = cs.id
        WHERE te.task_id = $1
        """
        
        result = await self.execute_query(query, task_id, fetch="one")
        
        if result:
            return {
                "id": str(result["id"]),
                "task_id": result["task_id"],
                "session_id": result["session_identifier"],
                "user_id": result["user_id"],
                "orchestrator_agent_id": result["orchestrator_agent_id"],
                "assigned_agent_id": result["assigned_agent_id"],
                "task_description": result["task_description"],
                "task_classification": result["task_classification"],
                "routing_decision": result["routing_decision"],
                "status": result["status"],
                "priority": result["priority"],
                "started_at": result["started_at"].isoformat(),
                "completed_at": result["completed_at"].isoformat() if result["completed_at"] else None,
                "execution_time_ms": result["execution_time_ms"],
                "input_tokens": result["input_tokens"],
                "output_tokens": result["output_tokens"],
                "cost_usd": float(result["cost_usd"]),
                "result_content": result["result_content"],
                "result_metadata": result["result_metadata"],
                "error_message": result["error_message"],
                "error_details": result["error_details"],
                "retry_count": result["retry_count"]
            }
        return None
    
    # Tool Execution Logging
    
    async def log_tool_execution(
        self,
        execution_id: str,
        task_id: str,
        agent_id: str,
        tool_name: str,
        tool_category: str,
        security_level: str,
        arguments_hash: str,
        success: bool,
        execution_time_ms: int = 0,
        result_size_bytes: int = 0,
        error_type: Optional[str] = None,
        error_message: Optional[str] = None,
        permission_granted: bool = True
    ) -> bool:
        """Log a tool execution"""
        
        # Get task UUID
        task_uuid = await self.execute_query(
            "SELECT id FROM task_executions WHERE task_id = $1",
            task_id, fetch="val"
        )
        
        query = """
        INSERT INTO tool_executions (
            execution_id, task_id, agent_id, tool_name, tool_category,
            security_level, arguments_hash, success, execution_time_ms,
            result_size_bytes, error_type, error_message, permission_granted
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        """
        
        await self.execute_query(
            query, execution_id, task_uuid, agent_id, tool_name, tool_category,
            security_level, arguments_hash, success, execution_time_ms,
            result_size_bytes, error_type, error_message, permission_granted
        )
        
        return True
    
    # Vector Store Management
    
    async def register_vector_store(
        self,
        vector_store_id: str,
        name: str,
        description: str,
        created_by: str,
        store_config: Dict[str, Any],
        expires_at: Optional[datetime] = None
    ) -> bool:
        """Register a new vector store"""
        query = """
        INSERT INTO vector_store_sessions (
            vector_store_id, name, description, created_by, store_config, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (vector_store_id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            store_config = EXCLUDED.store_config,
            updated_at = NOW()
        """
        
        await self.execute_query(
            query, vector_store_id, name, description, created_by,
            json.dumps(store_config), expires_at
        )
        
        return True
    
    async def log_file_upload(
        self,
        file_id: str,
        original_filename: str,
        size_bytes: int,
        mime_type: str,
        upload_hash: str,
        vector_store_ids: List[str],
        uploaded_by: str,
        processing_status: str = "uploading",
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Log a file upload"""
        query = """
        INSERT INTO file_uploads (
            file_id, original_filename, size_bytes, mime_type, upload_hash,
            vector_store_ids, uploaded_by, processing_status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (file_id) DO UPDATE SET
            vector_store_ids = EXCLUDED.vector_store_ids,
            processing_status = EXCLUDED.processing_status,
            metadata = EXCLUDED.metadata
        """
        
        await self.execute_query(
            query, file_id, original_filename, size_bytes, mime_type, upload_hash,
            json.dumps(vector_store_ids), uploaded_by, processing_status,
            json.dumps(metadata or {})
        )
        
        return True
    
    async def log_search_query(
        self,
        query_id: str,
        session_id: Optional[str],
        task_id: str,
        agent_id: str,
        query_text: str,
        vector_store_ids: List[str],
        max_results: int,
        result_count: int,
        execution_time_ms: int,
        cost_estimate_usd: Decimal,
        results_summary: Dict[str, Any],
        success: bool = True,
        error_message: Optional[str] = None
    ) -> bool:
        """Log a vector search query"""
        
        # Get UUIDs for foreign keys
        session_uuid = None
        if session_id:
            session_uuid = await self.execute_query(
                "SELECT id FROM conversation_sessions WHERE session_id = $1",
                session_id, fetch="val"
            )
        
        task_uuid = await self.execute_query(
            "SELECT id FROM task_executions WHERE task_id = $1",
            task_id, fetch="val"
        )
        
        # Generate embedding hash for similarity detection (simplified)
        query_embedding_hash = hashlib.md5(query_text.encode()).hexdigest()
        
        query = """
        INSERT INTO search_queries (
            query_id, session_id, task_id, agent_id, query_text,
            query_embedding_hash, vector_store_ids, max_results,
            result_count, execution_time_ms, cost_estimate_usd,
            results_summary, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        """
        
        await self.execute_query(
            query, query_id, session_uuid, task_uuid, agent_id, query_text,
            query_embedding_hash, json.dumps(vector_store_ids), max_results,
            result_count, execution_time_ms, cost_estimate_usd,
            json.dumps(results_summary), success, error_message
        )
        
        return True
    
    # Performance Analytics
    
    async def get_performance_dashboard(self, days: int = 7) -> Dict[str, Any]:
        """Get performance dashboard data"""
        query = """
        SELECT * FROM v_performance_dashboard 
        WHERE date >= CURRENT_DATE - INTERVAL '%s days'
        ORDER BY date DESC
        LIMIT %s
        """ % (days, days)
        
        results = await self.execute_query(query, fetch="all")
        
        dashboard_data = []
        for row in results:
            dashboard_data.append({
                "date": row["date"].isoformat(),
                "total_tasks": row["total_tasks"],
                "completed_tasks": row["completed_tasks"],
                "failed_tasks": row["failed_tasks"],
                "success_rate": (row["completed_tasks"] / max(1, row["total_tasks"])) * 100,
                "avg_execution_time_ms": float(row["avg_execution_time_ms"]) if row["avg_execution_time_ms"] else 0,
                "p95_execution_time_ms": row["p95_execution_time_ms"] or 0,
                "total_cost_usd": float(row["total_cost_usd"]),
                "avg_cost_per_task_usd": float(row["avg_cost_per_task_usd"]) if row["avg_cost_per_task_usd"] else 0,
                "total_input_tokens": row["total_input_tokens"],
                "total_output_tokens": row["total_output_tokens"]
            })
        
        return {"dashboard_data": dashboard_data}
    
    async def get_tool_usage_summary(self, days: int = 7) -> List[Dict[str, Any]]:
        """Get tool usage summary"""
        query = "SELECT * FROM v_tool_usage_summary"
        results = await self.execute_query(query, fetch="all")
        
        return [
            {
                "tool_name": row["tool_name"],
                "tool_category": row["tool_category"],
                "security_level": row["security_level"],
                "execution_count": row["execution_count"],
                "successful_executions": row["successful_executions"],
                "failed_executions": row["failed_executions"],
                "success_rate": (row["successful_executions"] / max(1, row["execution_count"])) * 100,
                "avg_execution_time_ms": float(row["avg_execution_time_ms"]) if row["avg_execution_time_ms"] else 0,
                "agents_using_tool": row["agents_using_tool"]
            }
            for row in results
        ]
    
    # System Events
    
    async def log_system_event(
        self,
        event_id: str,
        event_type: str,
        event_source: str,
        actor_id: Optional[str] = None,
        target_resource: Optional[str] = None,
        event_data: Optional[Dict[str, Any]] = None,
        severity: str = "info",
        message: Optional[str] = None,
        correlation_id: Optional[str] = None
    ) -> bool:
        """Log a system event"""
        query = """
        INSERT INTO system_events (
            event_id, event_type, event_source, actor_id, target_resource,
            event_data, severity, message, correlation_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """
        
        await self.execute_query(
            query, event_id, event_type, event_source, actor_id, target_resource,
            json.dumps(event_data or {}), severity, message, correlation_id
        )
        
        return True
    
    # Statistics and Health
    
    async def get_database_health(self) -> Dict[str, Any]:
        """Get database health statistics"""
        
        # Connection pool stats
        pool_stats = {
            "pool_size": self.pool.get_size() if self.pool else 0,
            "pool_min_size": self.pool_min_size,
            "pool_max_size": self.pool_max_size,
        }
        
        # Query performance stats
        avg_query_time = 0
        if self.query_stats["total_queries"] > 0:
            avg_query_time = self.query_stats["total_execution_time"] / self.query_stats["total_queries"]
        
        performance_stats = {
            **self.query_stats,
            "avg_query_time": avg_query_time,
            "success_rate": (
                self.query_stats["successful_queries"] / max(1, self.query_stats["total_queries"])
            ) * 100
        }
        
        # Database size and table counts
        try:
            table_counts = await self.execute_query("""
                SELECT 
                    'conversation_sessions' as table_name,
                    COUNT(*) as row_count
                FROM conversation_sessions
                UNION ALL
                SELECT 'agent_instances', COUNT(*) FROM agent_instances
                UNION ALL  
                SELECT 'task_executions', COUNT(*) FROM task_executions
                UNION ALL
                SELECT 'tool_executions', COUNT(*) FROM tool_executions
                UNION ALL
                SELECT 'vector_store_sessions', COUNT(*) FROM vector_store_sessions
                UNION ALL
                SELECT 'file_uploads', COUNT(*) FROM file_uploads
                UNION ALL
                SELECT 'search_queries', COUNT(*) FROM search_queries
                UNION ALL
                SELECT 'system_events', COUNT(*) FROM system_events
            """, fetch="all")
            
            table_stats = {row["table_name"]: row["row_count"] for row in table_counts}
            
        except Exception as e:
            self.logger.error(f"Error getting table counts: {e}")
            table_stats = {}
        
        return {
            "connection_pool": pool_stats,
            "query_performance": performance_stats,
            "table_counts": table_stats,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get database manager statistics"""
        return {
            "connection_url_configured": bool(self.connection_url),
            "pool_initialized": self.pool is not None,
            "query_stats": self.query_stats
        }


# Global database manager instance
_database_manager: Optional[DatabaseManager] = None


def get_database_manager() -> DatabaseManager:
    """Get global database manager instance"""
    global _database_manager
    if _database_manager is None:
        _database_manager = DatabaseManager()
    return _database_manager


async def initialize_database_manager(
    connection_url: Optional[str] = None,
    logger: Optional[logging.Logger] = None,
    **kwargs
) -> DatabaseManager:
    """Initialize global database manager"""
    global _database_manager
    _database_manager = DatabaseManager(connection_url=connection_url, logger=logger, **kwargs)
    await _database_manager.initialize()
    return _database_manager