"""
Enhanced Chat Routes for Python FastAPI Backend
Implementing ChatGPT/Claude-style chat functionality with agents
"""


import os
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, AsyncGenerator
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from the backend .env file
env_path = Path(__file__).parent.parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(env_path)
    logging.info(f"Loaded environment variables from {env_path}")
else:
    # Try loading from current directory
    load_dotenv()
    logging.info("Loaded environment variables from current directory")

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import asyncpg
from openai import AsyncOpenAI
from config import OpenAISettings

from cartrita_core.enhanced_agent_manager import enhanced_agent_manager, AgentCapability
from cartrita_core.mcp_integration import mcp_manager, MCPRequest
from cartrita_core.langchain_integration import get_langchain_config, initialize_langchain
from cartrita_core.backend_bridge import backend_bridge
from cartrita_core.quantum_engine import quantum_engine, QuantumAlgorithm, QuantumJobStatus

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter(prefix="/api/v2/chat", tags=["Enhanced Chat"])

# Initialize OpenAI client with centralized settings
try:
    oa = OpenAISettings.load()
    if oa.api_key:
        openai_client = AsyncOpenAI(**oa.client_kwargs())
        logger.info(f"✅ OpenAI client initialized (model={oa.default_model})")
    else:
        openai_client = None
        logger.warning("⚠️ OpenAI API key not found. Chat functionality will be limited.")
except Exception as e:
    openai_client = None
    logger.warning(f"⚠️ OpenAI client init error: {e}")

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
        raise HTTPException(
            status_code=500, detail="Database connection failed"
        ) from e

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
        created_at = datetime.now(timezone.utc)

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
        raise HTTPException(status_code=500, detail=str(e)) from e
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

        return [
            ChatSession(
                id=row["id"],
                title=row["title"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                agent_id=row["agent_id"],
                context=json.loads(row["context"]) if row["context"] else None,
                message_count=row["message_count"],
            )
            for row in results
        ]
    except Exception as e:
        logger.error(f"Error fetching chat sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
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
        raise HTTPException(status_code=500, detail=str(e)) from e
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

        return [
            ChatMessage(
                id=row["id"],
                session_id=row["session_id"],
                role=row["role"],
                content=row["content"],
                agent_id=row["agent_id"],
                timestamp=row["timestamp"],
                metadata=(
                    json.loads(row["metadata"]) if row["metadata"] else None
                ),
                attachments=(
                    json.loads(row["attachments"])
                    if row["attachments"]
                    else None
                ),
                tools_used=(
                    json.loads(row["tools_used"])
                    if row["tools_used"]
                    else None
                ),
                execution_details=(
                    json.loads(row["execution_details"])
                    if row["execution_details"]
                    else None
                ),
            )
            for row in results
        ]
    except Exception as e:
        logger.error(f"Error fetching chat messages: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
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
    timestamp = datetime.now(timezone.utc)

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

    return result["id"] # pyright: ignore[reportOptionalSubscript]

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
        await store_message(
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

                # Handle response based on its type
                if isinstance(response, dict):
                    content = response.get("content", str(response))
                    metadata = response.get("metadata", {})
                    tools_used = response.get("tools_used", [])
                    execution_details = response.get("execution_details", {})
                else:
                    # If response is an object with attributes
                    content = getattr(response, 'content', str(response))
                    metadata = getattr(response, 'metadata', {})
                    tools_used = getattr(response, 'tools_used', [])
                    execution_details = getattr(response, 'execution_details', {})

                # Store assistant response
                await store_message(
                    db, request.session_id, "assistant", content,
                    agent_id=agent_id,
                    metadata=metadata,
                    tools_used=tools_used,
                    execution_details=execution_details
                )

                await db.close()
                return {"message": content, "agent_id": agent_id}

            except Exception as e:
                logger.error(f"Error in non-streaming chat: {e}")
                await db.close()
                raise HTTPException(status_code=500, detail=str(e)) from e

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in enhanced chat: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

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
        messages.extend(
            {"role": msg["role"], "content": msg["content"]}
            for msg in history
            if msg["role"] in ["user", "assistant"]
        )
        # Add current message
        messages.append({"role": "user", "content": message})

        # Get agent configuration
        agent_config = await enhanced_agent_manager.get_agent(agent_id)
        if not agent_config:
            yield f"data: {json.dumps({'error': 'Agent not found'})}\n\n"
            return

        # Check if OpenAI client is available
        if not openai_client:
            yield f"data: {json.dumps({'error': 'OpenAI client not configured'})}\n\n"
            return

        # Stream from OpenAI
        full_response = ""
        stream = await openai_client.chat.completions.create(
            model=agent_config.model,
            messages=messages,
            stream=True,
            max_completion_tokens=2000,
            temperature=1
        )
        
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
                    task=request.message,
                    required_capabilities=[AgentCapability(cap) for cap in request.agent_capabilities]
                )

                # Store response
                content = response.get("content", str(response))
                await store_message(
                    db, request.session_id, "assistant", content,
                    metadata=response,
                    execution_details=response
                )

                await db.close()
                return {"message": content}

            except Exception as e:
                logger.error(f"Error in multi-agent coordination: {e}")
                await db.close()
                raise HTTPException(status_code=500, detail=str(e)) from e

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in multi-agent chat: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

async def stream_multi_agent_response(request: MultiAgentRequest) -> AsyncGenerator[str, None]:
    """Stream multi-agent coordination response"""
    try:
        yield f"data: {json.dumps({'status': 'Starting multi-agent coordination'})}\n\n"
        
        response = await enhanced_agent_manager.coordinate_multi_agent_task(
            task=request.message,
            required_capabilities=[AgentCapability(cap) for cap in request.agent_capabilities]
        )
        
        content = response.get("content", str(response))
        yield f"data: {json.dumps({'content': content})}\n\n"
        yield f"data: {json.dumps({'done': True, 'metadata': response})}\n\n"
        
    except Exception as e:
        logger.error(f"Error in streaming multi-agent response: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

@router.get("/agents", response_model=List[AgentInfo])
async def get_available_agents():
    """Get list of available agents and their capabilities"""
    try:
        agents = await enhanced_agent_manager.list_agents()
        agent_info = []

        agent_info.extend(
            AgentInfo(
                id=config.id,
                name=config.name,
                description=config.description,
                capabilities=[cap.value for cap in config.capabilities],
                model=config.model,
                status=config.status.value,
            )
            for config in agents
        )
        return agent_info

    except Exception as e:
        logger.error(f"Error fetching agents: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

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
            datetime.now(timezone.utc),
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
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        await db.close()

# Vision Analysis Models
class VisionUploadResponse(BaseModel):
    filename: str
    file_path: str
    upload_id: str
    status: str

class VisionAnalysisRequest(BaseModel):
    filename: str
    prompt: Optional[str] = None
    session_id: Optional[str] = None
    analysis_types: Optional[List[str]] = ["objects", "text", "scene"]

class VisionAnalysisResponse(BaseModel):
    description: str
    objects: List[str]
    text: Optional[str] = None
    analysis: Dict[str, Any]

@router.post("/vision/upload", response_model=VisionUploadResponse)
async def upload_vision_file(
    session_id: str = Form("vision_session"),
    file: UploadFile = File(...),
):
    """Upload file for vision analysis"""
    try:
        # Create uploads directory if it doesn't exist
        uploads_dir = Path("uploads") / "vision"
        uploads_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename
        file_extension = Path(file.filename).suffix if file.filename else ""
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = uploads_dir / unique_filename

        # Save file
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        upload_id = str(uuid.uuid4())
        
        return VisionUploadResponse(
            filename=unique_filename,
            file_path=str(file_path),
            upload_id=upload_id,
            status="uploaded"
        )
    except Exception as e:
        logger.error(f"Error uploading vision file: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.post("/vision/analyze", response_model=VisionAnalysisResponse)
async def analyze_vision_file(request: VisionAnalysisRequest):
    """Analyze uploaded image/video file using AI vision capabilities"""
    try:
        # Check if file exists
        file_path = Path("uploads") / "vision" / request.filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        # Prepare vision analysis prompt
        analysis_prompt = f"""
        Analyze this image file and provide detailed analysis including:
        
        1. **Objects**: List all objects, people, and items visible in the image
        2. **Scene Description**: Describe the overall scene, setting, and context  
        3. **Text Extraction**: Extract any text visible in the image (OCR)
        4. **Visual Details**: Colors, lighting, composition, style
        5. **Additional Context**: Any other relevant observations

        File: {request.filename}
        User prompt: {request.prompt or 'No specific prompt provided'}
        
        Respond with structured analysis that can be parsed programmatically.
        """

        # Use OpenAI client for vision analysis
        # For now, simulate the analysis - in production this would use actual vision models
        openai_settings = OpenAISettings.load()
        client_kwargs = openai_settings.client_kwargs()
        client = AsyncOpenAI(**client_kwargs)

        response = await client.chat.completions.create(
            model="gpt-4o",  # Use vision-capable model
            messages=[
                {
                    "role": "user", 
                    "content": analysis_prompt
                }
            ],
            max_completion_tokens=1000,
            temperature=1
        )

        analysis_content = response.choices[0].message.content or ""

        # Parse the response for structured data (simplified extraction)
        objects = []
        extracted_text = ""
        scene_description = (
            f"{analysis_content[:200]}..."
            if len(analysis_content) > 200
            else analysis_content
        )

        # Extract objects (basic pattern matching)
        if "objects:" in analysis_content.lower():
            objects_section = analysis_content.lower().split("objects:")[1].split("\n")[:5]
            objects = [obj.strip("- ").strip() for obj in objects_section if obj.strip()]

        # Extract text (basic pattern matching)
        if "text:" in analysis_content.lower():
            text_section = analysis_content.lower().split("text:")[1].split("\n")[:3]
            extracted_text = " ".join([t.strip("- ").strip() for t in text_section if t.strip()])

        return VisionAnalysisResponse(
            description=scene_description,
            objects=objects[:10],  # Limit to top 10 objects
            text=extracted_text or None,
            analysis={
                "full_response": analysis_content,
                "file_name": request.filename,
                "analysis_types": request.analysis_types or [],
                "session_id": request.session_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "model": "gpt-4o",
                "prompt": request.prompt
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing vision file: {e}")
        raise HTTPException(status_code=500, detail=f"Vision analysis failed: {str(e)}") from e

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
            datetime.now(timezone.utc),
        )

        return {"feedback_id": result["id"], "status": "submitted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e
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
        raise HTTPException(status_code=500, detail=str(e)) from e
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
            if openai_client:
                await openai_client.models.list()
                openai_status = "healthy"
            else:
                openai_status = "not_configured"
        except Exception as e:
            openai_status = f"error: {str(e)}"

        # Get agent status
        agent_status = await enhanced_agent_manager.get_agent_status_report()

        # Get MCP status
        mcp_status = await mcp_manager.get_server_status()

        return {
            "database": db_status,
            "openai": openai_status,
            "agents": agent_status,
            "mcp": mcp_status,
            "timestamp": datetime.now(timezone.utc),
        }

    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return {
            "database": "error",
            "openai": "unknown",
            "agents": "error",
            "mcp": "error",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc),
        }

@router.post("/mcp/execute")
async def execute_mcp_tool(request: MCPRequest):
    """Execute MCP tool"""
    try:
        result = await mcp_manager.execute_tool(request)
        return {"result": result}

    except Exception as e:
        logger.error(f"Error executing MCP tool: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/langchain/chains")
async def get_langchain_chains():
    """Get available LangChain chains"""
    try:
        if config := get_langchain_config() or initialize_langchain():
            return {"chains": list(config.chains.keys()) if hasattr(config, 'chains') else []}

        else:
            return {"chains": [], "status": "not_configured"}

    except Exception as e:
        logger.error(f"Error getting LangChain chains: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.post("/langchain/chains/{chain_name}/execute")
async def execute_langchain_chain(chain_name: str, request_data: Dict[str, Any]):
    """Execute a LangChain chain with given inputs"""
    try:
        config = get_langchain_config() or initialize_langchain()
        
        if not config or not hasattr(config, 'chains'):
            raise HTTPException(status_code=503, detail="LangChain not configured")
            
        if chain_name not in config.chains:
            raise HTTPException(status_code=404, detail=f"Chain '{chain_name}' not found")
        
        # Extract inputs from request data
        inputs = request_data.get("inputs", {})
        
        # Basic execution for now - can be enhanced later
        result = {"status": "success", "chain": chain_name, "inputs": inputs}
        return {"result": result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing LangChain chain: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/bridge/status")
async def get_bridge_status():
    """Get backend bridge status"""
    try:
        return await backend_bridge.health_check_all()
    except Exception as e:
        logger.error(f"Error getting bridge status: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

# ================================
# ================================
# Quantum Computing Endpoints
# ================================

class QuantumJobRequest(BaseModel):
    """Request model for creating quantum jobs"""
    algorithm: str
    parameters: Dict[str, Any] = Field(default_factory=dict)

class QuantumJobResponse(BaseModel):
    """Response model for quantum job operations"""
    job_id: str
    status: str
    message: Optional[str] = None

@router.post("/quantum/jobs", response_model=QuantumJobResponse)
async def create_quantum_job(request: QuantumJobRequest):
    """Create a new quantum computation job"""
    try:
        # Validate algorithm
        try:
            algorithm = QuantumAlgorithm(request.algorithm)
        except ValueError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported algorithm: {request.algorithm}",
            ) from e

        # Create job
        job_id = await quantum_engine.create_quantum_job(algorithm, request.parameters)

        return QuantumJobResponse(
            job_id=job_id,
            status=QuantumJobStatus.PENDING.value,
            message=f"Quantum job created for {algorithm.value}"
        )

    except Exception as e:
        logger.error(f"Error creating quantum job: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/quantum/jobs")
async def list_quantum_jobs():
    """List all quantum jobs"""
    try:
        jobs = await quantum_engine.list_jobs()
        return [
            {
                "id": job.id,
                "algorithm": job.algorithm.value,
                "status": job.status.value,
                "created_at": job.created_at.isoformat(),
                "updated_at": job.updated_at.isoformat(),
                "parameters": job.parameters
            }
            for job in jobs
        ]
    except Exception as e:
        logger.error(f"Error listing quantum jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/quantum/jobs/{job_id}")
async def get_quantum_job_status(job_id: str):
    """Get status of a specific quantum job"""
    try:
        job = await quantum_engine.get_job_status(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        response = {
            "id": job.id,
            "algorithm": job.algorithm.value,
            "status": job.status.value,
            "created_at": job.created_at.isoformat(),
            "updated_at": job.updated_at.isoformat(),
            "parameters": job.parameters
        }
        
        # Include result if completed
        if job.result:
            response["result"] = {
                "result_data": job.result.result_data,
                "execution_time": job.result.execution_time,
                "shots": job.result.shots,
                "error_message": job.result.error_message
            }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting quantum job status: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.post("/quantum/jobs/{job_id}/cancel")
async def cancel_quantum_job(job_id: str):
    """Cancel a quantum job"""
    try:
        success = await quantum_engine.cancel_job(job_id)
        if not success:
            raise HTTPException(
                status_code=404, 
                detail="Job not found or cannot be cancelled"
            )
        
        return QuantumJobResponse(
            job_id=job_id,
            status=QuantumJobStatus.CANCELLED.value,
            message="Job cancelled successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling quantum job: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/quantum/jobs/{job_id}/results")
async def get_quantum_job_results(job_id: str):
    """Get results of a completed quantum job"""
    try:
        result = await quantum_engine.get_job_results(job_id)
        if not result:
            raise HTTPException(
                status_code=404, 
                detail="Job not found or not completed"
            )
        
        return {
            "job_id": result.job_id,
            "algorithm": result.algorithm.value,
            "status": result.status.value,
            "result_data": result.result_data,
            "execution_time": result.execution_time,
            "shots": result.shots,
            "timestamp": result.timestamp.isoformat(),
"            "error_message": result.error_message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting quantum job results: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e

@router.get("/quantum/algorithms")
async def list_quantum_algorithms():
    """List available quantum algorithms"""
    return {
        "algorithms": [
            {
                "id": algo.value,
                "name": algo.value.replace('_', ' ').title(),
                "description": f"Implementation of {algo.value.replace('_', ' ')} algorithm"
            }
            for algo in QuantumAlgorithm
        ]
    }
