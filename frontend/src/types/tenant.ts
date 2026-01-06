/**
 * Tenant settings types for multi-currency and multi-timezone support
 */

export interface CurrencyConfig {
  code: string;                // ISO 4217 currency code (e.g., "TZS", "USD")
  symbol: string;              // Currency symbol (e.g., "TSh", "$", "€")
  name: string;                // Full currency name (e.g., "Tanzanian Shilling")
  position: "before" | "after"; // Symbol position relative to amount
  decimal_places: number;      // Number of decimal places (0-4)
  thousands_separator: string; // Thousands separator (e.g., ",", ".")
  decimal_separator: string;   // Decimal separator (e.g., ".", ",")
}

export interface TimezoneConfig {
  iana: string;        // IANA timezone identifier (e.g., "Africa/Dar_es_Salaam")
  enabled: boolean;    // Whether timezone conversion is enabled
}

export interface TenantSettings {
  currency: CurrencyConfig;
  timezone: TimezoneConfig;
}

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  numeric_code?: string;
  decimal_places: number;
}

export interface Timezone {
  iana: string;
  offset: string;      // Current UTC offset (e.g., "+03:00", "-05:00")
  label: string;       // Human-readable label (e.g., "Africa/Nairobi (EAT) +03:00")
}

export interface TimezoneGroup {
  region: string;
  timezones: Timezone[];
}

// Default values
export const DEFAULT_CURRENCY: CurrencyConfig = {
  code: "TZS",
  symbol: "TSh",
  name: "Tanzanian Shilling",
  position: "before",
  decimal_places: 2,
  thousands_separator: ",",
  decimal_separator: ".",
};

export const DEFAULT_TIMEZONE: TimezoneConfig = {
  iana: "Africa/Dar_es_Salaam",
  enabled: true,
};

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  currency: DEFAULT_CURRENCY,
  timezone: DEFAULT_TIMEZONE,
};
