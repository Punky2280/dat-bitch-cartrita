"""
File security scanning utilities.
"""
import hashlib
import mimetypes
import os
from typing import Tuple, Optional
from pathlib import Path

# File type restrictions
ALLOWED_EXTENSIONS = {
    # Documents
    '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf',
    # Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    # Audio/Video
    '.mp3', '.wav', '.mp4', '.avi', '.mov', '.webm',
    # Data
    '.csv', '.json', '.xml', '.yaml', '.yml',
    # Code
    '.py', '.js', '.ts', '.html', '.css', '.sql'
}

DANGEROUS_EXTENSIONS = {
    '.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.jar',
    '.sh', '.ps1', '.vbs', '.js', '.jse', '.wsf', '.wsh'
}

# Size limits (in bytes)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_TOTAL_SIZE = 200 * 1024 * 1024  # 200MB total per upload


class FileScanResult:
    """File scan result container."""
    
    def __init__(self, is_safe: bool, reason: str = "", file_hash: str = ""):
        self.is_safe = is_safe
        self.reason = reason
        self.file_hash = file_hash


def get_file_hash(file_path: str) -> str:
    """Calculate SHA-256 hash of file."""
    hash_sha256 = hashlib.sha256()
    
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    
    return hash_sha256.hexdigest()


def detect_content_type(filename: str, file_path: str) -> str:
    """Detect MIME content type from filename and file content."""
    # First try to guess from filename
    content_type, _ = mimetypes.guess_type(filename)
    
    if content_type:
        return content_type
    
    # Fallback for unknown types
    return "application/octet-stream"


def validate_file_type(filename: str) -> Tuple[bool, str]:
    """Validate file type based on extension."""
    file_ext = Path(filename).suffix.lower()
    
    if file_ext in DANGEROUS_EXTENSIONS:
        return False, f"Dangerous file type: {file_ext}"
    
    if file_ext not in ALLOWED_EXTENSIONS and file_ext != '':
        return False, f"File type not allowed: {file_ext}"
    
    return True, ""


def validate_file_size(file_size: int) -> Tuple[bool, str]:
    """Validate individual file size."""
    if file_size > MAX_FILE_SIZE:
        return False, f"File too large: {file_size} bytes (max: {MAX_FILE_SIZE})"
    
    if file_size == 0:
        return False, "Empty file not allowed"
    
    return True, ""


def validate_total_size(total_size: int) -> Tuple[bool, str]:
    """Validate total upload size."""
    if total_size > MAX_TOTAL_SIZE:
        return False, f"Total upload too large: {total_size} bytes (max: {MAX_TOTAL_SIZE})"
    
    return True, ""


def basic_malware_scan(file_path: str, filename: str) -> FileScanResult:
    """
    Perform basic malware scanning checks.
    
    This is a simplified implementation. In production, you would integrate
    with services like ClamAV, VirusTotal, or cloud scanning services.
    """
    try:
        # Check file extension
        is_valid_type, type_error = validate_file_type(filename)
        if not is_valid_type:
            return FileScanResult(False, type_error)
        
        # Get file size
        file_size = os.path.getsize(file_path)
        is_valid_size, size_error = validate_file_size(file_size)
        if not is_valid_size:
            return FileScanResult(False, size_error)
        
        # Calculate file hash
        file_hash = get_file_hash(file_path)
        
        # Basic content checks (looking for obvious malicious patterns)
        with open(file_path, 'rb') as f:
            # Read first 1KB for header analysis
            header = f.read(1024)
            
            # Check for executable signatures
            if header.startswith(b'MZ'):  # Windows PE
                return FileScanResult(False, "Windows executable detected", file_hash)
            
            if header.startswith(b'\x7fELF'):  # Linux ELF
                return FileScanResult(False, "Linux executable detected", file_hash)
            
            # Check for script shebangs in non-script files
            if header.startswith(b'#!') and not filename.endswith(('.py', '.sh', '.pl')):
                return FileScanResult(False, "Suspicious script header", file_hash)
        
        return FileScanResult(True, "File passed basic security checks", file_hash)
        
    except Exception as e:
        return FileScanResult(False, f"Scan error: {str(e)}")


async def scan_uploaded_file(file_path: str, filename: str) -> FileScanResult:
    """
    Async wrapper for file scanning.
    
    Args:
        file_path: Path to the uploaded file
        filename: Original filename
    
    Returns:
        FileScanResult with scan status and details
    """
    # In a real implementation, this might call external services
    # For now, we'll use the basic scan
    return basic_malware_scan(file_path, filename)
