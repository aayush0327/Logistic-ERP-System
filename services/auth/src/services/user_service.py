"""
User service for authentication and user management
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from ..database import User, Role, Permission, RefreshToken
from ..schemas import UserCreate, UserUpdate, LoginRequest, TokenData
from ..auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    check_user_lockout,
    increment_login_attempts,
    reset_login_attempts
)
from ..config_local import AuthSettings
from .refresh_token_service import RefreshTokenService

settings = AuthSettings()


class UserService:
    """Service for user authentication and management"""

    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
        """Get user by ID with relationships"""
        query = select(User).options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.tenant)
        ).where(User.id == user_id)
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str, tenant_id: Optional[str] = None) -> Optional[User]:
        """Get user by email with relationships"""
        query = select(User).options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.tenant)
        ).where(User.email == email.lower())

        if tenant_id:
            query = query.where(User.tenant_id == tenant_id)

        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email_with_tenant(db: AsyncSession, email: str) -> List[Tuple[User, str]]:
        """Get user by email across all tenants with tenant names"""
        query = select(User).options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.tenant)
        ).where(User.email == email.lower())

        result = await db.execute(query)
        users = result.scalars().all()

        return [(user, user.tenant.name) for user in users]

    @staticmethod
    async def authenticate_user(
        db: AsyncSession,
        login_data: LoginRequest
    ) -> Tuple[Optional[User], Optional[str]]:
        """Authenticate user with email and password"""

        # Get user by email (email is unique across all tenants)
        user = await UserService.get_by_email(db, login_data.email)

        if not user:
            return None, "Invalid credentials"

        # Check if user is active
        if not user.is_active:
            return None, "Account is disabled"

        # Check account lockout
        is_locked, remaining_minutes = check_user_lockout(
            user.login_attempts,
            user.locked_until
        )

        if is_locked:
            return None, f"Account locked. Try again in {remaining_minutes} minutes"

        # Verify password
        if not user.password_hash:
            return None, "No password set for this account"

        # Verify password using SHA256 pre-hashing approach
        if not verify_password(login_data.password, user.password_hash):
            # Increment login attempts
            user.login_attempts = increment_login_attempts(user.login_attempts)
            user.updated_at = datetime.utcnow()
            await db.commit()

            # Check if should lock account
            is_locked, remaining_minutes = check_user_lockout(
                user.login_attempts,
                user.locked_until
            )

            if is_locked:
                user.locked_until = datetime.utcnow() + timedelta(minutes=remaining_minutes)
                await db.commit()
                return None, f"Account locked. Try again in {remaining_minutes} minutes"

            return None, "Invalid credentials"

        # Reset login attempts on successful login
        user.login_attempts = reset_login_attempts()
        user.last_login = datetime.utcnow()
        user.locked_until = None
        user.updated_at = datetime.utcnow()
        await db.commit()

        return user, None

    @staticmethod
    async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
        """Create a new user"""
        # Check if user already exists
        existing_user = await UserService.get_by_email(db, user_data.email, user_data.tenant_id)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )

        # Hash password
        password_hash = get_password_hash(user_data.password)

        # Create user
        db_user = User(
            id=str(uuid.uuid4()),
            email=user_data.email.lower(),
            password_hash=password_hash,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            tenant_id=user_data.tenant_id,
            role_id=user_data.role_id,
            is_active=user_data.is_active,
            is_superuser=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)

        # Load relationships
        return await UserService.get_by_id(db, db_user.id)

    @staticmethod
    async def update_user(db: AsyncSession, user_id: str, user_data: UserUpdate) -> Optional[User]:
        """Update user details"""
        user = await UserService.get_by_id(db, user_id)
        if not user:
            return None

        # Update fields
        update_data = user_data.model_dump(exclude_unset=True)
        if 'email' in update_data:
            # Check if email is already taken by another user
            existing = await UserService.get_by_email(db, update_data['email'], user.tenant_id)
            if existing and existing.id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already taken"
                )
            update_data['email'] = update_data['email'].lower()

        for field, value in update_data.items():
            setattr(user, field, value)

        user.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(user)

        return user

    @staticmethod
    async def change_password(
        db: AsyncSession,
        user_id: str,
        current_password: str,
        new_password: str
    ) -> bool:
        """Change user password"""
        user = await UserService.get_by_id(db, user_id)
        if not user:
            return False

        # Verify current password
        if not user.password_hash or not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid current password"
            )

        # Update password
        user.password_hash = get_password_hash(new_password)
        user.updated_at = datetime.utcnow()
        await db.commit()

        return True

    @staticmethod
    async def create_tokens_for_user(db: AsyncSession, user: User) -> Tuple[str, str, dict]:
        """Create access and refresh tokens for user"""

        # Create minimal access token without permissions
        access_token = create_access_token({
            "sub": user.id,
            "tenant_id": user.tenant_id or "",  # Ensure tenant_id is not null
            "role_id": user.role_id,
            "email": user.email,
            "is_superuser": user.is_superuser
        })

        # Create refresh token
        refresh_token = create_refresh_token(user.id, user.tenant_id or "")

        # Store refresh token in database
        await RefreshTokenService.create_refresh_token(db, user.id, refresh_token)

        # Get permissions for user data response (not for token)
        permissions = []
        if user.role and user.role.permissions:
            permissions = [
                f"{p.resource}:{p.action}"
                for p in user.role.permissions
            ]

        # Add superuser permissions if applicable
        if user.is_superuser:
            permissions.append("superuser:access")

        # Prepare user data for response
        user_data = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "tenant_id": user.tenant_id,
            "role_id": user.role_id,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "permissions": permissions,
            "created_at": user.created_at,
            "role": {
                "id": user.role.id,
                "name": user.role.name,
                "description": user.role.description
            } if user.role else None,
            "tenant": {
                "id": user.tenant.id,
                "name": user.tenant.name,
                "domain": user.tenant.domain,
                "created_at": user.tenant.created_at
            } if user.tenant else None
        }

        return access_token, refresh_token, user_data

    @staticmethod
    async def deactivate_user(db: AsyncSession, user_id: str) -> bool:
        """Deactivate a user"""
        user = await db.get(User, user_id)
        if not user:
            return False

        user.is_active = False
        user.updated_at = datetime.utcnow()
        await db.commit()

        return True

    @staticmethod
    async def list_users(
        db: AsyncSession,
        tenant_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[User]:
        """List users with pagination"""
        query = select(User).options(
            selectinload(User.role),
            selectinload(User.tenant)
        ).order_by(User.created_at.desc())

        if tenant_id:
            query = query.where(User.tenant_id == tenant_id)

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def get_user_permissions(db: AsyncSession, user_id: str) -> List[str]:
        """Get user permissions"""
        user = await UserService.get_by_id(db, user_id)
        if not user:
            return []

        permissions = [
            f"{p.resource}:{p.action}"
            for p in user.role.permissions
        ]

        # Add superuser permissions if applicable
        if user.is_superuser:
            permissions.append("superuser:access")

        return permissions
