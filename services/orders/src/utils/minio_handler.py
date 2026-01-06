"""
MinIO S3 storage handler for file uploads
"""
import os
import hashlib
from typing import Tuple, Optional
from uuid import uuid4
from datetime import timedelta
from fastapi import UploadFile, HTTPException, status
from fastapi.responses import FileResponse
from minio import Minio
from minio.error import S3Error

from src.config import settings


class MinIOHandler:
    """Utility class for handling MinIO S3 operations"""

    def __init__(self):
        self.minio_client = None
        self.bucket_name = "order-documents"
        self.max_file_size = settings.MAX_FILE_SIZE
        self.allowed_file_types = settings.ALLOWED_FILE_TYPES

        # Initialize MinIO client
        self._initialize_client()

    def _initialize_client(self):
        """Initialize MinIO client"""
        try:
            # Get MinIO credentials from config or environment
            minio_endpoint = os.getenv("MINIO_ENDPOINT", settings.MINIO_ENDPOINT)
            minio_access_key = os.getenv("MINIO_ROOT_USER", settings.MINIO_ROOT_USER)
            minio_secret_key = os.getenv("MINIO_ROOT_PASSWORD", settings.MINIO_ROOT_PASSWORD)
            minio_secure = os.getenv("MINIO_SECURE", str(settings.MINIO_SECURE)).lower() == "true"

            self.minio_client = Minio(
                endpoint=minio_endpoint,
                access_key=minio_access_key,
                secret_key=minio_secret_key,
                secure=minio_secure
            )

            # Create bucket if it doesn't exist
            self._ensure_bucket_exists()

        except Exception as e:
            # Log error but don't fail startup - will retry on operations
            print(f"Warning: Failed to initialize MinIO client: {str(e)}")

    def _ensure_bucket_exists(self):
        """Ensure the bucket exists, create if not"""
        try:
            if not self.minio_client.bucket_exists(self.bucket_name):
                self.minio_client.make_bucket(self.bucket_name)
                # Set bucket policy for public read (optional, adjust as needed)
                # For now, we'll use presigned URLs for secure access
                print(f"Created MinIO bucket: {self.bucket_name}")
        except S3Error as e:
            print(f"Error ensuring bucket exists: {str(e)}")

    def is_allowed_file_type(self, mime_type: str) -> bool:
        """Check if file type is allowed"""
        return mime_type in self.allowed_file_types

    def is_valid_file_size(self, file_size: int) -> bool:
        """Check if file size is within limits"""
        return file_size <= self.max_file_size

    async def save_file(self, file: UploadFile, order_id: str) -> Tuple[str, str]:
        """
        Save uploaded file to MinIO and return object path and hash

        Args:
            file: UploadFile object from FastAPI
            order_id: Order ID for organizing files

        Returns:
            Tuple of (object_path, file_hash)
        """
        if not self.minio_client:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MinIO client not initialized"
            )

        try:
            # Read file content
            file_content = await file.read()

            # Calculate file hash
            sha256_hash = hashlib.sha256()
            sha256_hash.update(file_content)
            file_hash = sha256_hash.hexdigest()

            # Generate unique filename
            file_extension = os.path.splitext(file.filename)[1]
            unique_filename = f"{uuid4()}{file_extension}"

            # Create object path with order_id prefix for organization
            object_path = f"orders/{order_id}/{unique_filename}"

            # Upload to MinIO
            from io import BytesIO
            self.minio_client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_path,
                data=BytesIO(file_content),
                length=len(file_content),
                content_type=file.content_type
            )

            # Reset file pointer
            await file.seek(0)

            return object_path, file_hash

        except S3Error as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload file to MinIO: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unexpected error uploading file: {str(e)}"
            )

    async def delete_file(self, object_path: str) -> None:
        """Delete file from MinIO"""
        if not self.minio_client:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MinIO client not initialized"
            )

        try:
            self.minio_client.remove_object(
                bucket_name=self.bucket_name,
                object_name=object_path
            )
        except S3Error as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete file from MinIO: {str(e)}"
            )

    def generate_presigned_url(
        self,
        object_path: str,
        expires_in: int = 3600
    ) -> str:
        """
        Generate presigned URL for file access

        Args:
            object_path: Path to the object in MinIO
            expires_in: URL expiration time in seconds (default 1 hour)

        Returns:
            Presigned URL string
        """
        if not self.minio_client:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MinIO client not initialized"
            )

        try:
            url = self.minio_client.presigned_get_object(
                bucket_name=self.bucket_name,
                object_name=object_path,
                expires=timedelta(seconds=expires_in)
            )
            # Replace internal MinIO endpoint with public-facing one
            # The presigned URL uses the endpoint from initialization, which might be 'minio:9000'
            # We need to replace it with 'localhost:9000' for browser access
            minio_endpoint = settings.MINIO_ENDPOINT
            public_endpoint = settings.MINIO_PUBLIC_ENDPOINT

            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Original URL: {url}")
            logger.info(f"Replacing {minio_endpoint} with {public_endpoint}")

            # Try with and without http:// prefix
            if f"http://{minio_endpoint}" in url:
                url = url.replace(f"http://{minio_endpoint}", f"http://{public_endpoint}")
            elif f"https://{minio_endpoint}" in url:
                url = url.replace(f"https://{minio_endpoint}", f"https://{public_endpoint}")
            elif minio_endpoint in url:
                url = url.replace(minio_endpoint, public_endpoint)

            logger.info(f"Final URL: {url}")
            return url
        except S3Error as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate presigned URL: {str(e)}"
            )

    def generate_presigned_upload_url(
        self,
        object_path: str,
        expires_in: int = 3600
    ) -> str:
        """
        Generate presigned URL for direct upload

        Args:
            object_path: Path where the object will be stored
            expires_in: URL expiration time in seconds (default 1 hour)

        Returns:
            Presigned upload URL string
        """
        if not self.minio_client:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MinIO client not initialized"
            )

        try:
            url = self.minio_client.presigned_put_object(
                bucket_name=self.bucket_name,
                object_name=object_path,
                expires=timedelta(seconds=expires_in)
            )
            return url
        except S3Error as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate presigned upload URL: {str(e)}"
            )

    async def get_file_response(
        self,
        object_path: str,
        file_name: str,
        mime_type: str
    ) -> dict:
        """
        Get file metadata and presigned URL for download

        Args:
            object_path: Path to the object in MinIO
            file_name: Original file name
            mime_type: MIME type of the file

        Returns:
            Dictionary with file info and download URL
        """
        if not self.minio_client:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MinIO client not initialized"
            )

        try:
            # Check if object exists
            self.minio_client.stat_object(
                bucket_name=self.bucket_name,
                object_name=object_path
            )

            # Generate presigned URL for download
            download_url = self.generate_presigned_url(object_path)

            return {
                "file_name": file_name,
                "mime_type": mime_type,
                "download_url": download_url
            }

        except S3Error as e:
            if e.code == 'NoSuchKey':
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not found"
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get file: {str(e)}"
            )

    def get_file_size(self, object_path: str) -> int:
        """Get file size in bytes"""
        if not self.minio_client:
            return 0

        try:
            stat = self.minio_client.stat_object(
                bucket_name=self.bucket_name,
                object_name=object_path
            )
            return stat.size
        except S3Error:
            return 0
