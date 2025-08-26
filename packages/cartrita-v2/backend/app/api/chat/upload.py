"""
File upload API endpoint for chat attachments.
"""
import os
import uuid
import tempfile
from typing import List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, status
from fastapi.responses import JSONResponse

from ...models.file_metadata import (
    FileMetadata, 
    FileUploadResponse, 
    FileUploadError
)
from ...models.database_models import ChatSession, ChatMessage, FileAttachment
from ...database import get_db
from ...storage.s3 import S3Client, get_storage
from ...utils.file_scan import (
    scan_uploaded_file, 
    detect_content_type,
    validate_total_size
)

# Router setup
router = APIRouter(prefix="/chat", tags=["chat", "files"])

# Database connection (reuse from existing pattern)
async def get_db():
    """Get database connection."""
    try:
        return await asyncpg.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "password"),
            database=os.getenv("POSTGRES_DB", "cartrita_db")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed"
        ) from e


async def validate_session_and_message(
    db: asyncpg.Connection, 
    session_id: str, 
    message_id: str
) -> None:
    """
    Validate that session and message exist.
    
    Args:
        db: Database connection
        session_id: Chat session ID
        message_id: Message ID
    
    Raises:
        HTTPException: If session or message not found
    """
    # Check session exists
    session_query = "SELECT id FROM chat_sessions WHERE id = $1"
    session = await db.fetchrow(session_query, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session {session_id} not found"
        )
    
    # Check message exists and belongs to session
    message_query = """
        SELECT id FROM chat_messages 
        WHERE id = $1 AND session_id = $2
    """
    message = await db.fetchrow(message_query, message_id, session_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Message {message_id} not found in session {session_id}"
        )


async def persist_file_metadata(
    db: asyncpg.Connection,
    file_metadata: FileMetadata
) -> None:
    """
    Persist file metadata to database.
    
    Args:
        db: Database connection
        file_metadata: File metadata to persist
    """
    query = """
        INSERT INTO file_attachments (
            id, filename, content_type, size, hash, url,
            session_id, message_id, uploaded_at, scan_status, scan_result
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
    """
    
    await db.execute(
        query,
        file_metadata.id,
        file_metadata.filename,
        file_metadata.content_type,
        file_metadata.size,
        file_metadata.hash,
        file_metadata.url,
        file_metadata.session_id,
        file_metadata.message_id,
        file_metadata.uploaded_at,
        file_metadata.scan_status,
        file_metadata.scan_result
    )


@router.post("/upload", response_model=FileUploadResponse)
async def upload_files(
    files: List[UploadFile] = File(...),
    session_id: str = Form(...),
    message_id: str = Form(...),
    db: asyncpg.Connection = Depends(get_db),
    storage: S3Client = Depends(get_storage),
):
    """
    Upload files as chat message attachments.
    
    This endpoint handles multiple file uploads with the following process:
    1. Validate session and message existence
    2. For each file: validate type/size -> temp save -> scan -> hash -> upload -> persist metadata
    3. Return list of successful uploads and errors
    
    Args:
        files: List of files to upload
        session_id: Chat session ID
        message_id: Message ID to attach files to
        db: Database connection
        storage: S3 storage client
    
    Returns:
        FileUploadResponse with successful uploads and errors
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )
    
    # Initialize response
    successful_files: List[FileMetadata] = []
    upload_errors: List[FileUploadError] = []
    
    try:
        # 1. Validate session and message existence
        await validate_session_and_message(db, session_id, message_id)
        
        # Calculate total size for validation
        total_size = sum(file.size or 0 for file in files)
        is_valid_total, size_error = validate_total_size(total_size)
        if not is_valid_total:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=size_error
            )
        
        # 2. Process each file
        for file in files:
            try:
                await process_single_file(
                    file=file,
                    session_id=session_id,
                    message_id=message_id,
                    db=db,
                    storage=storage,
                    successful_files=successful_files,
                    upload_errors=upload_errors
                )
            except Exception as e:
                upload_errors.append(FileUploadError(
                    filename=file.filename or "unknown",
                    error=str(e),
                    code="processing_error"
                ))
        
        # 3. Return response
        return FileUploadResponse(
            files=successful_files,
            errors=upload_errors,
            total_files=len(files),
            successful_uploads=len(successful_files)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload processing failed: {str(e)}"
        )
    finally:
        await db.close()


async def process_single_file(
    file: UploadFile,
    session_id: str,
    message_id: str,
    db: asyncpg.Connection,
    storage: S3Client,
    successful_files: List[FileMetadata],
    upload_errors: List[FileUploadError]
) -> None:
    """
    Process a single file upload.
    
    Args:
        file: Uploaded file
        session_id: Chat session ID
        message_id: Message ID
        db: Database connection
        storage: Storage client
        successful_files: List to append successful uploads
        upload_errors: List to append errors
    """
    temp_file_path = None
    
    try:
        # Validate basic file info
        if not file.filename:
            upload_errors.append(FileUploadError(
                filename="unknown",
                error="Filename is required",
                code="invalid_filename"
            ))
            return
        
        if not file.size or file.size == 0:
            upload_errors.append(FileUploadError(
                filename=file.filename,
                error="Empty file not allowed",
                code="empty_file"
            ))
            return
        
        # Save to temporary file for processing
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file_path = temp_file.name
            content = await file.read()
            temp_file.write(content)
        
        # Reset file position for potential re-reading
        await file.seek(0)
        
        # Scan file for security issues
        scan_result = await scan_uploaded_file(temp_file_path, file.filename)
        if not scan_result.is_safe:
            upload_errors.append(FileUploadError(
                filename=file.filename,
                error=scan_result.reason,
                code="security_scan_failed"
            ))
            return
        
        # Detect content type
        content_type = detect_content_type(file.filename, temp_file_path)
        
        # Upload to storage
        storage_url = await storage.upload_file(
            file_path=temp_file_path,
            session_id=session_id,
            message_id=message_id,
            filename=file.filename,
            content_type=content_type
        )
        
        # Create file metadata
        file_metadata = FileMetadata(
            id=str(uuid.uuid4()),
            filename=file.filename,
            content_type=content_type,
            size=file.size,
            hash=scan_result.file_hash,
            url=storage_url,
            session_id=session_id,
            message_id=message_id,
            uploaded_at=datetime.utcnow(),
            scan_status="passed",
            scan_result=scan_result.reason
        )
        
        # Persist metadata to database
        await persist_file_metadata(db, file_metadata)
        
        # Add to successful files
        successful_files.append(file_metadata)
        
    except Exception as e:
        upload_errors.append(FileUploadError(
            filename=file.filename or "unknown",
            error=str(e),
            code="processing_error"
        ))
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except OSError:
                pass  # File cleanup failed, but don't crash


@router.get("/files/{session_id}", response_model=List[FileMetadata])
async def get_session_files(
    session_id: str,
    db: asyncpg.Connection = Depends(get_db)
):
    """
    Get all files for a chat session.
    
    Args:
        session_id: Chat session ID
        db: Database connection
    
    Returns:
        List of file metadata for the session
    """
    try:
        query = """
            SELECT id, filename, content_type, size, hash, url,
                   session_id, message_id, uploaded_at, scan_status, scan_result
            FROM file_attachments
            WHERE session_id = $1
            ORDER BY uploaded_at DESC
        """
        
        rows = await db.fetch(query, session_id)
        
        files = [
            FileMetadata(
                id=row['id'],
                filename=row['filename'],
                content_type=row['content_type'],
                size=row['size'],
                hash=row['hash'],
                url=row['url'],
                session_id=row['session_id'],
                message_id=row['message_id'],
                uploaded_at=row['uploaded_at'],
                scan_status=row['scan_status'],
                scan_result=row['scan_result']
            )
            for row in rows
        ]
        
        return files
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve files: {str(e)}"
        )
    finally:
        await db.close()
