"use client";

/**
 * DateDisplay Component
 * Displays dates and times formatted according to tenant timezone settings
 */

import React from "react";
import { useTenantSettings } from "@/contexts/TenantSettingsContext";
import {
  formatDateTime,
  formatDate,
  formatTime,
  formatRelativeTime,
  getTimezoneAbbreviation,
} from "@/utils/timezone";
import type { TimezoneConfig } from "@/types/tenant";

interface DateDisplayProps {
  date: Date | string;
  timezone?: TimezoneConfig; // Optional: if not provided, uses tenant settings
  format?: "full" | "long" | "medium" | "short" | "relative" | "date" | "time";
  includeTimezone?: boolean; // Whether to show timezone abbreviation
  className?: string;
}

/**
 * Component for displaying dates with tenant timezone formatting
 *
 * @example
 * <DateDisplay date={new Date()} />
 * <DateDisplay date="2024-01-15T10:30:00Z" format="relative" />
 * <DateDisplay date={new Date()} format="date" /> // Date only
 */
export function DateDisplay({
  date,
  timezone: propTimezone,
  format = "medium",
  includeTimezone = false,
  className = "",
}: DateDisplayProps) {
  const { timezone: tenantTimezone } = useTenantSettings();
  const timezoneConfig = propTimezone || tenantTimezone;

  let formatted = "";

  switch (format) {
    case "relative":
      formatted = formatRelativeTime(date, timezoneConfig);
      break;
    case "date":
      formatted = formatDate(date, timezoneConfig);
      break;
    case "time":
      formatted = formatTime(date, timezoneConfig);
      break;
    default:
      formatted = formatDateTime(date, timezoneConfig, format);
  }

  // Add timezone abbreviation if requested
  if (includeTimezone && format !== "date") {
    const tzAbbrev = getTimezoneAbbreviation(timezoneConfig);
    formatted += ` ${tzAbbrev}`;
  }

  return <span className={className}>{formatted}</span>;
}

interface DateRangeProps {
  startDate: Date | string;
  endDate?: Date | string;
  timezone?: TimezoneConfig;
  format?: "short" | "medium" | "long";
  className?: string;
}

/**
 * Display a date range (e.g., "Jan 15 - Jan 20, 2024" or "Jan 15 - Feb 2, 2024")
 */
export function DateRange({
  startDate,
  endDate,
  timezone: propTimezone,
  format = "short",
  className = "",
}: DateRangeProps) {
  const { timezone: tenantTimezone } = useTenantSettings();
  const timezoneConfig = propTimezone || tenantTimezone;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  const startDateFormatted = formatDate(start, timezoneConfig);

  if (!end) {
    return <span className={className}>{startDateFormatted}</span>;
  }

  const endDateFormatted = formatDate(end, timezoneConfig);

  // Check if dates are in the same month and year
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    // "Jan 15 - 20, 2024"
    const month = start.toLocaleString("en-US", { month: "short", timeZone: timezoneConfig.iana });
    const year = start.getFullYear();
    const startDay = start.getDate();
    const endDay = end.getDate();
    return (
      <span className={className}>
        {month} {startDay} - {endDay}, {year}
      </span>
    );
  } else {
    // "Jan 15 - Feb 20, 2024" or "Jan 15, 2023 - Feb 20, 2024"
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear === endYear) {
      return (
        <span className={className}>
          {startDateFormatted} - {endDateFormatted}
        </span>
      );
    } else {
      return (
        <span className={className}>
          {startDateFormatted} - {endDateFormatted}
        </span>
      );
    }
  }
}

interface TimeAgoProps {
  date: Date | string;
  timezone?: TimezoneConfig;
  className?: string;
}

/**
 * Display time ago (e.g., "2 hours ago", "3 days ago")
 */
export function TimeAgo({
  date,
  timezone: propTimezone,
  className = "",
}: TimeAgoProps) {
  const { timezone: tenantTimezone } = useTenantSettings();
  const timezoneConfig = propTimezone || tenantTimezone;

  const formatted = formatRelativeTime(date, timezoneConfig);

  return <span className={className}>{formatted}</span>;
}

interface DateTimePickerProps {
  value?: Date | string;
  onChange: (date: Date | null) => void;
  timezone?: TimezoneConfig;
  showTime?: boolean;
  minDate?: Date | string;
  maxDate?: Date | string;
  className?: string;
}

/**
 * DateTime input component that respects tenant timezone
 */
export function DateTimePicker({
  value,
  onChange,
  timezone: propTimezone,
  showTime = true,
  minDate,
  maxDate,
  className = "",
}: DateTimePickerProps) {
  const { timezone: tenantTimezone } = useTenantSettings();
  const timezoneConfig = propTimezone || tenantTimezone;

  // Convert value to local input string
  const getInputValue = (): string => {
    if (!value) return "";

    const date = typeof value === "string" ? new Date(value) : value;

    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return showTime
      ? `${year}-${month}-${day}T${hours}:${minutes}`
      : `${year}-${month}-${day}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) {
      onChange(null);
      return;
    }

    const date = new Date(e.target.value);
    onChange(date);
  };

  return (
    <input
      type={showTime ? "datetime-local" : "date"}
      value={getInputValue()}
      onChange={handleChange}
      min={minDate ? new Date(minDate).toISOString().slice(0, -1) : undefined}
      max={maxDate ? new Date(maxDate).toISOString().slice(0, -1) : undefined}
      className={className}
    />
  );
}

interface TimezoneDisplayProps {
  timezone?: TimezoneConfig;
  showOffset?: boolean;
  className?: string;
}

/**
 * Display the current timezone with optional offset
 */
export function TimezoneDisplay({
  timezone: propTimezone,
  showOffset = true,
  className = "",
}: TimezoneDisplayProps) {
  const { timezone: tenantTimezone } = useTenantSettings();
  const timezoneConfig = propTimezone || tenantTimezone;

  const abbreviation = getTimezoneAbbreviation(timezoneConfig);
  const city = timezoneConfig.iana.split("/")[1]?.replace(/_/g, " ") || timezoneConfig.iana;

  return (
    <span className={className}>
      {city} ({abbreviation})
      {showOffset && (
        <span className="text-gray-500 ml-1">
          {/* Could add offset calculation here if needed */}
        </span>
      )}
    </span>
  );
}

export default DateDisplay;
