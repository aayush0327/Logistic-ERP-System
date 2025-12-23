"""
Refresh token service for managing refresh tokens in the database
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from ..database import RefreshToken
from ..auth import get_password_hash
from ..config_local import GLOBAL_REFRESH_TOKEN_EXPIRE_DAYS


class RefreshTokenService:
    """Service for managing refresh tokens"""

    @staticmethod
    async def create_refresh_token(
        db: AsyncSession,
        user_id: str,
        token: str,
        expires_days: int = GLOBAL_REFRESH_TOKEN_EXPIRE_DAYS
    ) -> RefreshToken:
        """Create and store a refresh token"""

        # Calculate expiration date
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)

        # Hash the token for storage
        token_hash = get_password_hash(token)

        # Create refresh token record
        refresh_token = RefreshToken(
            id=f"rt_{user_id}_{datetime.now(timezone.utc).timestamp()}",
            token_hash=token_hash,
            expires_at=expires_at,
            user_id=user_id
        )

        db.add(refresh_token)
        await db.commit()
        await db.refresh(refresh_token)

        return refresh_token

    @staticmethod
    async def verify_refresh_token(
        db: AsyncSession,
        token: str
    ) -> Optional[RefreshToken]:
        """Verify a refresh token and return the token record"""

        # Hash the token to check against stored hash
        token_hash = get_password_hash(token)

        # Find the token in the database
        query = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.is_revoked == False
        )
        result = await db.execute(query)
        refresh_token = result.scalar_one_or_none()

        if not refresh_token:
            return None

        # Check if token has expired
        if datetime.now(timezone.utc) > refresh_token.expires_at:
            return None

        return refresh_token

    @staticmethod
    async def revoke_token(
        db: AsyncSession,
        token_hash: str
    ) -> bool:
        """Revoke a refresh token"""

        query = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash
        )
        result = await db.execute(query)
        refresh_token = result.scalar_one_or_none()

        if not refresh_token:
            return False

        refresh_token.is_revoked = True
        refresh_token.revoked_at = datetime.now(timezone.utc)
        await db.commit()

        return True

    @staticmethod
    async def revoke_user_tokens(
        db: AsyncSession,
        user_id: str
    ) -> int:
        """Revoke all refresh tokens for a user"""

        query = select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked == False
        )
        result = await db.execute(query)
        tokens = result.scalars().all()

        count = 0
        for token in tokens:
            token.is_revoked = True
            token.revoked_at = datetime.now(timezone.utc)
            count += 1

        await db.commit()
        return count

    @staticmethod
    async def cleanup_expired_tokens(
        db: AsyncSession,
    ) -> int:
        """Clean up expired refresh tokens"""

        query = select(RefreshToken).where(
            RefreshToken.expires_at < datetime.now(timezone.utc)
        )
        result = await db.execute(query)
        tokens = result.scalars().all()

        count = len(tokens)
        for token in tokens:
            await db.delete(token)

        await db.commit()
        return count
