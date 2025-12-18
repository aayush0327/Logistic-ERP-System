"""
User management endpoints
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def list_users():
    """List all users"""
    return {"users": []}


@router.post("/")
async def create_user():
    """Create a new user"""
    return {"message": "User created successfully"}