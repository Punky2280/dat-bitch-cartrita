"""
S3 storage client for file uploads.
"""
import os
import uuid
from typing import Optional
from datetime import datetime, timedelta
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import aiofiles
from pathlib import Path


class S3Client:
    """S3 storage client for file uploads."""
    
    def __init__(self):
        """Initialize S3 client."""
        self.bucket_name = os.getenv("S3_BUCKET_NAME", "cartrita-uploads")
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.access_key = os.getenv("AWS_ACCESS_KEY_ID")
        self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.endpoint_url = os.getenv("S3_ENDPOINT_URL")  # For MinIO or other S3-compatible services
        
        # Initialize S3 client
        try:
            session = boto3.Session(
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region
            )
            
            self.s3_client = session.client(
                's3',
                endpoint_url=self.endpoint_url,
                region_name=self.region
            )
            
            # Test connection
            self._test_connection()
            
        except (ClientError, NoCredentialsError) as e:
            # Fallback to local storage if S3 not configured
            self.s3_client = None
            self._setup_local_storage()
            print(f"S3 not configured, using local storage: {e}")
    
    def _test_connection(self):
        """Test S3 connection and create bucket if needed."""
        if not self.s3_client:
            return
            
        try:
            # Check if bucket exists
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except ClientError as e:
            error_code = int(e.response['Error']['Code'])
            if error_code == 404:
                # Bucket doesn't exist, create it
                try:
                    if self.region == 'us-east-1':
                        self.s3_client.create_bucket(Bucket=self.bucket_name)
                    else:
                        self.s3_client.create_bucket(
                            Bucket=self.bucket_name,
                            CreateBucketConfiguration={'LocationConstraint': self.region}
                        )
                    print(f"Created S3 bucket: {self.bucket_name}")
                except ClientError as create_error:
                    print(f"Failed to create bucket: {create_error}")
                    self.s3_client = None
                    self._setup_local_storage()
            else:
                print(f"S3 connection error: {e}")
                self.s3_client = None
                self._setup_local_storage()
    
    def _setup_local_storage(self):
        """Setup local file storage as fallback."""
        self.local_storage_path = Path("uploads")
        self.local_storage_path.mkdir(exist_ok=True)
        print(f"Using local storage at: {self.local_storage_path.absolute()}")
    
    def generate_file_key(self, session_id: str, message_id: str, filename: str) -> str:
        """Generate S3 key for uploaded file."""
        # Create hierarchical structure: session/message/uuid_filename
        file_uuid = str(uuid.uuid4())
        safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-").rstrip()
        return f"sessions/{session_id}/messages/{message_id}/{file_uuid}_{safe_filename}"
    
    async def upload_file(
        self,
        file_path: str,
        session_id: str,
        message_id: str,
        filename: str,
        content_type: str
    ) -> str:
        """
        Upload file to S3 or local storage.
        
        Args:
            file_path: Local path to file to upload
            session_id: Chat session ID
            message_id: Message ID
            filename: Original filename
            content_type: MIME content type
        
        Returns:
            Storage URL for the uploaded file
        """
        file_key = self.generate_file_key(session_id, message_id, filename)
        
        if self.s3_client:
            return await self._upload_to_s3(file_path, file_key, content_type)
        else:
            return await self._upload_local(file_path, file_key)
    
    async def _upload_to_s3(self, file_path: str, file_key: str, content_type: str) -> str:
        """Upload file to S3."""
        try:
            extra_args = {
                'ContentType': content_type,
                'Metadata': {
                    'uploaded_at': datetime.utcnow().isoformat(),
                    'source': 'cartrita-chat'
                }
            }
            
            # Upload file
            self.s3_client.upload_file(
                file_path,
                self.bucket_name,
                file_key,
                ExtraArgs=extra_args
            )
            
            # Generate URL (using endpoint URL if configured, otherwise standard S3)
            if self.endpoint_url:
                url = f"{self.endpoint_url}/{self.bucket_name}/{file_key}"
            else:
                url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{file_key}"
            
            return url
            
        except ClientError as e:
            raise Exception(f"S3 upload failed: {e}")
    
    async def _upload_local(self, file_path: str, file_key: str) -> str:
        """Upload file to local storage."""
        try:
            # Create directory structure
            local_path = self.local_storage_path / file_key
            local_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Copy file
            async with aiofiles.open(file_path, 'rb') as src:
                async with aiofiles.open(local_path, 'wb') as dst:
                    content = await src.read()
                    await dst.write(content)
            
            # Return relative URL for local access
            return f"/uploads/{file_key}"
            
        except Exception as e:
            raise Exception(f"Local storage upload failed: {e}")
    
    def generate_presigned_url(self, file_key: str, expiration: int = 3600) -> Optional[str]:
        """
        Generate presigned URL for file access.
        
        Args:
            file_key: S3 key for the file
            expiration: URL expiration time in seconds
        
        Returns:
            Presigned URL or None if not available
        """
        if not self.s3_client:
            return None
        
        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': file_key},
                ExpiresIn=expiration
            )
            return response
        except ClientError:
            return None
    
    async def delete_file(self, file_key: str) -> bool:
        """
        Delete file from storage.
        
        Args:
            file_key: Storage key for the file
        
        Returns:
            True if successful, False otherwise
        """
        if self.s3_client:
            try:
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=file_key)
                return True
            except ClientError:
                return False
        else:
            try:
                local_path = self.local_storage_path / file_key
                if local_path.exists():
                    local_path.unlink()
                return True
            except Exception:
                return False


# Dependency for FastAPI
def get_storage() -> S3Client:
    """FastAPI dependency to get S3 client."""
    return S3Client()
