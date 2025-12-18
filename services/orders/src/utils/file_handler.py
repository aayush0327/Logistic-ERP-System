"""
File handling utilities
"""
import os
import hashlib
import aiofiles
from typing import Tuple
from uuid import uuid4
from fastapi import UploadFile, HTTPException, status
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from src.config_local import OrdersSettings

settings = OrdersSettings()


class FileHandler:
    """Utility class for handling file operations"""

    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        self.max_file_size = settings.MAX_FILE_SIZE
        self.allowed_file_types = settings.ALLOWED_FILE_TYPES

        # Ensure upload directory exists
        os.makedirs(self.upload_dir, exist_ok=True)

    def is_allowed_file_type(self, mime_type: str) -> bool:
        """Check if file type is allowed"""
        return mime_type in self.allowed_file_types

    def is_valid_file_size(self, file_size: int) -> bool:
        """Check if file size is within limits"""
        return file_size <= self.max_file_size

    async def save_file(self, file: UploadFile, order_id: str) -> Tuple[str, str]:
        """Save uploaded file and return file path and hash"""
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid4()}{file_extension}"

        # Create order-specific directory
        order_dir = os.path.join(self.upload_dir, str(order_id))
        os.makedirs(order_dir, exist_ok=True)

        file_path = os.path.join(order_dir, unique_filename)

        # Calculate file hash
        sha256_hash = hashlib.sha256()
        file_content = await file.read()
        sha256_hash.update(file_content)

        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_content)

        # Reset file pointer
        await file.seek(0)

        return file_path, sha256_hash.hexdigest()

    async def delete_file(self, file_path: str) -> None:
        """Delete file from storage"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)

                # Try to remove empty directories
                parent_dir = os.path.dirname(file_path)
                while parent_dir != self.upload_dir:
                    try:
                        os.rmdir(parent_dir)
                        parent_dir = os.path.dirname(parent_dir)
                    except OSError:
                        break
        except OSError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete file: {str(e)}"
            )

    async def get_file_response(
        self,
        file_path: str,
        file_name: str,
        mime_type: str
    ) -> FileResponse:
        """Get file response for download"""
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )

        return FileResponse(
            path=file_path,
            filename=file_name,
            media_type=mime_type
        )

    def get_file_size(self, file_path: str) -> int:
        """Get file size in bytes"""
        try:
            return os.path.getsize(file_path)
        except OSError:
            return 0

    def generate_presigned_url(self, file_path: str, expires_in: int = 3600) -> str:
        """Generate presigned URL for file access (placeholder)"""
        # This would typically integrate with cloud storage
        # For now, return a placeholder URL
        return f"/api/v1/files/download?path={file_path}"