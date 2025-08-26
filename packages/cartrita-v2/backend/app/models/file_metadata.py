"""
File metadata models for chat attachments.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class FileMetadata(BaseModel):
    """File metadata response model."""
    
    id: str = Field(..., description="Unique file identifier")
    filename: str = Field(..., description="Original filename")
    content_type: str = Field(..., description="MIME content type")
    size: int = Field(..., description="File size in bytes")
    hash: str = Field(..., description="SHA-256 hash of file content")
    url: str = Field(..., description="Storage URL for file access")
    session_id: str = Field(..., description="Chat session ID")
    message_id: str = Field(..., description="Message ID this file belongs to")
    uploaded_at: datetime = Field(..., description="Upload timestamp")
    scan_status: str = Field(default="pending", description="Security scan status")
    scan_result: Optional[str] = Field(default=None, description="Scan result details")


class FileUploadRequest(BaseModel):
    """File upload request model."""
    
    session_id: str = Field(..., description="Chat session ID")
    message_id: str = Field(..., description="Message ID to attach files to")


class FileUploadError(BaseModel):
    """File upload error model."""
    
    filename: str = Field(..., description="Filename that failed")
    error: str = Field(..., description="Error message")
    code: str = Field(..., description="Error code")


class FileUploadResponse(BaseModel):
    """File upload response model."""
    
    files: list[FileMetadata] = Field(default_factory=list, description="Successfully uploaded files")
    errors: list[FileUploadError] = Field(default_factory=list, description="Upload errors")
    total_files: int = Field(..., description="Total files attempted")
    successful_uploads: int = Field(..., description="Number of successful uploads")
