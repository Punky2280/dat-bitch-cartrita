"""
Enhanced Chat Routes for Python FastAPI Backend
Implementing ChatGPT/Claude-style chat functionality with agents
"""
import os
import json
import uuid
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, AsyncGenerator
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import asyncpg
from openai import AsyncOpenAI

from cartrita_core.enhanced_agent_manager import enhanced_agent_manager, AgentCapability
from cartrita_core.mcp_integration import mcp_manager, MCPRequest
from cartrita_core.langchain_integration import langchain_manager
from cartrita_core.backend_bridge import backend_bridge

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/api/v2/chat", tags=["Enhanced Chat"])

# Initialize OpenAI client
openai_client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_FINETUNING_API_KEY", os.getenv("OPENAI_API_KEY"))
)

# Database connection
async def get_db_connection():
    """Get database connection"""
    try:
        return await asyncpg.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "password"),
            database=os.getenv("POSTGRES_DB", "cartrita_db")
        )
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

# Pydantic models
class ChatSessionCreate(BaseModel):
    title: Optional[str] = None
    agent_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class ChatMessageRequest(BaseModel):
    session_id: str
    message: str
    agent_id: Optional[str] = None
    stream: Optional[bool] = True
    context: Optional[Dict[str, Any]] = None

class MultiAgentRequest(BaseModel):
    session_id: str
    message: str
    agent_capabilities: List[str]
    coordination_strategy: Optional[str] = "sequential"
    stream: Optional[bool] = True

class ChatMessage(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    agent_id: Optional[str] = None
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None
    attachments: Optional[List[str]] = None
    tools_used: Optional[List[str]] = None
    execution_details: Optional[Dict[str, Any]] = None

class ChatSession(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    agent_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    message_count: int = 0

class AgentInfo(BaseModel):
    id: str
    name: str
    description: str
    capabilities: List[str]
    model: str
    status: str

class AttachmentUpload(BaseModel):
    filename: str
    content_type: str
    size: int
    file_path: str

# Routes
@router.post("/sessions", response_model=ChatSession)
async def create_chat_session(
    session_data: ChatSessionCreate,
    db = Depends(get_db_connection)
):
    """Create a new chat session"""
    try:
        session_id = str(uuid.uuid4())
        title = session_data.title or f"Chat Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        created_at = datetime.utcnow()
        
        query = """
            INSERT INTO chat_sessions (id, title, created_at, updated_at, agent_id, context)
            VALUES ($1, $2, $3, $3, $4, $5)
            RETURNING id, title, created_at, updated_at, agent_id, context
        """
        
        result = await db.fetchrow(
            query,
            session_id,
            title,
            created_at,
            session_data.agent_id,
            json.dumps(session_data.context) if session_data.context else None
        )
        
        return ChatSession(
            id=result["id"],
            title=result["title"],
            created_at=result["created_at"],
            updated_at=result["updated_at"],
            agent_id=result["agent_id"],
            context=json.loads(result["context"]) if result["context"] else None,
            message_count=0
        )
        
    except Exception as e:
        logger.error(f"Error creating chat session: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()

@router.get("/sessions", response_model=List[ChatSession])
async def get_chat_sessions(
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    db = Depends(get_db_connection)
):
    """Get all chat sessions with pagination"""
    try:
        query = """
            SELECT s.id, s.title, s.created_at, s.updated_at, s.agent_id, s.context,
                   COUNT(m.id) as message_count
            FROM chat_sessions s
            LEFT JOIN chat_messages m ON s.id = m.session_id
            GROUP BY s.id, s.title, s.created_at, s.updated_at, s.agent_id, s.context
            ORDER BY s.updated_at DESC
            LIMIT $1 OFFSET $2
        """
        
        results = await db.fetch(query, limit, offset)
        
        sessions = []
        for row in results:
            sessions.append(ChatSession(
                id=row["id"],
                title=row["title"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                agent_id=row["agent_id"],
                context=json.loads(row["context"]) if row["context"] else None,
                message_count=row["message_count"]
            ))
        
        return sessions
        
    except Exception as e:
        logger.error(f"Error fetching chat sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()

@router.get("/sessions/{session_id}", response_model=ChatSession)
async def get_chat_session(session_id: str, db = Depends(get_db_connection)):
    """Get specific chat session"""
    try:
        query = """
            SELECT s.id, s.title, s.created_at, s.updated_at, s.agent_id, s.context,
                   COUNT(m.id) as message_count
            FROM chat_sessions s
            LEFT JOIN chat_messages m ON s.id = m.session_id
            WHERE s.id = $1
            GROUP BY s.id, s.title, s.created_at, s.updated_at, s.agent_id, s.context
        """
        
        result = await db.fetchrow(query, session_id)
        if not result:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return ChatSession(
            id=result["id"],
            title=result["title"],
            created_at=result["created_at"],
            updated_at=result["updated_at"],
            agent_id=result["agent_id"],
            context=json.loads(result["context"]) if result["context"] else None,
            message_count=result["message_count"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chat session: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()

@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessage])
async def get_chat_messages(
    session_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db = Depends(get_db_connection)
):
    """Get messages for a chat session"""
    try:
        query = """
            SELECT id, session_id, role, content, agent_id, timestamp, metadata, attachments, tools_used, execution_details
            FROM chat_messages
            WHERE session_id = $1
            ORDER BY timestamp ASC
            LIMIT $2 OFFSET $3
        """
        
        results = await db.fetch(query, session_id, limit, offset)
        
        messages = []
        for row in results:
            messages.append(ChatMessage(
                id=row["id"],
                session_id=row["session_id"],
                role=row["role"],
                content=row["content"],
                agent_id=row["agent_id"],
                timestamp=row["timestamp"],
                metadata=json.loads(row["metadata"]) if row["metadata"] else None,
                attachments=json.loads(row["attachments"]) if row["attachments"] else None,
                tools_used=json.loads(row["tools_used"]) if row["tools_used"] else None,
                execution_details=json.loads(row["execution_details"]) if row["execution_details"] else None
            ))
        
        return messages
        
    except Exception as e:
        logger.error(f"Error fetching chat messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()

async def store_message(
    db: asyncpg.Connection,
    session_id: str,
    role: str,
    content: str,
    agent_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    attachments: Optional[List[str]] = None,
    tools_used: Optional[List[str]] = None,
    execution_details: Optional[Dict[str, Any]] = None
) -> str:
    """Store a chat message in the database"""
    message_id = str(uuid.uuid4())
    timestamp = datetime.utcnow()
    
    query = """
        INSERT INTO chat_messages (id, session_id, role, content, agent_id, timestamp, metadata, attachments, tools_used, execution_details)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
    """
    
    result = await db.fetchrow(
        query,
        message_id,
        session_id,
        role,
        content,
        agent_id,
        timestamp,
        json.dumps(metadata) if metadata else None,
        json.dumps(attachments) if attachments else None,
        json.dumps(tools_used) if tools_used else None,
        json.dumps(execution_details) if execution_details else None
    )
    
    # Update session timestamp
    update_query = "UPDATE chat_sessions SET updated_at = $1 WHERE id = $2"
    await db.execute(update_query, timestamp, session_id)
    
    return result["id"]

@router.post("/chat")
async def enhanced_chat_message(request: ChatMessageRequest):
    """Process chat message with enhanced agent capabilities"""
    try:
        db = await get_db_connection()
        
        # Verify session exists
        session_query = "SELECT id FROM chat_sessions WHERE id = $1"
        session_exists = await db.fetchrow(session_query, request.session_id)
        if not session_exists:
            await db.close()
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Store user message
        user_msg_id = await store_message(
            db, request.session_id, "user", request.message
        )
        
        # Get agent
        agent_id = request.agent_id or "supervisor"
        
        if request.stream:
            await db.close()
            return StreamingResponse(
                stream_chat_response(request.session_id, request.message, agent_id, request.context),
                media_type="text/plain"
            )
        else:
            # Non-streaming response
            try:
                response = await enhanced_agent_manager.execute_with_agent(
                    agent_id=agent_id,
                    message=request.message,
                    context=request.context or {}
                )
                
                # Store assistant response
                assistant_msg_id = await store_message(
                    db, request.session_id, "assistant", response.content,
                    agent_id=agent_id,
                    metadata=response.metadata,
                    tools_used=response.tools_used,
                    execution_details=response.execution_details
                )
                
                await db.close()
                return {"message": response.content, "agent_id": agent_id}
                
            except Exception as e:
                logger.error(f"Error in non-streaming chat: {e}")
                await db.close()
                raise HTTPException(status_code=500, detail=str(e))
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in enhanced chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def stream_chat_response(
    session_id: str,
    message: str,
    agent_id: str,
    context: Optional[Dict[str, Any]] = None
) -> AsyncGenerator[str, None]:
    """Stream chat response using OpenAI streaming"""
    db = None
    try:
        # Get conversation history
        db = await get_db_connection()
        history_query = """
            SELECT role, content, agent_id
            FROM chat_messages 
            WHERE session_id = $1 
            ORDER BY timestamp ASC 
            LIMIT 20
        """
        history = await db.fetch(history_query, session_id)
        
        # Build messages for OpenAI
        messages = []
        for msg in history:
            if msg["role"] in ["user", "assistant"]:
                messages.append({"role": msg["role"], "content": msg["content"]})
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # Get agent configuration
        agent_config = enhanced_agent_manager.get_agent_config(agent_id)
        if not agent_config:
            yield f"data: {json.dumps({'error': 'Agent not found'})}\n\n"
            return
            
        # Stream from OpenAI
        full_response = ""
        async with openai_client.chat.completions.create(
            model=agent_config.model,
            messages=messages,
            stream=True,
            max_tokens=2000,
            temperature=0.7
        ) as stream:
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    yield f"data: {json.dumps({'content': content})}\n\n"
        
        # Store the complete response
        await store_message(
            db, session_id, "assistant", full_response,
            agent_id=agent_id,
            metadata={"streaming": True}
        )
        
        yield f"data: {json.dumps({'done': True})}\n\n"
        
    except Exception as e:
        logger.error(f"Error in streaming chat: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    finally:
        if db:
            await db.close()

@router.post("/multi-agent")
async def multi_agent_chat(request: MultiAgentRequest):
    """Coordinate multiple agents for complex tasks"""
    try:
        db = await get_db_connection()
        
        # Verify session exists
        session_query = "SELECT id FROM chat_sessions WHERE id = $1"
        session_exists = await db.fetchrow(session_query, request.session_id)
        if not session_exists:
            await db.close()
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Store user message
        await store_message(db, request.session_id, "user", request.message)
        
        if request.stream:
            await db.close()
            return StreamingResponse(
                stream_multi_agent_response(request),
                media_type="text/plain"
            )
        else:
            # Non-streaming multi-agent coordination
            try:
                response = await enhanced_agent_manager.coordinate_multi_agent_task(
                    message=request.message,
                    required_capabilities=[AgentCapability(cap) for cap in request.agent_capabilities],
                    strategy=request.coordination_strategy or "sequential"
                )
                
                # Store response
                await store_message(
                    db, request.session_id, "assistant", response.content,
                    metadata=response.metadata,
                    tools_used=response.tools_used,
                    execution_details=response.execution_details
                )
                
                await db.close()
                return {"message": response.content}
                
            except Exception as e:
                logger.error(f"Error in multi-agent coordination: {e}")
                await db.close()
                raise HTTPException(status_code=500, detail=str(e))
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in multi-agent chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def stream_multi_agent_response(request: MultiAgentRequest) -> AsyncGenerator[str, None]:
    """Stream multi-agent coordination response"""
    try:
        yield f"data: {json.dumps({'status': 'Starting multi-agent coordination'})}\n\n"
        
        response = await enhanced_agent_manager.coordinate_multi_agent_task(
            message=request.message,
            required_capabilities=[AgentCapability(cap) for cap in request.agent_capabilities],
            strategy=request.coordination_strategy or "sequential"
        )
        
        yield f"data: {json.dumps({'content': response.content})}\n\n"
        yield f"data: {json.dumps({'done': True, 'metadata': response.metadata})}\n\n"
        
    except Exception as e:
        logger.error(f"Error in streaming multi-agent response: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

@router.get("/agents", response_model=List[AgentInfo])
async def get_available_agents():
    """Get list of available agents and their capabilities"""
    try:
        agents = enhanced_agent_manager.get_available_agents()
        agent_info = []
        
        for agent_id, config in agents.items():
            agent_info.append(AgentInfo(
                id=agent_id,
                name=config.name,
                description=config.description,
                capabilities=[cap.value for cap in config.capabilities],
                model=config.model,
                status="active"
            ))
            
        return agent_info
        
    except Exception as e:
        logger.error(f"Error fetching agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_attachment(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    db = Depends(get_db_connection)
):
    """Upload file attachment for chat session"""
    try:
        # Verify session exists
        session_query = "SELECT id FROM chat_sessions WHERE id = $1"
        session_exists = await db.fetchrow(session_query, session_id)
        if not session_exists:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Create uploads directory if it doesn't exist
        uploads_dir = Path("uploads")
        uploads_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix if file.filename else ""
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = uploads_dir / unique_filename
        
        # Save file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Store attachment record
        attachment_id = str(uuid.uuid4())
        query = """
            INSERT INTO chat_attachments (id, session_id, filename, original_filename, file_path, content_type, size, uploaded_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        """
        
        result = await db.fetchrow(
            query,
            attachment_id,
            session_id,
            unique_filename,
            file.filename,
            str(file_path),
            file.content_type,
            len(content),
            datetime.utcnow()
        )
        
        return AttachmentUpload(
            filename=file.filename or "unknown",
            content_type=file.content_type or "application/octet-stream",
            size=len(content),
            file_path=str(file_path)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading attachment: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()

@router.post("/sessions/{session_id}/feedback")
async def submit_feedback(
    session_id: str,
    message_id: str,
    rating: int,
    feedback: Optional[str] = None,
    db = Depends(get_db_connection)
):
    """Submit feedback for a message"""
    try:
        # Verify session and message exist
        verify_query = """
            SELECT m.id FROM chat_messages m
            JOIN chat_sessions s ON m.session_id = s.id
            WHERE s.id = $1 AND m.id = $2
        """
        exists = await db.fetchrow(verify_query, session_id, message_id)
        if not exists:
            raise HTTPException(status_code=404, detail="Session or message not found")
        
        # Store feedback
        feedback_id = str(uuid.uuid4())
        query = """
            INSERT INTO chat_feedback (id, message_id, rating, feedback, created_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        """
        
        result = await db.fetchrow(
            query,
            feedback_id,
            message_id,
            rating,
            feedback,
            datetime.utcnow()
        )
        
        return {"feedback_id": result["id"], "status": "submitted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()

@router.delete("/sessions/{session_id}")
async def delete_chat_session(session_id: str, db = Depends(get_db_connection)):
    """Delete a chat session and all its messages"""
    try:
        # Delete messages first (foreign key constraint)
        await db.execute("DELETE FROM chat_messages WHERE session_id = $1", session_id)
        
        # Delete attachments
        await db.execute("DELETE FROM chat_attachments WHERE session_id = $1", session_id)
        
        # Delete session
        result = await db.execute("DELETE FROM chat_sessions WHERE id = $1", session_id)
        
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"status": "deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()

@router.get("/status")
async def get_system_status():
    """Get system status and health check"""
    try:
        # Test database connection
        db = await get_db_connection()
        await db.fetchrow("SELECT 1")
        await db.close()
        db_status = "healthy"
        
        # Test OpenAI connection
        try:
            await openai_client.models.list()
            openai_status = "healthy"
        except:
            openai_status = "error"
        
        # Get agent status
        agent_status = enhanced_agent_manager.get_agent_status_report()
        
        # Get MCP status
        mcp_status = await mcp_manager.get_server_status()
        
        return {
            "database": db_status,
            "openai": openai_status,
            "agents": agent_status,
            "mcp": mcp_status,
            "timestamp": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return {
            "database": "error",
            "openai": "unknown",
            "agents": "error",
            "mcp": "error",
            "error": str(e),
            "timestamp": datetime.utcnow()
        }

@router.post("/mcp/execute")
async def execute_mcp_tool(request: MCPRequest):
    """Execute MCP tool"""
    try:
        result = await mcp_manager.execute_tool(
            server_name=request.server_name,
            tool_name=request.tool_name,
            parameters=request.parameters
        )
        return {"result": result}
        
    except Exception as e:
        logger.error(f"Error executing MCP tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/langchain/chains")
async def get_langchain_chains():
    """Get available LangChain chains"""
    try:
        chains = langchain_manager.get_available_chains()
        return {"chains": chains}
        
    except Exception as e:
        logger.error(f"Error fetching LangChain chains: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/langchain/execute")
async def execute_langchain_chain(
    chain_name: str,
    inputs: Dict[str, Any],
    session_id: Optional[str] = None
):
    """Execute LangChain chain"""
    try:
        result = await langchain_manager.execute_chain(
            chain_name=chain_name,
            inputs=inputs,
            session_id=session_id
        )
        return {"result": result}
        
    except Exception as e:
        logger.error(f"Error executing LangChain chain: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/bridge/status")
async def get_bridge_status():
    """Get backend bridge status"""
    try:
        status = await backend_bridge.health_check_all()
        return status
        
    except Exception as e:
        logger.error(f"Error getting bridge status: {e}")
        raise HTTPException(status_code=500, detail=str(e))