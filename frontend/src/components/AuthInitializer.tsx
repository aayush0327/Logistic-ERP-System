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