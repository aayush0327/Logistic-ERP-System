"use client";

/**
 * CurrencyDisplay Component
 * Displays a currency amount formatted according to tenant settings
 */

import React from "react";
import { useTenantSettings } from "@/contexts/TenantSettingsContext";
import { formatCurrency, formatCurrencyShort } from "@/utils/currency";
import type { CurrencyConfig } from "@/types/tenant";

interface CurrencyDisplayProps {
  amount: number;
  currency?: CurrencyConfig; // Optional: if not provided, uses tenant settings
  short?: boolean; // Show short format (e.g., "1.2K" instead of "1,234")
  className?: string;
  showZero?: boolean; // Whether to show zero amounts
  negativeColor?: string; // Color for negative amounts
  positiveColor?: string; // Color for positive amounts
}

/**
 * Component for displaying currency values with tenant formatting
 *
 * @example
 * <CurrencyDisplay amount={1234.56} />
 * <CurrencyDisplay amount={1234.56} short /> // Shows "TSh1.2K"
 * <CurrencyDisplay amount={-500} negativeColor="text-red-600" />
 */
export function CurrencyDisplay({
  amount,
  currency: propCurrency,
  short = false,
  className = "",
  showZero = true,
  negativeColor = "text-red-600",
  positiveColor = "",
}: CurrencyDisplayProps) {
  const { currency: tenantCurrency } = useTenantSettings();
  const currencyConfig = propCurrency || tenantCurrency;

  // Don't render if amount is zero and showZero is false
  if (amount === 0 && !showZero) {
    return <span className={className}>-</span>;
  }

  // Format the amount
  const formatted = short
    ? formatCurrencyShort(amount, currencyConfig)
    : formatCurrency(amount, currencyConfig);

  // Determine color based on value
  const colorClass =
    amount < 0 ? negativeColor : positiveColor;

  return (
    <span className={`${colorClass} ${className}`.trim()}>
      {formatted}
    </span>
  );
}

interface CurrencyValueProps {
  value: number;
  currency?: CurrencyConfig;
  locale?: string;
}

/**
 * Lightweight component that uses native browser currency formatting
 * Useful when you don't need custom tenant settings
 */
export function CurrencyValue({
  value,
  currency,
  locale = "en-US",
}: CurrencyValueProps) {
  const currencyCode = currency?.code || "TZS";

  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(value);

  return <span>{formatted}</span>;
}

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  currency?: CurrencyConfig;
  min?: number;
  max?: number;
}

/**
 * Input component for currency values
 * Handles parsing and formatting of currency input
 */
export function CurrencyInput({
  value,
  onChange,
  currency: propCurrency,
  min,
  max,
  className = "",
  ...inputProps
}: CurrencyInputProps) {
  const { currency: tenantCurrency } = useTenantSettings();
  const currencyConfig = propCurrency || tenantCurrency;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^\d.-]/g, "");
    const numValue = parseFloat(rawValue);

    if (!isNaN(numValue)) {
      // Apply min/max constraints
      let finalValue = numValue;
      if (min !== undefined && finalValue < min) finalValue = min;
      if (max !== undefined && finalValue > max) finalValue = max;

      onChange(finalValue);
    } else if (rawValue === "" || rawValue === "-") {
      // Allow empty input or negative sign
      onChange(0);
    }
  };

  const displayValue = formatCurrency(value, currencyConfig);

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      className={className}
      {...inputProps}
    />
  );
}

export default CurrencyDisplay;
