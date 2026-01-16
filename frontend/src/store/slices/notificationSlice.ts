import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Types
export interface Notification {
  id: string;
  user_id: string;
  tenant_id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  entity_type?: string;
  entity_id?: string;
  status: string;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  data?: Record<string, any>;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  stats: NotificationStats | null;
  isLoading: boolean;
  error: string | null;
  sseConnected: boolean;
  sseError: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  stats: null,
  isLoading: false,
  error: null,
  sseConnected: false,
  sseError: null,
};

// Helper function to get auth token
const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return null;
};

// Async thunks
export const fetchNotificationsAsync = createAsyncThunk(
  'notifications/fetchNotifications',
  async (params: { is_read?: boolean; type?: string; priority?: string; limit?: number; offset?: number } = {}) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const queryParams = new URLSearchParams();
    if (params.is_read !== undefined) queryParams.append('is_read', params.is_read.toString());
    if (params.type) queryParams.append('type', params.type);
    if (params.priority) queryParams.append('priority', params.priority);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());

    const response = await fetch(`/api/notifications?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch notifications');
    }

    const data: NotificationListResponse = await response.json();
    return data;
  }
);

export const markAsReadAsync = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: string) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to mark notification as read');
    }

    const data: Notification = await response.json();
    return data;
  }
);

export const markAllAsReadAsync = createAsyncThunk(
  'notifications/markAllAsRead',
  async () => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch('/api/notifications/mark-all-read', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to mark all notifications as read');
    }

    const data = await response.json();
    return data;
  }
);

export const deleteNotificationAsync = createAsyncThunk(
  'notifications/deleteNotification',
  async (notificationId: string) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // Treat both 204 (success) and 404 (already deleted) as success
    if (!response.ok && response.status !== 404) {
      throw new Error('Failed to delete notification');
    }

    return notificationId;
  }
);

export const fetchNotificationStatsAsync = createAsyncThunk(
  'notifications/fetchStats',
  async () => {
    const token = getAuthToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch('/api/notifications/stats/summary', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch notification stats');
    }

    const data: NotificationStats = await response.json();
    return data;
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      // Add new notification at the beginning of the list
      state.notifications.unshift(action.payload);
      // Update unread count if notification is not read
      if (!action.payload.is_read) {
        state.unreadCount += 1;
      }
    },
    setSSEConnected: (state, action: PayloadAction<boolean>) => {
      state.sseConnected = action.payload;
      state.sseError = null;
    },
    setSSEError: (state, action: PayloadAction<string>) => {
      state.sseError = action.payload;
      state.sseConnected = false;
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    // Fetch notifications
    builder
      .addCase(fetchNotificationsAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotificationsAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.notifications = action.payload.notifications;
        state.unreadCount = action.payload.unread_count;
        state.error = null;
      })
      .addCase(fetchNotificationsAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch notifications';
      });

    // Mark as read
    builder
      .addCase(markAsReadAsync.fulfilled, (state, action) => {
        const index = state.notifications.findIndex(n => n.id === action.payload.id);
        if (index !== -1) {
          // If it was unread before, decrement unread count
          if (!state.notifications[index].is_read) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          state.notifications[index] = action.payload;
        }
      });

    // Mark all as read
    builder
      .addCase(markAllAsReadAsync.fulfilled, (state) => {
        // Mark all notifications as read
        state.notifications.forEach(n => {
          n.is_read = true;
          n.read_at = new Date().toISOString();
        });
        state.unreadCount = 0;
      });

    // Delete notification
    builder
      .addCase(deleteNotificationAsync.fulfilled, (state, action) => {
        const index = state.notifications.findIndex(n => n.id === action.payload);
        if (index !== -1) {
          // If it was unread, decrement unread count
          if (!state.notifications[index].is_read) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          state.notifications.splice(index, 1);
        }
      });

    // Fetch stats
    builder
      .addCase(fetchNotificationStatsAsync.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchNotificationStatsAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload;
        state.unreadCount = action.payload.unread;
      })
      .addCase(fetchNotificationStatsAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch stats';
      });
  },
});

export const {
  addNotification,
  setSSEConnected,
  setSSEError,
  clearNotifications,
} = notificationSlice.actions;

export default notificationSlice.reducer;
