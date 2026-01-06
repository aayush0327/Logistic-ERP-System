"use client";

/**
 * Tenant Settings Context
 * Provides tenant-specific currency and timezone settings throughout the app
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import type { TenantSettings, CurrencyConfig, TimezoneConfig } from "@/types/tenant";
import { DEFAULT_TENANT_SETTINGS } from "@/types/tenant";

interface TenantSettingsContextValue {
  settings: TenantSettings;
  isLoading: boolean;
  error: string | null;
  updateSettings: (settings: Partial<TenantSettings>) => void;
  currency: CurrencyConfig;
  timezone: TimezoneConfig;
}

const TenantSettingsContext = createContext<TenantSettingsContextValue | undefined>(
  undefined
);

interface TenantSettingsProviderProps {
  children: React.ReactNode;
  initialSettings?: TenantSettings;
}

/**
 * Provider component that wraps the app and provides tenant settings
 */
export function TenantSettingsProvider({
  children,
  initialSettings,
}: TenantSettingsProviderProps) {
  const [settings, setSettings] = useState<TenantSettings>(
    initialSettings || DEFAULT_TENANT_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(!initialSettings);
  const [error, setError] = useState<string | null>(null);

  // Fetch tenant settings from the API if not provided initially
  useEffect(() => {
    if (initialSettings) {
      setIsLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch tenant settings from /api/auth/me endpoint
        const response = await fetch("/api/auth/me");

        if (!response.ok) {
          throw new Error("Failed to fetch tenant settings");
        }

        const data = await response.json();

        // Extract tenant settings from the user data
        if (data.tenant?.settings) {
          const tenantSettings = JSON.parse(data.tenant.settings);
          setSettings(tenantSettings);
        } else {
          // Use defaults if no settings found
          setSettings(DEFAULT_TENANT_SETTINGS);
        }
      } catch (err) {
        console.error("Failed to fetch tenant settings:", err);
        setError(err instanceof Error ? err.message : "Failed to load settings");
        // Fall back to defaults on error
        setSettings(DEFAULT_TENANT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [initialSettings]);

  const updateSettings = (newSettings: Partial<TenantSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
    }));
  };

  const value: TenantSettingsContextValue = {
    settings,
    isLoading,
    error,
    updateSettings,
    currency: settings.currency,
    timezone: settings.timezone,
  };

  return (
    <TenantSettingsContext.Provider value={value}>
      {children}
    </TenantSettingsContext.Provider>
  );
}

/**
 * Hook to access tenant settings
 * Throws an error if used outside of TenantSettingsProvider
 *
 * @example
 * const { currency, timezone, formatCurrency, formatDateTime } = useTenantSettings();
 */
export function useTenantSettings(): TenantSettingsContextValue {
  const context = useContext(TenantSettingsContext);

  if (!context) {
    throw new Error("useTenantSettings must be used within TenantSettingsProvider");
  }

  return context;
}

/**
 * HOC to inject tenant settings into a component
 * Useful for class components or when you prefer HOCs over hooks
 */
export function withTenantSettings<P extends object>(
  Component: React.ComponentType<P & { tenantSettings: TenantSettingsContextValue }>
) {
  return function WithTenantSettings(props: P) {
    const tenantSettings = useTenantSettings();
    return <Component {...props} tenantSettings={tenantSettings} />;
  };
}
