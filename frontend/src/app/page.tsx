'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { getDefaultRoute, getUserRole } from '@/lib/roles';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // If not loading and not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    } else if (isAuthenticated && user) {
      // If already authenticated, redirect based on user role using getUserRole
      const userRole = getUserRole(user);
      if (userRole) {
        const defaultRoute = getDefaultRoute(userRole);
        router.push(defaultRoute);
      } else {
        console.error('Unable to determine user role', user);
        router.push('/login');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
