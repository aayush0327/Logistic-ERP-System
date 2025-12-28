"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { getCurrentUserAsync } from "@/store/slices/auth.slice";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { api } from "@/lib/api";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[]; // Optional role-based protection
}

export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading, user, token } = useSelector(
    (state: RootState) => state.auth
  );
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // If we have a token but no user info, try to get the current user
        if (token && !user) {
          await dispatch(getCurrentUserAsync()).unwrap();
        }
      } catch (error) {
        console.error("Authentication check failed:", error);
        // If auth check fails, redirect to login
        router.push("/login");
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [dispatch, router, token, user]);

  useEffect(() => {
    // Redirect to login if not authenticated after checking
    if (!isChecking && !isLoading && !isAuthenticated) {
      const currentPath = window.location.pathname;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }

    // Check role-based access if required
    if (requiredRole && requiredRole.length > 0 && user) {
      const userRoleName = user.role_name || user.role?.name || "";
      const hasRequiredRole = requiredRole.includes(userRoleName);
      if (!hasRequiredRole) {
        // Redirect to unauthorized page or dashboard
        router.push("/dashboard");
      }
    }
  }, [isChecking, isLoading, isAuthenticated, user, requiredRole, router]);

  // Show skeleton while checking authentication
  if (isChecking || isLoading) {
    return <DashboardSkeleton />;
  }

  // Show nothing if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Check role-based access
  if (requiredRole && requiredRole.length > 0 && user) {
    const userRoleName = user.role_name || user.role?.name || "";
    const hasRequiredRole = requiredRole.includes(userRoleName);
    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h1>
            <p className="text-gray-600">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      );
    }
  }

  // Render children if authenticated and authorized
  return <>{children}</>;
}

// HOC wrapper for easier usage
export function withProtection<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: string[]
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute requiredRole={requiredRole}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
