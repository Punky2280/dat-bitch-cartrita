"""
Unix Domain Socket Transport for MCP
High-performance async transport using MessagePack serialization
"""

import asyncio
import struct
import logging
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from contextlib import asynccontextmanager

import msgpack
from opentelemetry import trace, context, propagation
from opentelemetry.trace import Status, StatusCode, SpanKind

from ..schema import MCPMessage, MCPValidator, MessageTypes
from .base import BaseMCPTransport, TransportError


logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)


class UnixSocketTransportError(TransportError):
    """Unix socket specific transport errors"""
    pass


class MCPUnixSocketServer(BaseMCPTransport):
    """Unix socket server for MCP communication"""
    
    def __init__(
        self,
        socket_path: str,
        enable_validation: bool = True,
        max_message_size: int = 10 * 1024 * 1024,  # 10MB
        heartbeat_interval: float = 30.0,
        connection_timeout: float = 10.0
    ):
        super().__init__(enable_validation)
        self.socket_path = Path(socket_path)
        self.max_message_size = max_message_size
        self.heartbeat_interval = heartbeat_interval
        self.connection_timeout = connection_timeout
        
        self._server: Optional[asyncio.Server] = None
        self._clients: Dict[str, 'UnixSocketConnection'] = {}
        self._running = False
        
    async def start(self) -> None:
        """Start the Unix socket server"""
        if self._running:
            return
            
        # Remove existing socket file
        if self.socket_path.exists():
            self.socket_path.unlink()
            
        # Ensure directory exists
        self.socket_path.parent.mkdir(parents=True, exist_ok=True)
        
        with tracer.start_as_current_span("mcp.transport.unix.start", kind=SpanKind.SERVER):
            self._server = await asyncio.start_unix_server(
                self._handle_connection,
                path=str(self.socket_path)
            )
            self._running = True
            
            # Set appropriate permissions
            self.socket_path.chmod(0o600)
            
            logger.info(f"Unix socket server started at {self.socket_path}")
            
    async def stop(self) -> None:
        """Stop the Unix socket server"""
        if not self._running:
            return
            
        with tracer.start_as_current_span("mcp.transport.unix.stop"):
            self._running = False
            
            # Close all client connections
            close_tasks = []
            for client in list(self._clients.values()):
                close_tasks.append(client.close())
            
            if close_tasks:
                await asyncio.gather(*close_tasks, return_exceptions=True)
            
            # Close server
            if self._server:
                self._server.close()
                await self._server.wait_closed()
                
            # Remove socket file
            if self.socket_path.exists():
                self.socket_path.unlink()
                
            logger.info("Unix socket server stopped")
            
    async def send_message(self, message: MCPMessage, client_id: Optional[str] = None) -> None:
        """Send message to specific client or broadcast"""
        if client_id:
            client = self._clients.get(client_id)
            if not client:
                raise UnixSocketTransportError(f"Client {client_id} not found")
            await client.send_message(message)
        else:
            # Broadcast to all clients
            if not self._clients:
                logger.warning("No clients connected for message broadcast")
                return
                
            send_tasks = []
            for client in self._clients.values():
                send_tasks.append(client.send_message(message))
            
            results = await asyncio.gather(*send_tasks, return_exceptions=True)
            
            # Log any send failures
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    client_id = list(self._clients.keys())[i]
                    logger.error(f"Failed to send message to client {client_id}: {result}")
                    
    async def _handle_connection(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        """Handle new client connection"""
        client_id = f"client_{id(writer)}"
        
        with tracer.start_as_current_span(
            "mcp.transport.unix.connection",
            kind=SpanKind.SERVER,
            attributes={"mcp.client.id": client_id}
        ):
            connection = UnixSocketConnection(
                reader=reader,
                writer=writer,
                client_id=client_id,
                max_message_size=self.max_message_size,
                enable_validation=self.enable_validation,
                message_handler=self._handle_client_message
            )
            
            self._clients[client_id] = connection
            logger.info(f"Client {client_id} connected")
            
            try:
                await connection.start()
            except Exception as e:
                logger.error(f"Connection {client_id} failed: {e}")
            finally:
                # Clean up connection
                await connection.close()
                self._clients.pop(client_id, None)
                logger.info(f"Client {client_id} disconnected")
                
    async def _handle_client_message(self, message: MCPMessage, client_id: str) -> None:
        """Handle message from client"""
        with tracer.start_as_current_span(
            "mcp.transport.unix.handle_message",
            kind=SpanKind.SERVER,
            attributes={
                "mcp.message.id": message.id,
                "mcp.message.type": message.message_type,
                "mcp.client.id": client_id
            }
        ):
            # Extract OpenTelemetry context
            if message.context.baggage:
                extracted_context = propagation.extract(context.active(), message.context.baggage)
                with context.attach(extracted_context):
                    await self._dispatch_message(message, client_id)
            else:
                await self._dispatch_message(message, client_id)
                
    async def _dispatch_message(self, message: MCPMessage, client_id: str) -> None:
        """Dispatch message to registered handlers"""
        if self.message_handler:
            try:
                # Add client_id to message context for routing
                message.context.metadata["client_id"] = client_id
                await self.message_handler(message)
            except Exception as e:
                logger.error(f"Message handler failed: {e}")
                
                # Send error response if it was a request
                if message.message_type in [MessageTypes.TASK_REQUEST]:
                    error_response = self._create_error_response(message, str(e))
                    await self.send_message(error_response, client_id)


class MCPUnixSocketClient(BaseMCPTransport):
    """Unix socket client for MCP communication"""
    
    def __init__(
        self,
        socket_path: str,
        enable_validation: bool = True,
        max_message_size: int = 10 * 1024 * 1024,  # 10MB
        reconnect_interval: float = 5.0,
        connection_timeout: float = 10.0
    ):
        super().__init__(enable_validation)
        self.socket_path = socket_path
        self.max_message_size = max_message_size
        self.reconnect_interval = reconnect_interval
        self.connection_timeout = connection_timeout
        
        self._connection: Optional['UnixSocketConnection'] = None
        self._connected = False
        self._reconnect_task: Optional[asyncio.Task] = None
        
    async def connect(self) -> None:
        """Connect to Unix socket server"""
        if self._connected:
            return
            
        with tracer.start_as_current_span("mcp.transport.unix.connect", kind=SpanKind.CLIENT):
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_unix_connection(self.socket_path),
                    timeout=self.connection_timeout
                )
                
                self._connection = UnixSocketConnection(
                    reader=reader,
                    writer=writer,
                    client_id="client",
                    max_message_size=self.max_message_size,
                    enable_validation=self.enable_validation,
                    message_handler=self._handle_server_message
                )
                
                await self._connection.start()
                self._connected = True
                
                logger.info(f"Connected to Unix socket server at {self.socket_path}")
                
            except Exception as e:
                logger.error(f"Failed to connect to {self.socket_path}: {e}")
                raise UnixSocketTransportError(f"Connection failed: {e}")
                
    async def disconnect(self) -> None:
        """Disconnect from server"""
        if self._reconnect_task:
            self._reconnect_task.cancel()
            
        if self._connection:
            await self._connection.close()
            self._connection = None
            
        self._connected = False
        logger.info("Disconnected from Unix socket server")
        
    async def send_message(self, message: MCPMessage) -> None:
        """Send message to server"""
        if not self._connected or not self._connection:
            raise UnixSocketTransportError("Not connected to server")
            
        await self._connection.send_message(message)
        
    async def _handle_server_message(self, message: MCPMessage, client_id: str) -> None:
        """Handle message from server"""
        if self.message_handler:
            await self.message_handler(message)
            
    @asynccontextmanager
    async def connection(self):
        """Context manager for connection lifecycle"""
        await self.connect()
        try:
            yield self
        finally:
            await self.disconnect()


class UnixSocketConnection:
    """Manages individual Unix socket connection"""
    
    def __init__(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
        client_id: str,
        max_message_size: int,
        enable_validation: bool,
        message_handler: Optional[Callable[[MCPMessage, str], None]] = None
    ):
        self.reader = reader
        self.writer = writer
        self.client_id = client_id
        self.max_message_size = max_message_size
        self.enable_validation = enable_validation
        self.message_handler = message_handler
        
        self._running = False
        self._receive_task: Optional[asyncio.Task] = None
        
    async def start(self) -> None:
        """Start message receive loop"""
        if self._running:
            return
            
        self._running = True
        self._receive_task = asyncio.create_task(self._receive_loop())
        
        try:
            await self._receive_task
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Connection {self.client_id} receive loop failed: {e}")
            raise
            
    async def close(self) -> None:
        """Close connection"""
        self._running = False
        
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
                
        self.writer.close()
        await self.writer.wait_closed()
        
    async def send_message(self, message: MCPMessage) -> None:
        """Send message over connection"""
        with tracer.start_as_current_span(
            "mcp.transport.unix.send",
            kind=SpanKind.CLIENT,
            attributes={
                "mcp.message.id": message.id,
                "mcp.message.type": message.message_type
            }
        ) as span:
            try:
                # Validate message if enabled
                if self.enable_validation:
                    MCPValidator.validate_message(message.model_dump())
                    
                # Add OpenTelemetry context to message
                carrier = {}
                propagation.inject(carrier)
                if message.context.baggage is None:
                    message.context.baggage = {}
                message.context.baggage.update(carrier)
                
                # Serialize message
                data = msgpack.packb(message.model_dump(), use_bin_type=True)
                
                if len(data) > self.max_message_size:
                    raise UnixSocketTransportError(f"Message too large: {len(data)} bytes")
                    
                # Send with length prefix
                length_header = struct.pack('!I', len(data))
                self.writer.write(length_header + data)
                await self.writer.drain()
                
                span.set_attributes({
                    "mcp.message.size_bytes": len(data),
                    "mcp.transport.success": True
                })
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise UnixSocketTransportError(f"Failed to send message: {e}")
                
    async def _receive_loop(self) -> None:
        """Main message receive loop"""
        while self._running:
            try:
                # Read length header
                length_data = await self._read_exactly(4)
                if not length_data:
                    break
                    
                message_length = struct.unpack('!I', length_data)[0]
                
                if message_length > self.max_message_size:
                    raise UnixSocketTransportError(f"Message too large: {message_length} bytes")
                    
                # Read message data
                message_data = await self._read_exactly(message_length)
                if not message_data:
                    break
                    
                # Deserialize and validate
                with tracer.start_as_current_span(
                    "mcp.transport.unix.receive",
                    kind=SpanKind.SERVER,
                    attributes={
                        "mcp.message.size_bytes": len(message_data),
                        "mcp.client.id": self.client_id
                    }
                ) as span:
                    try:
                        raw_message = msgpack.unpackb(message_data, raw=False)
                        
                        if self.enable_validation:
                            message = MCPValidator.validate_message(raw_message)
                        else:
                            message = MCPMessage.model_validate(raw_message)
                            
                        span.set_attributes({
                            "mcp.message.id": message.id,
                            "mcp.message.type": message.message_type
                        })
                        
                        # Handle message
                        if self.message_handler:
                            await self.message_handler(message, self.client_id)
                            
                    except Exception as e:
                        span.record_exception(e)
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        logger.error(f"Failed to process received message: {e}")
                        
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Receive loop error for {self.client_id}: {e}")
                break
                
    async def _read_exactly(self, n: int) -> bytes:
        """Read exactly n bytes from stream"""
        data = b''
        while len(data) < n:
            chunk = await self.reader.read(n - len(data))
            if not chunk:
                return b''  # Connection closed
            data += chunk
        return data