/**
 * Timezone utilities
 * Handles timezone conversion and formatting using Intl API
 */

import type { TimezoneConfig } from "@/types/tenant";

/**
 * Convert a UTC date string to the tenant's timezone
 *
 * @param utcString - ISO 8601 datetime string in UTC
 * @param timezoneConfig - The timezone configuration from tenant settings
 * @returns Date object converted to tenant timezone
 */
export function convertToTenantTimezone(
  utcString: string,
  timezoneConfig: TimezoneConfig
): Date {
  const { iana, enabled } = timezoneConfig;

  if (!enabled) {
    // If timezone is disabled, treat as UTC
    return new Date(utcString);
  }

  // Create date in the target timezone
  return new Date(new Date(utcString).toLocaleString("en-US", { timeZone: iana }));
}

/**
 * Format a date according to tenant's timezone configuration
 *
 * @param date - The date to format (Date object or ISO string)
 * @param timezoneConfig - The timezone configuration
 * @param format - The format style to use
 * @returns Formatted date string
 */
export function formatDateTime(
  date: Date | string,
  timezoneConfig: TimezoneConfig,
  format: "full" | "long" | "medium" | "short" = "medium"
): string {
  const { iana, enabled } = timezoneConfig;
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    timeZone: enabled ? iana : "UTC",
    year: "numeric",
    month: format === "short" ? "numeric" : format === "medium" ? "short" : "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

  if (format === "full" || format === "long") {
    options.second = "2-digit";
    options.timeZoneName = "short";
  }

  return new Intl.DateTimeFormat("en-US", options).format(dateObj);
}

/**
 * Format a date only (no time) according to tenant's timezone
 *
 * @param date - The date to format
 * @param timezoneConfig - The timezone configuration
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  timezoneConfig: TimezoneConfig
): string {
  const { iana, enabled } = timezoneConfig;
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: enabled ? iana : "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(dateObj);
}

/**
 * Format a time only (no date) according to tenant's timezone
 *
 * @param date - The date to format
 * @param timezoneConfig - The timezone configuration
 * @param includeSeconds - Whether to include seconds
 * @returns Formatted time string
 */
export function formatTime(
  date: Date | string,
  timezoneConfig: TimezoneConfig,
  includeSeconds: boolean = false
): string {
  const { iana, enabled } = timezoneConfig;
  const dateObj = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: enabled ? iana : "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
  }).format(dateObj);
}

/**
 * Get the current UTC offset for a timezone
 *
 * @param timezoneConfig - The timezone configuration
 * @returns Offset string like "+03:00" or "-05:00"
 */
export function getTimezoneOffset(timezoneConfig: TimezoneConfig): string {
  const { iana, enabled } = timezoneConfig;

  if (!enabled) {
    return "+00:00";
  }

  const now = new Date();
  const offset = getTimezoneOffsetInMinutes(iana, now);

  const sign = offset >= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset / 60);
  const minutes = absOffset % 60;

  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Get timezone offset in minutes for a given timezone
 *
 * @param iana - IANA timezone identifier
 * @param date - The date to get offset for
 * @returns Offset in minutes from UTC
 */
function getTimezoneOffsetInMinutes(iana: string, date: Date): number {
  // Get the timezone offset using Intl
  const utcString = date.toISOString();
  const localString = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  // Parse the local time
  const [localDate, localTime] = localString.split(", ");
  const [month, day, year] = localDate.split("/");
  const [hour, minute, second] = localTime.split(":");

  const localDateObj = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}`
  );

  const utcDateObj = new Date(utcString);

  // Calculate difference in minutes
  return (localDateObj.getTime() - utcDateObj.getTime()) / (1000 * 60);
}

/**
 * Get a list of all available timezones from the browser
 *
 * @returns Array of IANA timezone identifiers
 */
export function getAvailableTimezones(): string[] {
  if (typeof Intl !== "undefined" && Intl.supportedValuesOf) {
    return Intl.supportedValuesOf("timeZone");
  }
  // Fallback for older browsers
  return [
    "Africa/Dar_es_Salaam",
    "Africa/Nairobi",
    "Africa/Kampala",
    "Africa/Kigali",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Tokyo",
  ];
}

/**
 * Get the timezone abbreviation for a timezone
 *
 * @param timezoneConfig - The timezone configuration
 * @param date - Optional date to get abbreviation for
 * @returns Timezone abbreviation like "EAT", "EST", "PST"
 */
export function getTimezoneAbbreviation(
  timezoneConfig: TimezoneConfig,
  date: Date = new Date()
): string {
  const { iana, enabled } = timezoneConfig;

  if (!enabled) {
    return "UTC";
  }

  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    timeZoneName: "short",
  }).format(date);

  // Extract the timezone name from the formatted string
  const parts = formatted.split(" ");
  return parts[parts.length - 1] || iana.split("/")[1];
}

/**
 * Check if two dates are the same day in the tenant's timezone
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @param timezoneConfig - The timezone configuration
 * @returns True if dates are the same day
 */
export function isSameDay(
  date1: Date | string,
  date2: Date | string,
  timezoneConfig: TimezoneConfig
): boolean {
  const { iana, enabled } = timezoneConfig;

  const dateObj1 = typeof date1 === "string" ? new Date(date1) : date1;
  const dateObj2 = typeof date2 === "string" ? new Date(date2) : date2;

  const options: Intl.DateTimeFormatOptions = {
    timeZone: enabled ? iana : "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  };

  return (
    new Intl.DateTimeFormat("en-US", options).format(dateObj1) ===
    new Intl.DateTimeFormat("en-US", options).format(dateObj2)
  );
}

/**
 * Get the start of day in tenant's timezone
 *
 * @param date - The date
 * @param timezoneConfig - The timezone configuration
 * @returns ISO string of start of day in UTC
 */
export function startOfDay(
  date: Date | string,
  timezoneConfig: TimezoneConfig
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  // Format as YYYY-MM-DD in the timezone, then append T00:00:00
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: timezoneConfig.iana,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(dateObj)
    .split("/")
    .reverse()
    .join("-");

  return `${datePart}T00:00:00.000Z`;
}

/**
 * Get the end of day in tenant's timezone
 *
 * @param date - The date
 * @param timezoneConfig - The timezone configuration
 * @returns ISO string of end of day in UTC
 */
export function endOfDay(
  date: Date | string,
  timezoneConfig: TimezoneConfig
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  // Format as YYYY-MM-DD in the timezone, then append T23:59:59
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: timezoneConfig.iana,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(dateObj)
    .split("/")
    .reverse()
    .join("-");

  return `${datePart}T23:59:59.999Z`;
}

/**
 * Format a relative time (e.g., "2 hours ago", "in 3 days")
 *
 * @param date - The date to format
 * @param timezoneConfig - The timezone configuration
 * @returns Relative time string
 */
export function formatRelativeTime(
  date: Date | string,
  timezoneConfig: TimezoneConfig
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

  if (diffDay > 7) {
    return formatDate(dateObj, timezoneConfig);
  } else if (diffDay > 0) {
    return rtf.format(-diffDay, "day");
  } else if (diffHour > 0) {
    return rtf.format(-diffHour, "hour");
  } else if (diffMin > 0) {
    return rtf.format(-diffMin, "minute");
  } else {
    return rtf.format(-diffSec, "second");
  }
}
