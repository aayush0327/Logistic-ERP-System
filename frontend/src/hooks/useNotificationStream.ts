import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { addNotification, setSSEConnected, setSSEError } from '@/store/slices/notificationSlice';
import type { Notification } from '@/store/slices/notificationSlice';

/**
 * Custom hook for connecting to the SSE notification stream
 *
 * This hook:
 * 1. Establishes SSE connection to /api/notifications/stream
 * 2. Handles connection lifecycle and automatic reconnection
 * 3. Dispatches notifications to Redux store as they arrive
 * 4. Handles connection errors and retries
 */
export function useNotificationStream(enabled: boolean = true) {
  const dispatch = useDispatch();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isEnabledRef = useRef<boolean>(enabled);
  const isConnectingRef = useRef<boolean>(false); // Track connection in progress
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 3000; // 3 seconds

  const connect = useCallback(() => {
    // Prevent connection if not enabled, already connecting, or connection exists
    if (!enabled || typeof window === 'undefined' || isConnectingRef.current) {
      return;
    }

    // Prevent duplicate connections
    if (eventSourceRef.current) {
      console.log('SSE connection already exists, skipping');
      return;
    }

    // Mark that we're starting connection process
    isConnectingRef.current = true;

    // Get auth token
    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch(setSSEError('No authentication token'));
      isConnectingRef.current = false;
      return;
    }

    try {
      // Create SSE connection directly to backend (bypass Next.js API route for better SSE support)
      const API_URL = process.env.NEXT_PUBLIC_NOTIFICATIONS_API_URL || 'http://localhost:8007';
      const url = `${API_URL}/api/notifications/stream?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(url);

      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.onopen = () => {
        console.log('SSE connection established');
        isConnectingRef.current = false; // Connection complete
        dispatch(setSSEConnected(true));
        dispatch(setSSEError(null));
        reconnectAttemptsRef.current = 0;
      };

      // Handle notification events
      eventSource.addEventListener('notification', (event) => {
        try {
          const notification: Notification = JSON.parse(event.data);
          dispatch(addNotification(notification));

          // Optional: Show browser notification if permission granted
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/favicon.ico',
              tag: notification.id,
            });
          }
        } catch (error) {
          console.error('Error parsing notification event:', error);
        }
      });

      // Handle connected event (initial handshake)
      eventSource.addEventListener('connected', (event) => {
        console.log('SSE connected event:', event.data);
      });

      // Handle heartbeat events
      eventSource.addEventListener('heartbeat', (event) => {
        // Keep connection alive - no action needed
      });

      // Handle disconnected event
      eventSource.addEventListener('disconnected', (event) => {
        console.log('SSE disconnected:', event.data);
        dispatch(setSSEConnected(false));
      });

      // Handle errors
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        isConnectingRef.current = false; // Reset connecting flag on error
        dispatch(setSSEConnected(false));

        // Close the connection immediately to prevent error loops
        eventSource.close();
        eventSourceRef.current = null;

        // Only attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && enabled) {
          reconnectAttemptsRef.current++;
          console.log(
            `Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            // Check if we're still enabled before reconnecting
            if (enabled && !eventSourceRef.current) {
              connect();
            }
          }, RECONNECT_DELAY_MS);
        } else {
          dispatch(setSSEError('Failed to reconnect after maximum attempts'));
        }
      };

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      isConnectingRef.current = false; // Reset on exception
      dispatch(setSSEError('Failed to establish SSE connection'));
    }
  }, [enabled, dispatch]);

  const disconnect = useCallback(() => {
    // Reset connecting flag
    isConnectingRef.current = false;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    dispatch(setSSEConnected(false));
  }, [dispatch]);

  // Request notification permission on mount
  useEffect(() => {
    if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [enabled]);

  // Connect/disconnect based on enabled state
  // Only run on mount/unmount, not when enabled changes
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount/unmount

  return {
    connect,
    disconnect,
  };
}
