"""
Authentication utilities and JWT handling
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from fastapi import HTTPException, status
import secrets
import hashlib

from .config_local import AuthSettings, GLOBAL_JWT_SECRET, GLOBAL_JWT_ALGORITHM, GLOBAL_JWT_EXPIRE_MINUTES
from .schemas import TokenData

settings = AuthSettings()


def get_password_hash(password: str) -> str:
    """Generate SHA256 password hash using global JWT secret"""
    # Use the global JWT secret as salt for password hashing
    salted_password = password + GLOBAL_JWT_SECRET
    # Hash with SHA256
    hash_result = hashlib.sha256(salted_password.encode('utf-8')).hexdigest()
    # print(f"[AUTH] Hashed password: {hash_result[:20]}... with secret {GLOBAL_JWT_SECRET[:20]}...")
    return hash_result


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its SHA256 hash using global JWT secret"""
    # Hash the provided password with the same global JWT secret
    salted_password = plain_password + GLOBAL_JWT_SECRET
    computed_hash = hashlib.sha256(salted_password.encode('utf-8')).hexdigest()
    # print(f"[AUTH] Verifying password: computed {computed_hash[:20]}... vs stored {hashed_password[:20]}...")
    # Compare hashes
    return computed_hash == hashed_password


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token using global configuration"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=GLOBAL_JWT_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        GLOBAL_JWT_SECRET,
        algorithm=GLOBAL_JWT_ALGORITHM
    )
    # print(f"[AUTH] Created access token with secret {GLOBAL_JWT_SECRET[:20]}...")
    return encoded_jwt


def create_refresh_token(user_id: str, tenant_id: str) -> str:
    """Create a secure refresh token"""
    # Generate a cryptographically secure random token
    return secrets.token_urlsafe(32)


def verify_token(token: str) -> TokenData:
    """Verify JWT token and return token data using global configuration"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            GLOBAL_JWT_SECRET,
            algorithms=[GLOBAL_JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        role_id: str = payload.get("role_id")
        permissions: list = payload.get("permissions", [])
        exp: Optional[datetime] = payload.get("exp")

        if user_id is None or tenant_id is None or role_id is None:
            raise credentials_exception

        token_data = TokenData(
            user_id=user_id,
            tenant_id=tenant_id,
            role_id=role_id,
            permissions=permissions,
            exp=exp
        )
        return token_data
    except JWTError:
        raise credentials_exception


def generate_password_reset_token(email: str) -> str:
    """Generate password reset token using global configuration"""
    delta = timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
    now = datetime.utcnow()
    expires = now + delta
    exp = expires.timestamp()
    encoded_jwt = jwt.encode(
        {"exp": exp, "nbf": now, "sub": email},
        GLOBAL_JWT_SECRET,
        algorithm=GLOBAL_JWT_ALGORITHM,
    )
    return encoded_jwt


def verify_password_reset_token(token: str) -> Optional[str]:
    """Verify password reset token using global configuration"""
    try:
        decoded_token = jwt.decode(
            token,
            GLOBAL_JWT_SECRET,
            algorithms=[GLOBAL_JWT_ALGORITHM]
        )
        return decoded_token["sub"]
    except JWTError:
        return None


def is_token_expired(exp: Optional[datetime]) -> bool:
    """Check if token has expired"""
    if not exp:
        return False

    return datetime.utcnow() > exp


def check_user_lockout(
    login_attempts: int,
    locked_until: Optional[datetime],
    max_attempts: int = None,
    lockout_duration: int = None
) -> tuple[bool, Optional[int]]:
    """
    Check if user is locked out and return lockout status
    Returns: (is_locked, remaining_minutes)
    """
    # Use settings from AuthSettings if not provided
    max_attempts = max_attempts or settings.MAX_LOGIN_ATTEMPTS
    lockout_duration = lockout_duration or settings.LOCKOUT_DURATION_MINUTES

    # Check if user is currently locked
    if locked_until and datetime.utcnow() < locked_until:
        remaining = (locked_until - datetime.utcnow()).seconds // 60
        return True, remaining

    # Check if lockout should be applied
    if login_attempts >= max_attempts:
        return True, lockout_duration

    return False, None


def increment_login_attempts(login_attempts: int) -> int:
    """Increment login attempts counter"""
    return login_attempts + 1


def reset_login_attempts() -> int:
    """Reset login attempts counter"""
    return 0


def create_email_verification_token(email: str) -> str:
    """Create email verification token using global configuration"""
    delta = timedelta(hours=EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS)
    now = datetime.utcnow()
    expires = now + delta
    exp = expires.timestamp()
    encoded_jwt = jwt.encode(
        {"exp": exp, "nbf": now, "sub": email, "type": "email_verification"},
        GLOBAL_JWT_SECRET,
        algorithm=GLOBAL_JWT_ALGORITHM,
    )
    return encoded_jwt


def verify_email_verification_token(token: str) -> Optional[str]:
    """Verify email verification token using global configuration"""
    try:
        decoded_token = jwt.decode(
            token,
            GLOBAL_JWT_SECRET,
            algorithms=[GLOBAL_JWT_ALGORITHM]
        )

        # Check token type
        if decoded_token.get("type") != "email_verification":
            return None

        return decoded_token["sub"]
    except JWTError:
        return None


# Default values for missing settings
RESET_TOKEN_EXPIRE_HOURS = 1
EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS = 24