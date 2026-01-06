"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { getCurrentUserAsync } from "@/store/slices/auth.slice";
import { canAccessRoute, getDefaultRoute, getUserRole } from "@/lib/roles";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { TenantSettingsProvider } from "@/contexts/TenantSettingsContext";
import type { TenantSettings } from "@/types/tenant";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading } = useAppSelector(
    (state) => state.auth
  );
  const hasRedirectedRef = useRef(false);
  const lastCheckedPathRef = useRef<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Get initial tenant settings from localStorage (set during login, persists across sessions)
  const getInitialSettings = (): TenantSettings | undefined => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tenantSettings');
      if (stored) {
        try {
          return JSON.parse(stored) as TenantSettings;
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // If authenticated but no user data, fetch it
    if (isAuthenticated && !user) {
      dispatch(getCurrentUserAsync());
      return;
    }
    // Check role-based access
    if (user) {
      const userRole = getUserRole(user);
      if (!userRole) {
        console.error("Unable to determine user role", user);
        return;
      }
      const defaultRoute = getDefaultRoute(userRole);

      // Reset redirect flag if pathname changed (but not if we just redirected)
      if (lastCheckedPathRef.current !== pathname) {
        hasRedirectedRef.current = false;
        lastCheckedPathRef.current = pathname;
      }

      // Check if user can access current route
      const canAccess = canAccessRoute(userRole, pathname);

      if (!canAccess) {
        // Prevent infinite loop: don't redirect if we're already on the default route
        // or if we've already redirected for this pathname
        if (pathname !== defaultRoute && !hasRedirectedRef.current) {
          console.warn(
            `Access denied for role ${userRole} to ${pathname}. Redirecting to ${defaultRoute}`
          );
          hasRedirectedRef.current = true;
          router.push(defaultRoute);
        } else if (pathname === defaultRoute && !canAccess) {
          // If we're on the default route but still can't access it, there's a role mismatch
          console.error(
            `Role ${userRole} cannot access its default route ${defaultRoute}. This indicates a role configuration issue.`
          );
        }
      } else {
        // User can access the route, reset the redirect flag
        hasRedirectedRef.current = false;
      }
    }
  }, [isLoading, isAuthenticated, user, pathname, router, dispatch]);

  // Show loading state with skeleton inside layout
  if (isLoading || !user) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <PageContainer>
            <DashboardSkeleton />
          </PageContainer>
        </div>
      </div>
    );
  }

  // Show nothing if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Render with persistent Sidebar and Header
  return (
    <TenantSettingsProvider initialSettings={getInitialSettings()}>
      <div className="flex h-screen bg-gray-50">
        <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
          <Header />
          <PageContainer>{children}</PageContainer>
        </div>
      </div>
    </TenantSettingsProvider>
  );
}
