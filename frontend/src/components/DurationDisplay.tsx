"use client";

import React from "react";

interface DurationDisplayProps {
  minutes: number;
  className?: string;
}

/**
 * Format duration in minutes to human-readable string
 * Examples: 150 -> "2h 30min", 45 -> "45min", 90 -> "1h 30min"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return "0min";
  }

  if (minutes < 60) {
    return `${Math.round(minutes)}min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
      return `${days}d`;
    }
    return `${days}d ${remainingHours}h`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}min`;
}

/**
 * Display duration in hours and minutes format
 *
 * @example
 * <DurationDisplay minutes={150} /> // "2h 30min"
 * <DurationDisplay minutes={45} />  // "45min"
 */
export function DurationDisplay({ minutes, className = "" }: DurationDisplayProps) {
  const formatted = formatDuration(minutes);

  return (
    <span className={className}>
      {formatted}
    </span>
  );
}

export default DurationDisplay;
