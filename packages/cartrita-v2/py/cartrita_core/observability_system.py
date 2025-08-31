#!/usr/bin/env python3
"""
Cartrita V2 - Advanced Observability and Metrics Collection System
Real-time monitoring, performance analytics, and distributed tracing
"""

import asyncio
import json
import time
import traceback
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import sqlite3
from contextlib import asynccontextmanager
import threading
from collections import defaultdict, deque
import statistics

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

try:
    import structlog
    STRUCTLOG_AVAILABLE = True
except ImportError:
    STRUCTLOG_AVAILABLE = False

try:
    from prometheus_client import Counter, Histogram, Gauge, start_http_server
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False


class MetricType(Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"


class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class MetricPoint:
    name: str
    value: float
    timestamp: float
    labels: Dict[str, str]
    metric_type: MetricType


@dataclass
class TraceSpan:
    span_id: str
    trace_id: str
    operation_name: str
    start_time: float
    end_time: Optional[float]
    duration: Optional[float]
    tags: Dict[str, Any]
    logs: List[Dict[str, Any]]
    parent_span_id: Optional[str]
    status: str = "active"


@dataclass
class Alert:
    id: str
    level: AlertLevel
    message: str
    timestamp: float
    component: str
    tags: Dict[str, Any]
    resolved: bool = False
    resolution_time: Optional[float] = None


class MetricsBuffer:
    """Thread-safe circular buffer for metrics"""
    
    def __init__(self, max_size: int = 10000):
        self.buffer = deque(maxlen=max_size)
        self.lock = threading.RLock()
        
    def add(self, metric: MetricPoint):
        with self.lock:
            self.buffer.append(metric)
            
    def get_recent(self, seconds: int = 300) -> List[MetricPoint]:
        cutoff = time.time() - seconds
        with self.lock:
            return [m for m in self.buffer if m.timestamp >= cutoff]
            
    def get_by_name(self, name: str, seconds: int = 300) -> List[MetricPoint]:
        recent = self.get_recent(seconds)
        return [m for m in recent if m.name == name]


class ObservabilitySystem:
    """
    Comprehensive observability system with metrics, tracing, and alerting
    """
    
    def __init__(self, 
                 redis_url: str = "redis://localhost:6379",
                 sqlite_path: str = "observability.db",
                 prometheus_port: int = 8090):
        self.redis_url = redis_url
        self.sqlite_path = sqlite_path
        self.prometheus_port = prometheus_port
        
        # Storage backends
        self.redis_client = None
        self.sqlite_conn = None
        
        # In-memory structures
        self.metrics_buffer = MetricsBuffer()
        self.active_traces = {}
        self.active_spans = {}
        self.alerts = {}
        
        # Prometheus metrics
        self.prometheus_metrics = {}
        
        # Configuration
        self.alert_rules = []
        self.sampling_rate = 1.0
        
        # Logger
        if STRUCTLOG_AVAILABLE:
            self.logger = structlog.get_logger("observability")
        else:
            import logging
            self.logger = logging.getLogger("observability")
            
        # Background tasks
        self.background_tasks = []
        self.shutdown_event = asyncio.Event()
        
    async def initialize(self):
        """Initialize all storage backends and start background tasks"""
        await self._init_redis()
        await self._init_sqlite()
        await self._init_prometheus()
        await self._start_background_tasks()
        
    async def _init_redis(self):
        """Initialize Redis connection"""
        if REDIS_AVAILABLE:
            try:
                self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
                await asyncio.to_thread(self.redis_client.ping)
                self.logger.info("Redis connection established")
            except Exception as e:
                self.logger.warning(f"Redis unavailable, using in-memory storage: {e}")
                self.redis_client = None
                
    async def _init_sqlite(self):
        """Initialize SQLite database"""
        try:
            self.sqlite_conn = sqlite3.connect(self.sqlite_path, check_same_thread=False)
            await self._create_tables()
            self.logger.info("SQLite database initialized")
        except Exception as e:
            self.logger.error(f"Failed to initialize SQLite: {e}")
            
    async def _create_tables(self):
        """Create necessary database tables"""
        tables = [
            """CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                value REAL NOT NULL,
                timestamp REAL NOT NULL,
                labels TEXT,
                metric_type TEXT
            )""",
            
            """CREATE TABLE IF NOT EXISTS traces (
                trace_id TEXT PRIMARY KEY,
                operation_name TEXT NOT NULL,
                start_time REAL NOT NULL,
                end_time REAL,
                duration REAL,
                status TEXT,
                tags TEXT
            )""",
            
            """CREATE TABLE IF NOT EXISTS spans (
                span_id TEXT PRIMARY KEY,
                trace_id TEXT NOT NULL,
                operation_name TEXT NOT NULL,
                start_time REAL NOT NULL,
                end_time REAL,
                duration REAL,
                parent_span_id TEXT,
                tags TEXT,
                logs TEXT,
                status TEXT,
                FOREIGN KEY (trace_id) REFERENCES traces (trace_id)
            )""",
            
            """CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp REAL NOT NULL,
                component TEXT,
                tags TEXT,
                resolved BOOLEAN DEFAULT FALSE,
                resolution_time REAL
            )"""
        ]
        
        cursor = self.sqlite_conn.cursor()
        for table_sql in tables:
            await asyncio.to_thread(cursor.execute, table_sql)
        await asyncio.to_thread(self.sqlite_conn.commit)
        
    async def _init_prometheus(self):
        """Initialize Prometheus metrics"""
        if PROMETHEUS_AVAILABLE:
            try:
                # Start Prometheus HTTP server
                await asyncio.to_thread(start_http_server, self.prometheus_port)
                
                # Initialize common metrics
                self.prometheus_metrics = {
                    'requests_total': Counter(
                        'cartrita_requests_total', 
                        'Total requests', 
                        ['agent', 'operation', 'status']
                    ),
                    'request_duration': Histogram(
                        'cartrita_request_duration_seconds',
                        'Request duration',
                        ['agent', 'operation']
                    ),
                    'active_sessions': Gauge(
                        'cartrita_active_sessions',
                        'Currently active sessions'
                    ),
                    'cost_total': Counter(
                        'cartrita_cost_total',
                        'Total cost in cents',
                        ['model', 'operation']
                    ),
                    'tokens_total': Counter(
                        'cartrita_tokens_total',
                        'Total tokens processed',
                        ['model', 'type']
                    )
                }
                
                self.logger.info(f"Prometheus metrics server started on port {self.prometheus_port}")
            except Exception as e:
                self.logger.warning(f"Failed to start Prometheus server: {e}")
                
    async def _start_background_tasks(self):
        """Start background processing tasks"""
        tasks = [
            self._metrics_aggregation_task(),
            self._alert_evaluation_task(),
            self._cleanup_task()
        ]
        
        for task in tasks:
            self.background_tasks.append(asyncio.create_task(task))
            
    # Metrics Collection
    def record_metric(self, name: str, value: float, labels: Dict[str, str] = None, 
                     metric_type: MetricType = MetricType.GAUGE):
        """Record a metric point"""
        metric = MetricPoint(
            name=name,
            value=value,
            timestamp=time.time(),
            labels=labels or {},
            metric_type=metric_type
        )
        
        # Add to buffer
        self.metrics_buffer.add(metric)
        
        # Update Prometheus if available
        if PROMETHEUS_AVAILABLE and name in self.prometheus_metrics:
            prom_metric = self.prometheus_metrics[name]
            label_values = [labels.get(key, 'unknown') for key in prom_metric._labelnames]
            
            if metric_type == MetricType.COUNTER:
                prom_metric.labels(*label_values).inc(value)
            elif metric_type == MetricType.GAUGE:
                prom_metric.set(value)
            elif metric_type == MetricType.HISTOGRAM:
                prom_metric.labels(*label_values).observe(value)
                
    def increment_counter(self, name: str, labels: Dict[str, str] = None, amount: float = 1.0):
        """Increment a counter metric"""
        self.record_metric(name, amount, labels, MetricType.COUNTER)
        
    def set_gauge(self, name: str, value: float, labels: Dict[str, str] = None):
        """Set a gauge metric"""
        self.record_metric(name, value, labels, MetricType.GAUGE)
        
    def record_timing(self, name: str, duration: float, labels: Dict[str, str] = None):
        """Record timing information"""
        self.record_metric(name, duration, labels, MetricType.HISTOGRAM)
        
    @asynccontextmanager
    async def timer(self, name: str, labels: Dict[str, str] = None):
        """Context manager for timing operations"""
        start_time = time.time()
        try:
            yield
        finally:
            duration = time.time() - start_time
            self.record_timing(name, duration, labels)
            
    # Distributed Tracing
    def start_trace(self, operation_name: str, trace_id: str = None) -> str:
        """Start a new distributed trace"""
        if trace_id is None:
            trace_id = f"trace_{int(time.time() * 1000000)}"
            
        span_id = f"span_{int(time.time() * 1000000)}"
        
        span = TraceSpan(
            span_id=span_id,
            trace_id=trace_id,
            operation_name=operation_name,
            start_time=time.time(),
            end_time=None,
            duration=None,
            tags={},
            logs=[],
            parent_span_id=None
        )
        
        self.active_traces[trace_id] = span
        self.active_spans[span_id] = span
        
        return trace_id
        
    def start_span(self, operation_name: str, trace_id: str, parent_span_id: str = None) -> str:
        """Start a new span within a trace"""
        span_id = f"span_{int(time.time() * 1000000)}"
        
        span = TraceSpan(
            span_id=span_id,
            trace_id=trace_id,
            operation_name=operation_name,
            start_time=time.time(),
            end_time=None,
            duration=None,
            tags={},
            logs=[],
            parent_span_id=parent_span_id
        )
        
        self.active_spans[span_id] = span
        
        return span_id
        
    def finish_span(self, span_id: str, tags: Dict[str, Any] = None, status: str = "success"):
        """Finish a span"""
        if span_id in self.active_spans:
            span = self.active_spans[span_id]
            span.end_time = time.time()
            span.duration = span.end_time - span.start_time
            span.status = status
            
            if tags:
                span.tags.update(tags)
                
            # Store span asynchronously
            asyncio.create_task(self._store_span(span))
            
            # Remove from active spans
            del self.active_spans[span_id]
            
    def add_span_log(self, span_id: str, message: str, level: str = "info", **kwargs):
        """Add a log entry to a span"""
        if span_id in self.active_spans:
            log_entry = {
                "timestamp": time.time(),
                "level": level,
                "message": message,
                **kwargs
            }
            self.active_spans[span_id].logs.append(log_entry)
            
    @asynccontextmanager
    async def trace_span(self, operation_name: str, trace_id: str = None, parent_span_id: str = None):
        """Context manager for tracing operations"""
        if trace_id is None:
            trace_id = self.start_trace(operation_name)
            span_id = list(self.active_spans.keys())[-1]  # Get the span created by start_trace
        else:
            span_id = self.start_span(operation_name, trace_id, parent_span_id)
            
        try:
            yield span_id
        except Exception as e:
            self.add_span_log(span_id, f"Error: {str(e)}", "error")
            self.finish_span(span_id, {"error": True, "error_message": str(e)}, "error")
            raise
        else:
            self.finish_span(span_id)
            
    # Alerting System
    def add_alert_rule(self, name: str, condition: str, level: AlertLevel, message: str):
        """Add an alert rule"""
        rule = {
            "name": name,
            "condition": condition,
            "level": level,
            "message": message,
            "last_triggered": 0
        }
        self.alert_rules.append(rule)
        
    def trigger_alert(self, component: str, level: AlertLevel, message: str, tags: Dict[str, Any] = None):
        """Manually trigger an alert"""
        alert_id = f"alert_{int(time.time() * 1000000)}"
        
        alert = Alert(
            id=alert_id,
            level=level,
            message=message,
            timestamp=time.time(),
            component=component,
            tags=tags or {}
        )
        
        self.alerts[alert_id] = alert
        
        # Store alert
        asyncio.create_task(self._store_alert(alert))
        
        self.logger.warning(f"Alert triggered: {message}", extra={
            "alert_id": alert_id,
            "level": level.value,
            "component": component
        })
        
    def resolve_alert(self, alert_id: str):
        """Resolve an alert"""
        if alert_id in self.alerts:
            self.alerts[alert_id].resolved = True
            self.alerts[alert_id].resolution_time = time.time()
            
    # Query Interface
    async def get_metrics(self, name: str, start_time: float = None, end_time: float = None) -> List[MetricPoint]:
        """Query metrics by name and time range"""
        if start_time is None:
            start_time = time.time() - 3600  # Last hour
        if end_time is None:
            end_time = time.time()
            
        # Try in-memory buffer first
        buffer_metrics = self.metrics_buffer.get_by_name(name)
        filtered = [m for m in buffer_metrics if start_time <= m.timestamp <= end_time]
        
        if filtered:
            return filtered
            
        # Fall back to SQLite
        if self.sqlite_conn:
            try:
                cursor = self.sqlite_conn.cursor()
                cursor.execute(
                    "SELECT name, value, timestamp, labels, metric_type FROM metrics "
                    "WHERE name = ? AND timestamp BETWEEN ? AND ?",
                    (name, start_time, end_time)
                )
                
                results = []
                for row in cursor.fetchall():
                    results.append(MetricPoint(
                        name=row[0],
                        value=row[1],
                        timestamp=row[2],
                        labels=json.loads(row[3]) if row[3] else {},
                        metric_type=MetricType(row[4])
                    ))
                return results
            except Exception as e:
                self.logger.error(f"Failed to query metrics: {e}")
                
        return []
        
    async def get_trace(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """Get a complete trace with all spans"""
        if self.sqlite_conn:
            try:
                cursor = self.sqlite_conn.cursor()
                
                # Get trace info
                cursor.execute("SELECT * FROM traces WHERE trace_id = ?", (trace_id,))
                trace_row = cursor.fetchone()
                
                if not trace_row:
                    return None
                    
                # Get all spans for this trace
                cursor.execute("SELECT * FROM spans WHERE trace_id = ?", (trace_id,))
                span_rows = cursor.fetchall()
                
                spans = []
                for row in span_rows:
                    spans.append({
                        "span_id": row[0],
                        "trace_id": row[1],
                        "operation_name": row[2],
                        "start_time": row[3],
                        "end_time": row[4],
                        "duration": row[5],
                        "parent_span_id": row[6],
                        "tags": json.loads(row[7]) if row[7] else {},
                        "logs": json.loads(row[8]) if row[8] else [],
                        "status": row[9]
                    })
                    
                return {
                    "trace_id": trace_row[0],
                    "operation_name": trace_row[1],
                    "start_time": trace_row[2],
                    "end_time": trace_row[3],
                    "duration": trace_row[4],
                    "status": trace_row[5],
                    "tags": json.loads(trace_row[6]) if trace_row[6] else {},
                    "spans": spans
                }
            except Exception as e:
                self.logger.error(f"Failed to get trace: {e}")
                
        return None
        
    async def get_active_alerts(self) -> List[Alert]:
        """Get all active (unresolved) alerts"""
        return [alert for alert in self.alerts.values() if not alert.resolved]
        
    # Analytics
    def get_performance_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get performance summary for the specified time period"""
        cutoff = time.time() - (hours * 3600)
        recent_metrics = self.metrics_buffer.get_recent(hours * 3600)
        
        # Group by metric name
        grouped = defaultdict(list)
        for metric in recent_metrics:
            grouped[metric.name].append(metric.value)
            
        summary = {}
        for name, values in grouped.items():
            if values:
                summary[name] = {
                    "count": len(values),
                    "min": min(values),
                    "max": max(values),
                    "mean": statistics.mean(values),
                    "median": statistics.median(values)
                }
                
                if len(values) > 1:
                    summary[name]["stddev"] = statistics.stdev(values)
                    
        return summary
        
    # Background Tasks
    async def _metrics_aggregation_task(self):
        """Background task for metrics aggregation"""
        while not self.shutdown_event.is_set():
            try:
                await asyncio.sleep(60)  # Run every minute
                await self._aggregate_metrics()
            except Exception as e:
                self.logger.error(f"Error in metrics aggregation: {e}")
                
    async def _alert_evaluation_task(self):
        """Background task for evaluating alert rules"""
        while not self.shutdown_event.is_set():
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                await self._evaluate_alerts()
            except Exception as e:
                self.logger.error(f"Error in alert evaluation: {e}")
                
    async def _cleanup_task(self):
        """Background task for cleanup operations"""
        while not self.shutdown_event.is_set():
            try:
                await asyncio.sleep(3600)  # Run every hour
                await self._cleanup_old_data()
            except Exception as e:
                self.logger.error(f"Error in cleanup task: {e}")
                
    async def _aggregate_metrics(self):
        """Aggregate and store metrics to persistent storage"""
        recent_metrics = self.metrics_buffer.get_recent(300)  # Last 5 minutes
        
        if not recent_metrics or not self.sqlite_conn:
            return
            
        try:
            cursor = self.sqlite_conn.cursor()
            
            for metric in recent_metrics:
                cursor.execute(
                    "INSERT INTO metrics (name, value, timestamp, labels, metric_type) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (metric.name, metric.value, metric.timestamp, 
                     json.dumps(metric.labels), metric.metric_type.value)
                )
                
            self.sqlite_conn.commit()
        except Exception as e:
            self.logger.error(f"Failed to aggregate metrics: {e}")
            
    async def _evaluate_alerts(self):
        """Evaluate alert rules against recent metrics"""
        for rule in self.alert_rules:
            try:
                # Simple threshold-based evaluation
                # In a real implementation, you'd want a more sophisticated rule engine
                if ">" in rule["condition"]:
                    metric_name, threshold_str = rule["condition"].split(">")
                    threshold = float(threshold_str.strip())
                    
                    recent_values = [m.value for m in self.metrics_buffer.get_by_name(metric_name.strip(), 300)]
                    if recent_values and max(recent_values) > threshold:
                        # Avoid duplicate alerts
                        if time.time() - rule["last_triggered"] > 300:  # 5 minute cooldown
                            self.trigger_alert(
                                component="system",
                                level=rule["level"],
                                message=rule["message"],
                                tags={"rule": rule["name"], "value": max(recent_values)}
                            )
                            rule["last_triggered"] = time.time()
                            
            except Exception as e:
                self.logger.error(f"Failed to evaluate alert rule {rule['name']}: {e}")
                
    async def _cleanup_old_data(self):
        """Clean up old data to prevent unbounded growth"""
        if self.sqlite_conn:
            try:
                cutoff = time.time() - (7 * 24 * 3600)  # Keep 7 days
                cursor = self.sqlite_conn.cursor()
                
                cursor.execute("DELETE FROM metrics WHERE timestamp < ?", (cutoff,))
                cursor.execute("DELETE FROM spans WHERE start_time < ?", (cutoff,))
                cursor.execute("DELETE FROM traces WHERE start_time < ?", (cutoff,))
                cursor.execute("DELETE FROM alerts WHERE timestamp < ? AND resolved = 1", (cutoff,))
                
                self.sqlite_conn.commit()
                
                deleted = cursor.rowcount
                self.logger.info(f"Cleaned up {deleted} old records")
                
            except Exception as e:
                self.logger.error(f"Failed to cleanup old data: {e}")
                
    async def _store_span(self, span: TraceSpan):
        """Store a completed span to persistent storage"""
        if not self.sqlite_conn:
            return
            
        try:
            cursor = self.sqlite_conn.cursor()
            
            # Store or update trace
            cursor.execute(
                "INSERT OR REPLACE INTO traces (trace_id, operation_name, start_time, end_time, duration, status, tags) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (span.trace_id, span.operation_name, span.start_time, span.end_time,
                 span.duration, span.status, json.dumps(span.tags))
            )
            
            # Store span
            cursor.execute(
                "INSERT INTO spans (span_id, trace_id, operation_name, start_time, end_time, duration, "
                "parent_span_id, tags, logs, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (span.span_id, span.trace_id, span.operation_name, span.start_time, span.end_time,
                 span.duration, span.parent_span_id, json.dumps(span.tags), json.dumps(span.logs), span.status)
            )
            
            self.sqlite_conn.commit()
            
        except Exception as e:
            self.logger.error(f"Failed to store span: {e}")
            
    async def _store_alert(self, alert: Alert):
        """Store an alert to persistent storage"""
        if not self.sqlite_conn:
            return
            
        try:
            cursor = self.sqlite_conn.cursor()
            cursor.execute(
                "INSERT INTO alerts (id, level, message, timestamp, component, tags, resolved, resolution_time) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (alert.id, alert.level.value, alert.message, alert.timestamp, alert.component,
                 json.dumps(alert.tags), alert.resolved, alert.resolution_time)
            )
            self.sqlite_conn.commit()
            
        except Exception as e:
            self.logger.error(f"Failed to store alert: {e}")
            
    async def shutdown(self):
        """Graceful shutdown"""
        self.shutdown_event.set()
        
        # Wait for background tasks to complete
        if self.background_tasks:
            await asyncio.gather(*self.background_tasks, return_exceptions=True)
            
        # Close connections
        if self.redis_client:
            self.redis_client.close()
        if self.sqlite_conn:
            self.sqlite_conn.close()
            
        self.logger.info("Observability system shutdown complete")


# Decorator for automatic instrumentation
def observe(operation_name: str = None, metric_labels: Dict[str, str] = None):
    """Decorator to automatically instrument functions with observability"""
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            obs = getattr(args[0], '_observability', None) if args else None
            if not obs or not isinstance(obs, ObservabilitySystem):
                return await func(*args, **kwargs)
                
            op_name = operation_name or f"{func.__module__}.{func.__qualname__}"
            labels = metric_labels or {}
            
            async with obs.trace_span(op_name) as span_id:
                try:
                    obs.increment_counter("function_calls_total", {**labels, "function": op_name})
                    
                    async with obs.timer("function_duration", {**labels, "function": op_name}):
                        result = await func(*args, **kwargs)
                        
                    obs.increment_counter("function_calls_success", {**labels, "function": op_name})
                    return result
                    
                except Exception as e:
                    obs.increment_counter("function_calls_error", {**labels, "function": op_name})
                    obs.add_span_log(span_id, f"Function error: {str(e)}", "error")
                    raise
                    
        def sync_wrapper(*args, **kwargs):
            obs = getattr(args[0], '_observability', None) if args else None
            if not obs or not isinstance(obs, ObservabilitySystem):
                return func(*args, **kwargs)
                
            op_name = operation_name or f"{func.__module__}.{func.__qualname__}"
            labels = metric_labels or {}
            
            start_time = time.time()
            try:
                obs.increment_counter("function_calls_total", {**labels, "function": op_name})
                result = func(*args, **kwargs)
                obs.increment_counter("function_calls_success", {**labels, "function": op_name})
                return result
                
            except Exception as e:
                obs.increment_counter("function_calls_error", {**labels, "function": op_name})
                raise
            finally:
                duration = time.time() - start_time
                obs.record_timing("function_duration", duration, {**labels, "function": op_name})
                
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
            
    return decorator


# Example usage and integration helpers
class ObservabilityMixin:
    """Mixin class to add observability to any class"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._observability = ObservabilitySystem()
        
    async def init_observability(self):
        """Initialize the observability system"""
        await self._observability.initialize()
        
    async def shutdown_observability(self):
        """Shutdown the observability system"""
        await self._observability.shutdown()


if __name__ == "__main__":
    # Example usage
    async def main():
        obs = ObservabilitySystem()
        await obs.initialize()
        
        # Add some alert rules
        obs.add_alert_rule(
            "high_error_rate",
            "error_rate > 0.1",
            AlertLevel.WARNING,
            "Error rate exceeding 10%"
        )
        
        # Record some metrics
        obs.increment_counter("requests_total", {"endpoint": "/api/chat"})
        obs.set_gauge("active_connections", 42)
        
        # Use tracing
        async with obs.trace_span("example_operation") as span_id:
            obs.add_span_log(span_id, "Starting example operation")
            await asyncio.sleep(0.1)
            obs.add_span_log(span_id, "Operation completed")
            
        # Trigger an alert
        obs.trigger_alert("api", AlertLevel.ERROR, "Database connection failed")
        
        # Wait a bit to see background tasks work
        await asyncio.sleep(2)
        
        # Get some analytics
        summary = obs.get_performance_summary(1)
        print("Performance Summary:", summary)
        
        active_alerts = await obs.get_active_alerts()
        print(f"Active Alerts: {len(active_alerts)}")
        
        await obs.shutdown()
        
    asyncio.run(main())