"""
Tests for file upload functionality.
"""

import asyncio
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import UploadFile
from fastapi.testclient import TestClient
from io import BytesIO

from ..api.chat.upload import (
    upload_files,
    validate_session_and_message,
    persist_file_metadata,
    process_single_file
)
from ..models.file_metadata import FileMetadata, FileUploadResponse, FileUploadError
from ..storage.s3 import S3Client
from ..utils.file_scan import (
    validate_file_type,
    validate_file_size,
    validate_total_size,
    basic_malware_scan,
    get_file_hash
)


class TestFileScanning:
    """Test file scanning utilities."""
    
    def test_validate_file_type_allowed(self):
        """Test validation of allowed file types."""
        valid, error = validate_file_type("document.pdf")
        assert valid is True
        assert error == ""
        
        valid, error = validate_file_type("image.jpg")
        assert valid is True
        assert error == ""
    
    def test_validate_file_type_dangerous(self):
        """Test validation rejects dangerous file types."""
        valid, error = validate_file_type("malware.exe")
        assert valid is False
        assert "Dangerous file type" in error
        
        valid, error = validate_file_type("script.bat")
        assert valid is False
        assert "Dangerous file type" in error
    
    def test_validate_file_type_unknown(self):
        """Test validation of unknown file types."""
        valid, error = validate_file_type("unknown.xyz")
        assert valid is False
        assert "File type not allowed" in error
    
    def test_validate_file_size_valid(self):
        """Test file size validation for valid sizes."""
        valid, error = validate_file_size(1024)  # 1KB
        assert valid is True
        assert error == ""
        
        valid, error = validate_file_size(10 * 1024 * 1024)  # 10MB
        assert valid is True
        assert error == ""
    
    def test_validate_file_size_too_large(self):
        """Test file size validation for oversized files."""
        valid, error = validate_file_size(100 * 1024 * 1024)  # 100MB
        assert valid is False
        assert "File too large" in error
    
    def test_validate_file_size_empty(self):
        """Test file size validation for empty files."""
        valid, error = validate_file_size(0)
        assert valid is False
        assert "Empty file not allowed" in error
    
    def test_validate_total_size(self):
        """Test total upload size validation."""
        valid, error = validate_total_size(100 * 1024 * 1024)  # 100MB
        assert valid is True
        assert error == ""
        
        valid, error = validate_total_size(300 * 1024 * 1024)  # 300MB
        assert valid is False
        assert "Total upload too large" in error
    
    def test_basic_malware_scan_safe_file(self):
        """Test malware scanning for safe files."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is a safe text file.")
            f.flush()
            
            result = basic_malware_scan(f.name, "test.txt")
            assert result.is_safe is True
            assert "passed basic security checks" in result.reason
            assert len(result.file_hash) == 64  # SHA-256 hex string
    
    def test_basic_malware_scan_executable(self):
        """Test malware scanning detects executables."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b'MZ\x90\x00')  # Windows PE header
            f.flush()
            
            result = basic_malware_scan(f.name, "test.exe")
            assert result.is_safe is False
            assert "Windows executable detected" in result.reason
    
    def test_get_file_hash(self):
        """Test file hash calculation."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            f.write("test content")
            f.flush()
            
            hash1 = get_file_hash(f.name)
            hash2 = get_file_hash(f.name)
            
            # Same content should produce same hash
            assert hash1 == hash2
            assert len(hash1) == 64  # SHA-256 hex string


class TestS3Client:
    """Test S3 storage client."""
    
    def test_generate_file_key(self):
        """Test file key generation."""
        client = S3Client()
        key = client.generate_file_key("session123", "msg456", "test.pdf")
        
        assert "sessions/session123/messages/msg456" in key
        assert "test.pdf" in key
        assert len(key.split("/")) == 4  # sessions/session_id/messages/message_id/uuid_filename
    
    @pytest.mark.asyncio
    async def test_upload_local_fallback(self):
        """Test local storage fallback."""
        with patch.object(S3Client, '__init__', lambda x: setattr(x, 's3_client', None) or setattr(x, 'local_storage_path', Path('test_uploads'))):
            client = S3Client()
            client.local_storage_path = Path('test_uploads')
            client.local_storage_path.mkdir(exist_ok=True)
            
            with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_file:
                temp_file.write("test content")
                temp_file.flush()
                
                url = await client.upload_file(
                    temp_file.name,
                    "session123",
                    "msg456",
                    "test.txt",
                    "text/plain"
                )
                
                assert url.startswith("/uploads/")
                assert "session123" in url
                assert "msg456" in url


class TestUploadModels:
    """Test Pydantic models."""
    
    def test_file_metadata_model(self):
        """Test FileMetadata model validation."""
        metadata = FileMetadata(
            id=str(uuid.uuid4()),
            filename="test.pdf",
            content_type="application/pdf",
            size=1024,
            hash="abc123",
            url="https://example.com/file",
            session_id="session123",
            message_id="msg456",
            uploaded_at=datetime.now(timezone.utc),
            scan_status="passed",
            scan_result="File is safe",
        )

        assert metadata.filename == "test.pdf"
        assert metadata.size == 1024
        assert metadata.scan_status == "passed"
    
    def test_upload_response_model(self):
        """Test FileUploadResponse model."""
        response = FileUploadResponse(
            files=[],
            errors=[],
            total_files=1,
            successful_uploads=0
        )
        
        assert response.total_files == 1
        assert response.successful_uploads == 0
        assert len(response.files) == 0
        assert len(response.errors) == 0
    
    def test_upload_error_model(self):
        """Test FileUploadError model."""
        error = FileUploadError(
            filename="bad_file.exe",
            error="Dangerous file type",
            code="security_scan_failed"
        )
        
        assert error.filename == "bad_file.exe"
        assert error.code == "security_scan_failed"


class TestUploadAPI:
    """Test upload API functionality."""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database connection."""
        db = AsyncMock()
        db.fetchrow.return_value = {"id": "session123"}  # Mock session/message exists
        return db
    
    @pytest.fixture
    def mock_storage(self):
        """Mock S3 storage client."""
        storage = MagicMock()
        storage.upload_file = AsyncMock(return_value="https://example.com/file")
        return storage
    
    def create_mock_upload_file(self, filename: str, content: bytes, size: int = None):
        """Create mock UploadFile."""
        file = MagicMock(spec=UploadFile)
        file.filename = filename
        file.size = size or len(content)
        file.read = AsyncMock(return_value=content)
        file.seek = AsyncMock()
        return file
    
    @pytest.mark.asyncio
    async def test_validate_session_and_message_success(self, mock_db):
        """Test successful session and message validation."""
        mock_db.fetchrow.side_effect = [
            {"id": "session123"},  # Session exists
            {"id": "msg456"}       # Message exists
        ]
        
        # Should not raise exception
        await validate_session_and_message(mock_db, "session123", "msg456")
    
    @pytest.mark.asyncio
    async def test_validate_session_and_message_session_not_found(self, mock_db):
        """Test session validation when session doesn't exist."""
        mock_db.fetchrow.side_effect = [None]  # Session doesn't exist
        
        with pytest.raises(Exception) as exc_info:
            await validate_session_and_message(mock_db, "invalid_session", "msg456")
        
        assert "not found" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_persist_file_metadata(self, mock_db):
        """Test file metadata persistence."""
        metadata = FileMetadata(
            id=str(uuid.uuid4()),
            filename="test.pdf",
            content_type="application/pdf",
            size=1024,
            hash="abc123",
            url="https://example.com/file",
            session_id="session123",
            message_id="msg456",
            uploaded_at=datetime.utcnow(),
            scan_status="passed",
            scan_result="Safe file"
        )
        
        await persist_file_metadata(mock_db, metadata)
        
        # Check that database execute was called
        mock_db.execute.assert_called_once()
        call_args = mock_db.execute.call_args
        assert "INSERT INTO file_attachments" in call_args[0][0]
    
    @pytest.mark.asyncio
    async def test_process_single_file_success(self, mock_db, mock_storage):
        """Test successful single file processing."""
        successful_files = []
        upload_errors = []
        
        # Create mock file
        file_content = b"This is test content"
        mock_file = self.create_mock_upload_file("test.txt", file_content)
        
        with patch('tempfile.NamedTemporaryFile') as mock_temp:
            mock_temp.return_value.__enter__.return_value.name = "/tmp/test"
            mock_temp.return_value.__enter__.return_value.write = MagicMock()
            
            with patch('builtins.open', create=True) as mock_open:
                with patch('os.path.getsize', return_value=len(file_content)):
                    with patch('os.path.exists', return_value=True):
                        with patch('os.unlink') as mock_unlink:
                            with patch('..utils.file_scan.basic_malware_scan') as mock_scan:
                                # Mock successful scan
                                mock_scan_result = MagicMock()
                                mock_scan_result.is_safe = True
                                mock_scan_result.reason = "File is safe"
                                mock_scan_result.file_hash = "abc123"
                                mock_scan.return_value = mock_scan_result
                                
                                await process_single_file(
                                    mock_file,
                                    "session123",
                                    "msg456",
                                    mock_db,
                                    mock_storage,
                                    successful_files,
                                    upload_errors
                                )
        
        assert len(successful_files) == 1
        assert len(upload_errors) == 0
        assert successful_files[0].filename == "test.txt"
    
    @pytest.mark.asyncio
    async def test_process_single_file_scan_failure(self, mock_db, mock_storage):
        """Test single file processing when security scan fails."""
        successful_files = []
        upload_errors = []
        
        # Create mock file
        file_content = b"Suspicious content"
        mock_file = self.create_mock_upload_file("suspicious.exe", file_content)
        
        with patch('tempfile.NamedTemporaryFile') as mock_temp:
            mock_temp.return_value.__enter__.return_value.name = "/tmp/test"
            mock_temp.return_value.__enter__.return_value.write = MagicMock()
            
            with patch('builtins.open', create=True):
                with patch('os.path.getsize', return_value=len(file_content)):
                    with patch('os.path.exists', return_value=True):
                        with patch('os.unlink'):
                            with patch('..utils.file_scan.basic_malware_scan') as mock_scan:
                                # Mock failed scan
                                mock_scan_result = MagicMock()
                                mock_scan_result.is_safe = False
                                mock_scan_result.reason = "Dangerous file detected"
                                mock_scan.return_value = mock_scan_result
                                
                                await process_single_file(
                                    mock_file,
                                    "session123",
                                    "msg456",
                                    mock_db,
                                    mock_storage,
                                    successful_files,
                                    upload_errors
                                )
        
        assert len(successful_files) == 0
        assert len(upload_errors) == 1
        assert upload_errors[0].filename == "suspicious.exe"
        assert "security_scan_failed" in upload_errors[0].code


if __name__ == "__main__":
    pytest.main([__file__])