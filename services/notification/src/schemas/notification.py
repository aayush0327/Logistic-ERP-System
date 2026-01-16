# Pydantic schemas for notifications
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID


class NotificationBase(BaseModel):
    """Base notification schema"""
    type: str = Field(..., description="Notification type (order_event, trip_event, system, alert)")
    category: str = Field(..., description="Notification category (created, approved, rejected, etc.)")
    title: str = Field(..., max_length=500, description="Notification title")
    message: str = Field(..., description="Notification message")
    priority: str = Field(default="normal", description="Priority level (low, normal, high, urgent)")
    entity_type: Optional[str] = Field(None, description="Related entity type")
    entity_id: Optional[str] = Field(None, description="Related entity ID")
    action_url: Optional[str] = Field(None, description="Action URL for deep linking")
    data: Optional[Dict[str, Any]] = Field(None, description="Additional notification data")


class NotificationCreate(NotificationBase):
    """Schema for creating notifications"""
    tenant_id: str
    user_id: str


class NotificationUpdate(BaseModel):
    """Schema for updating notifications"""
    is_read: bool = Field(default=False)
    read_at: Optional[datetime] = None


class NotificationResponse(NotificationBase):
    """Schema for notification response"""
    id: UUID
    tenant_id: str
    user_id: str
    status: str
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list"""
    notifications: List[NotificationResponse]
    total: int
    unread_count: int


class NotificationPreference(BaseModel):
    """Schema for user notification preferences"""
    email_enabled: bool = True
    push_enabled: bool = True
    email_order_events: bool = True
    email_trip_events: bool = True
    email_system_notifications: bool = True
    email_alerts: bool = True
    email_daily_summary: bool = False
    push_order_events: bool = True
    push_trip_events: bool = True
    push_system_notifications: bool = True
    push_alerts: bool = True
    quiet_hours_enabled: bool = False
    quiet_hours_start: str = "22:00"
    quiet_hours_end: str = "08:00"
    quiet_hours_timezone: str = "UTC"
    daily_summary_enabled: bool = False
    daily_summary_time: str = "09:00"
    daily_summary_timezone: str = "UTC"


class NotificationPreferenceResponse(NotificationPreference):
    """Schema for notification preference response"""
    id: UUID
    tenant_id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserPreferencesCreate(NotificationPreference):
    """Schema for creating user preferences"""
    tenant_id: str
    user_id: str


class UserPreferencesUpdate(BaseModel):
    """Schema for updating user preferences"""
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    email_order_events: Optional[bool] = None
    push_order_events: Optional[bool] = None
    email_daily_summary: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    daily_summary_enabled: Optional[bool] = None
    daily_summary_time: Optional[str] = None


class UserPreferencesResponse(NotificationPreference):
    """Schema for user preference response"""
    id: UUID
    tenant_id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
