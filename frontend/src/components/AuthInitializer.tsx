'use client';

import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { initializeAuth, getCurrentUserAsync } from '@/store/slices/auth.slice';

interface AuthInitializerProps {
  children: React.ReactNode;
}

export function AuthInitializer({ children }: AuthInitializerProps) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading } = useAppSelector((state: { auth: any; }) => state.auth);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only run once on mount
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Initialize auth state on app start
    dispatch(initializeAuth());

    // If we have a token, try to get the current user
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        dispatch(getCurrentUserAsync());

        // Start periodic session validation every 60 seconds
        const checkSession = async () => {
          const currentToken = localStorage.getItem('access_token');
          if (!currentToken) {
            // No token, stop checking
            return;
          }

          try {
            const response = await fetch('/api/auth/me', {
              headers: {
                'Authorization': `Bearer ${currentToken}`
              }
            });

            if (!response.ok) {
              console.log('[AuthInitializer] Session expired, logging out...');
              // Clear localStorage
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');

              // Clear cookies
              document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
              document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

              // Redirect to login
              window.location.href = '/login';
            }
          } catch (error) {
            console.error('[AuthInitializer] Session check error:', error);
            // On fetch error, also clear tokens and redirect
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            window.location.href = '/login';
          }
        };

        // Check immediately after initial user check
        setTimeout(checkSession, 1000);

        // Then check every 60 seconds
        const sessionCheckInterval = setInterval(checkSession, 60 * 1000);

        // Cleanup on unmount
        return () => clearInterval(sessionCheckInterval);
      }
    }
  }, [dispatch]);

  // Show loading indicator while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}