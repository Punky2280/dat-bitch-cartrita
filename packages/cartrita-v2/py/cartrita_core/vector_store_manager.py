"""
Cartrita V2 - OpenAI Vector Store & File Search Manager
Production implementation using OpenAI's native vector stores and file search capabilities
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Union, BinaryIO
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import mimetypes

from openai import AsyncOpenAI
try:
    from openai.types.beta.vector_stores import VectorStore
    from openai.types import FileObject
except ImportError:
    # Fallback for older OpenAI library versions
    VectorStore = Any
    FileObject = Any
from config import get_settings


class VectorStoreStatus(Enum):
    """Vector store lifecycle status"""
    CREATING = "creating"
    ACTIVE = "active" 
    EXPIRED = "expired"
    DELETING = "deleting"
    ERROR = "error"


class FileStatus(Enum):
    """File processing status in vector stores"""
    UPLOADING = "uploading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class VectorStoreConfig:
    """Configuration for vector store creation"""
    name: str
    description: str
    expires_after_hours: Optional[int] = 24
    chunking_strategy: str = "auto"  # "auto" | "static"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass 
class FileMetadata:
    """Metadata for files in vector stores"""
    file_id: str
    filename: str
    size_bytes: int
    mime_type: str
    upload_time: datetime
    vector_store_ids: List[str] = field(default_factory=list)
    processing_status: FileStatus = FileStatus.UPLOADING
    chunk_count: Optional[int] = None
    error_message: Optional[str] = None


class VectorStoreManager:
    """
    Production vector store manager for Cartrita V2
    Manages OpenAI vector stores, file uploads, and search capabilities
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        logger: Optional[logging.Logger] = None,
        max_stores: int = 50,
        max_files_per_store: int = 10000
    ):
        # Initialize OpenAI client
        if api_key is None:
            settings = get_settings()
            openai_settings = settings["openai"]
            self.client = AsyncOpenAI(**openai_settings.client_kwargs())
        else:
            self.client = AsyncOpenAI(api_key=api_key)
        
        self.logger = logger or logging.getLogger("cartrita.vector_store")
        self.max_stores = max_stores
        self.max_files_per_store = max_files_per_store
        
        # Local tracking
        self.vector_stores: Dict[str, VectorStore] = {}
        self.file_metadata: Dict[str, FileMetadata] = {}
        self.store_configs: Dict[str, VectorStoreConfig] = {}
        
        # Performance and usage tracking
        self.stats = {
            "stores_created": 0,
            "stores_deleted": 0, 
            "files_uploaded": 0,
            "search_queries": 0,
            "total_storage_bytes": 0,
            "last_cleanup": None
        }
    
    async def create_vector_store(
        self,
        config: VectorStoreConfig
    ) -> Optional[str]:
        """
        Create a new OpenAI vector store
        
        Args:
            config: Vector store configuration
            
        Returns:
            Vector store ID if successful, None otherwise
        """
        try:
            # Check store limits
            if len(self.vector_stores) >= self.max_stores:
                await self._cleanup_expired_stores()
                if len(self.vector_stores) >= self.max_stores:
                    self.logger.warning(f"Vector store limit reached ({self.max_stores})")
                    return None
            
            # Prepare creation parameters
            create_params = {
                "name": config.name,
                "metadata": {
                    "description": config.description,
                    "created_by": "cartrita_v2",
                    "created_at": datetime.now().isoformat(),
                    **config.metadata
                }
            }
            
            # Set expiration if specified
            if config.expires_after_hours:
                expires_after = {
                    "anchor": "created_at",
                    "days": max(1, config.expires_after_hours // 24)
                }
                create_params["expires_after"] = expires_after
            
            # Configure chunking strategy
            if config.chunking_strategy == "static":
                create_params["chunking_strategy"] = {
                    "type": "static",
                    "static": {
                        "max_chunk_size_tokens": config.chunk_size,
                        "chunk_overlap_tokens": config.chunk_overlap
                    }
                }
            else:
                # Use OpenAI's auto chunking
                create_params["chunking_strategy"] = {"type": "auto"}
            
            # Create the vector store
            vector_store = await self.client.beta.vector_stores.create(**create_params)
            
            # Track locally
            self.vector_stores[vector_store.id] = vector_store
            self.store_configs[vector_store.id] = config
            self.stats["stores_created"] += 1
            
            self.logger.info(f"Created vector store: {vector_store.id} ({config.name})")
            return vector_store.id
            
        except Exception as e:
            self.logger.error(f"Error creating vector store: {e}")
            return None
    
    async def upload_file(
        self,
        file_path: Union[str, Path],
        vector_store_id: Optional[str] = None,
        filename: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Upload file to OpenAI and optionally add to vector store
        
        Args:
            file_path: Path to file to upload
            vector_store_id: Vector store to add file to (optional)
            filename: Override filename (optional)
            metadata: Additional metadata for the file
            
        Returns:
            File ID if successful, None otherwise
        """
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                self.logger.error(f"File not found: {file_path}")
                return None
            
            # Get file info
            file_size = file_path.stat().st_size
            mime_type, _ = mimetypes.guess_type(str(file_path))
            if mime_type is None:
                mime_type = "application/octet-stream"
            
            actual_filename = filename or file_path.name
            
            # Check file size limits (OpenAI has limits per file type)
            max_size_mb = self._get_max_file_size(mime_type)
            if file_size > max_size_mb * 1024 * 1024:
                self.logger.error(f"File too large: {file_size} bytes (max: {max_size_mb}MB)")
                return None
            
            # Upload file
            with open(file_path, "rb") as f:
                file_obj = await self.client.files.create(
                    file=f,
                    purpose="assistants"
                )
            
            # Track metadata
            file_meta = FileMetadata(
                file_id=file_obj.id,
                filename=actual_filename,
                size_bytes=file_size,
                mime_type=mime_type,
                upload_time=datetime.now(),
                processing_status=FileStatus.UPLOADING
            )
            
            # Add to vector store if specified
            if vector_store_id and vector_store_id in self.vector_stores:
                await self._add_file_to_vector_store(file_obj.id, vector_store_id)
                file_meta.vector_store_ids.append(vector_store_id)
            
            self.file_metadata[file_obj.id] = file_meta
            self.stats["files_uploaded"] += 1
            self.stats["total_storage_bytes"] += file_size
            
            self.logger.info(f"Uploaded file: {file_obj.id} ({actual_filename}, {file_size} bytes)")
            return file_obj.id
            
        except Exception as e:
            self.logger.error(f"Error uploading file: {e}")
            return None
    
    async def _add_file_to_vector_store(self, file_id: str, vector_store_id: str):
        """Add an uploaded file to a vector store"""
        try:
            await self.client.beta.vector_stores.files.create(
                vector_store_id=vector_store_id,
                file_id=file_id
            )
            
            # Wait for processing to start
            await asyncio.sleep(1)
            
            # Update file status
            if file_id in self.file_metadata:
                self.file_metadata[file_id].processing_status = FileStatus.PROCESSING
            
        except Exception as e:
            self.logger.error(f"Error adding file to vector store: {e}")
            if file_id in self.file_metadata:
                self.file_metadata[file_id].processing_status = FileStatus.FAILED
                self.file_metadata[file_id].error_message = str(e)
    
    async def upload_documents_batch(
        self,
        documents: List[Dict[str, Any]],
        vector_store_id: str,
        batch_size: int = 5
    ) -> List[str]:
        """
        Upload multiple documents to a vector store in batches
        
        Args:
            documents: List of document dicts with 'content' and optional 'filename'
            vector_store_id: Target vector store
            batch_size: Number of concurrent uploads
            
        Returns:
            List of successfully uploaded file IDs
        """
        if vector_store_id not in self.vector_stores:
            self.logger.error(f"Vector store not found: {vector_store_id}")
            return []
        
        uploaded_files = []
        
        # Process in batches to avoid rate limits
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            
            # Create temporary files and upload
            tasks = []
            for doc in batch:
                tasks.append(self._upload_document_content(doc, vector_store_id))
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Collect successful uploads
            for result in batch_results:
                if isinstance(result, str):  # File ID
                    uploaded_files.append(result)
                elif isinstance(result, Exception):
                    self.logger.warning(f"Document upload failed: {result}")
            
            # Rate limiting between batches
            if i + batch_size < len(documents):
                await asyncio.sleep(1)
        
        self.logger.info(f"Uploaded {len(uploaded_files)}/{len(documents)} documents to {vector_store_id}")
        return uploaded_files
    
    async def _upload_document_content(
        self, 
        document: Dict[str, Any], 
        vector_store_id: str
    ) -> Optional[str]:
        """Upload document content as a temporary file"""
        try:
            content = document.get("content", "")
            filename = document.get("filename", f"doc_{int(time.time())}.txt")
            
            if not content:
                return None
            
            # Create temporary file
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as tmp_file:
                tmp_file.write(content)
                tmp_path = tmp_file.name
            
            try:
                # Upload the temporary file
                file_id = await self.upload_file(tmp_path, vector_store_id, filename)
                return file_id
            finally:
                # Clean up temporary file
                Path(tmp_path).unlink(missing_ok=True)
                
        except Exception as e:
            self.logger.error(f"Error uploading document content: {e}")
            return None
    
    async def search(
        self,
        query: str,
        vector_store_ids: Optional[List[str]] = None,
        max_results: int = 4,
        min_score: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        Search across vector stores using OpenAI's file search
        
        Args:
            query: Search query
            vector_store_ids: Specific stores to search (defaults to all active stores)
            max_results: Maximum number of results per store
            min_score: Minimum relevance score threshold
            
        Returns:
            List of search results with content and metadata
        """
        try:
            self.stats["search_queries"] += 1
            
            # Use all active stores if none specified
            if vector_store_ids is None:
                vector_store_ids = list(self.vector_stores.keys())
            
            # Filter to existing stores
            valid_store_ids = [
                store_id for store_id in vector_store_ids 
                if store_id in self.vector_stores
            ]
            
            if not valid_store_ids:
                self.logger.warning("No valid vector stores for search")
                return []
            
            # Create a temporary assistant for search
            assistant = await self.client.beta.assistants.create(
                name="Cartrita Search Assistant",
                instructions="Oye, you're helping search through Cartrita's knowledge base. Encuentra la información más relevante para el usuario.",
                model="gpt-5-mini",  # Efficient model for search
                tools=[{"type": "file_search"}],
                tool_resources={
                    "file_search": {
                        "vector_store_ids": valid_store_ids
                    }
                }
            )
            
            try:
                # Create thread and run search
                thread = await self.client.beta.threads.create()
                
                await self.client.beta.threads.messages.create(
                    thread_id=thread.id,
                    role="user",
                    content=query
                )
                
                run = await self.client.beta.threads.runs.create(
                    thread_id=thread.id,
                    assistant_id=assistant.id,
                    max_completion_tokens=1000
                )
                
                # Poll for completion
                while run.status in ["queued", "in_progress"]:
                    await asyncio.sleep(0.5)
                    run = await self.client.beta.threads.runs.retrieve(
                        thread_id=thread.id,
                        run_id=run.id
                    )
                
                if run.status == "completed":
                    # Get the response
                    messages = await self.client.beta.threads.messages.list(
                        thread_id=thread.id,
                        order="desc",
                        limit=1
                    )
                    
                    results = []
                    if messages.data:
                        message = messages.data[0]
                        
                        # Extract content and citations
                        for content_block in message.content:
                            if hasattr(content_block, 'text'):
                                text_content = content_block.text.value
                                
                                # Extract file citations
                                citations = []
                                if hasattr(content_block.text, 'annotations'):
                                    for annotation in content_block.text.annotations:
                                        if hasattr(annotation, 'file_citation'):
                                            citation = annotation.file_citation
                                            citations.append({
                                                "file_id": citation.file_id,
                                                "quote": getattr(citation, 'quote', ''),
                                                "start_index": annotation.start_index,
                                                "end_index": annotation.end_index
                                            })
                                
                                results.append({
                                    "content": text_content,
                                    "citations": citations,
                                    "query": query,
                                    "search_time": datetime.now().isoformat(),
                                    "vector_stores_searched": valid_store_ids
                                })
                    
                    # Clean up thread
                    await self.client.beta.threads.delete(thread.id)
                    
                    self.logger.info(f"Search completed: {len(results)} results for query '{query[:50]}...'")
                    return results
                
                else:
                    self.logger.error(f"Search run failed with status: {run.status}")
                    return []
                    
            finally:
                # Clean up assistant
                await self.client.beta.assistants.delete(assistant.id)
                
        except Exception as e:
            self.logger.error(f"Search error: {e}")
            return []
    
    async def get_vector_store_status(self, vector_store_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed status of a vector store"""
        if vector_store_id not in self.vector_stores:
            return None
        
        try:
            # Refresh store info from API
            store = await self.client.beta.vector_stores.retrieve(vector_store_id)
            self.vector_stores[vector_store_id] = store
            
            # Get file count and status
            files_list = await self.client.beta.vector_stores.files.list(
                vector_store_id=vector_store_id,
                limit=100  # May need pagination for large stores
            )
            
            file_statuses = {}
            total_files = len(files_list.data)
            
            for file_obj in files_list.data:
                status = file_obj.status
                if status not in file_statuses:
                    file_statuses[status] = 0
                file_statuses[status] += 1
            
            return {
                "id": store.id,
                "name": store.name,
                "status": store.status,
                "file_counts": {
                    "total": total_files,
                    "by_status": file_statuses
                },
                "usage_bytes": getattr(store, 'usage_bytes', 0),
                "created_at": store.created_at,
                "expires_at": getattr(store, 'expires_at', None),
                "metadata": store.metadata or {}
            }
            
        except Exception as e:
            self.logger.error(f"Error getting vector store status: {e}")
            return None
    
    async def delete_vector_store(self, vector_store_id: str, force: bool = False) -> bool:
        """Delete a vector store and all its files"""
        if vector_store_id not in self.vector_stores:
            self.logger.warning(f"Vector store not found: {vector_store_id}")
            return False
        
        try:
            # Get store info for cleanup tracking
            config = self.store_configs.get(vector_store_id)
            store_name = config.name if config else vector_store_id
            
            if not force:
                # Check if store has important data
                status = await self.get_vector_store_status(vector_store_id)
                if status and status["file_counts"]["total"] > 0:
                    self.logger.warning(f"Vector store {store_name} contains files, use force=True to delete")
                    return False
            
            # Delete the vector store (this also deletes associated files)
            await self.client.beta.vector_stores.delete(vector_store_id)
            
            # Clean up local tracking
            del self.vector_stores[vector_store_id]
            if vector_store_id in self.store_configs:
                del self.store_configs[vector_store_id]
            
            # Clean up file metadata
            files_to_remove = [
                file_id for file_id, meta in self.file_metadata.items()
                if vector_store_id in meta.vector_store_ids
            ]
            
            for file_id in files_to_remove:
                self.file_metadata[file_id].vector_store_ids.remove(vector_store_id)
                if not self.file_metadata[file_id].vector_store_ids:
                    del self.file_metadata[file_id]
            
            self.stats["stores_deleted"] += 1
            self.logger.info(f"Deleted vector store: {vector_store_id} ({store_name})")
            return True
            
        except Exception as e:
            self.logger.error(f"Error deleting vector store: {e}")
            return False
    
    async def _cleanup_expired_stores(self):
        """Clean up expired vector stores"""
        try:
            current_time = datetime.now()
            expired_stores = []
            
            for store_id, store in self.vector_stores.items():
                if hasattr(store, 'expires_at') and store.expires_at:
                    expires_at = datetime.fromtimestamp(store.expires_at)
                    if current_time > expires_at:
                        expired_stores.append(store_id)
            
            # Delete expired stores
            for store_id in expired_stores:
                await self.delete_vector_store(store_id, force=True)
            
            if expired_stores:
                self.logger.info(f"Cleaned up {len(expired_stores)} expired vector stores")
            
            self.stats["last_cleanup"] = current_time.isoformat()
            
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")
    
    def _get_max_file_size(self, mime_type: str) -> int:
        """Get maximum file size in MB based on file type"""
        # OpenAI limits (as of current API)
        if mime_type.startswith("text/"):
            return 512  # 512MB for text files
        elif mime_type in ["application/pdf"]:
            return 512  # 512MB for PDFs
        elif mime_type.startswith("image/"):
            return 20   # 20MB for images
        else:
            return 512  # Default limit
    
    def get_stats(self) -> Dict[str, Any]:
        """Get vector store manager statistics"""
        active_stores = len([s for s in self.vector_stores.values() if s.status == "completed"])
        total_files = len(self.file_metadata)
        
        return {
            **self.stats,
            "active_vector_stores": active_stores,
            "total_vector_stores": len(self.vector_stores),
            "total_files_tracked": total_files,
            "storage_mb": round(self.stats["total_storage_bytes"] / (1024 * 1024), 2)
        }


# Global vector store manager instance
_vector_store_manager: Optional[VectorStoreManager] = None


def get_vector_store_manager() -> VectorStoreManager:
    """Get global vector store manager instance"""
    global _vector_store_manager
    if _vector_store_manager is None:
        _vector_store_manager = VectorStoreManager()
    return _vector_store_manager


def initialize_vector_store_manager(
    api_key: Optional[str] = None,
    logger: Optional[logging.Logger] = None,
    **kwargs
) -> VectorStoreManager:
    """Initialize global vector store manager"""
    global _vector_store_manager
    _vector_store_manager = VectorStoreManager(api_key=api_key, logger=logger, **kwargs)
    return _vector_store_manager