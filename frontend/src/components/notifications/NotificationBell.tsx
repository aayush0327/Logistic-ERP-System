"use client";

import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Bell } from 'lucide-react';
import { RootState } from '@/store';
import {
  fetchNotificationsAsync,
  markAsReadAsync,
  markAllAsReadAsync,
} from '@/store/slices/notificationSlice';
import { useNotificationStream } from '@/hooks/useNotificationStream';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const dispatch = useDispatch();
  const { unreadCount } = useSelector((state: RootState) => state.notifications);
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Enable SSE connection when user is authenticated
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  useNotificationStream(isAuthenticated);

  // Fetch notifications on mount
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchNotificationsAsync({ limit: 10, is_read: false }) as any);
    }
  }, [dispatch, isAuthenticated]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={toggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-5 h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          onClose={handleClose}
          anchorRef={bellRef}
        />
      )}
    </div>
  );
}
