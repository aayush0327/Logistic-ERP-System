/**
 * Currency formatting utilities
 * Uses Intl.NumberFormat for locale-aware currency formatting
 */

import type { CurrencyConfig } from "@/types/tenant";

/**
 * Format a number as currency according to the tenant's currency configuration
 *
 * @param amount - The amount to format
 * @param currencyConfig - The currency configuration from tenant settings
 * @param locale - Optional locale (defaults to "en-US")
 * @returns Formatted currency string (e.g., "TSh1,234.56" or "1,234.56TSh")
 */
export function formatCurrency(
  amount: number,
  currencyConfig: CurrencyConfig,
  locale: string = "en-US"
): string {
  const {
    symbol,
    position,
    decimal_places,
    thousands_separator,
    decimal_separator,
  } = currencyConfig;

  // Format the number with proper decimal places
  const formattedNumber = amount.toLocaleString(locale, {
    minimumFractionDigits: decimal_places,
    maximumFractionDigits: decimal_places,
  });

  // Replace default separators with custom ones
  const customFormatted = formattedNumber
    .replace(/,/g, "PLACEHOLDER_THOUSANDS")
    .replace(/\./g, "PLACEHOLDER_DECIMAL")
    .replace(/PLACEHOLDER_THOUSANDS/g, thousands_separator)
    .replace(/PLACEHOLDER_DECIMAL/g, decimal_separator);

  // Add symbol in the correct position
  if (position === "before") {
    return `${symbol}${customFormatted}`;
  } else {
    return `${customFormatted}${symbol}`;
  }
}

/**
 * Format currency using Intl.NumberFormat with currency code
 * This is useful when you want browser-native formatting
 *
 * @param amount - The amount to format
 * @param currencyCode - ISO 4217 currency code (e.g., "TZS", "USD", "EUR")
 * @param locale - Optional locale (defaults to "en-US")
 * @returns Formatted currency string using native browser formatting
 */
export function formatCurrencyNative(
  amount: number,
  currencyCode: string,
  locale: string = "en-US"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
    }).format(amount);
  } catch (error) {
    // Fallback if currency code is invalid
    console.warn(`Invalid currency code: ${currencyCode}`, error);
    return `${currencyCode} ${amount.toLocaleString(locale)}`;
  }
}

/**
 * Get currency symbol for a given currency code
 * Uses a mapping of common currencies since Intl doesn't provide this directly
 *
 * @param currencyCode - ISO 4217 currency code
 * @returns Currency symbol or the code itself if not found
 */
export function getCurrencySymbol(currencyCode: string): string {
  const symbolMap: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    TZS: "TSh",
    KES: "KSh",
    UGX: "USh",
    RWF: "RF",
    INR: "₹",
    AED: "د.إ",
    SAR: "ر.س",
    CAD: "C$",
    AUD: "A$",
    CHF: "Fr",
    CNY: "¥",
    EGP: "E£",
    NGN: "₦",
    ZAR: "R",
    BWP: "P",
    BDT: "৳",
    PKR: "₨",
    LKR: "Rs",
    NPR: "₨",
    MYR: "RM",
    THB: "฿",
    VND: "₫",
    IDR: "Rp",
    PHP: "₱",
  };

  return symbolMap[currencyCode.toUpperCase()] || currencyCode;
}

/**
 * Parse a formatted currency string back to a number
 * Removes currency symbols and separators, returns the numeric value
 *
 * @param formatted - The formatted currency string
 * @param currencyConfig - The currency configuration used for formatting
 * @returns The numeric amount
 */
export function parseCurrency(
  formatted: string,
  currencyConfig: CurrencyConfig
): number {
  const { symbol, thousands_separator, decimal_separator } = currencyConfig;

  // Remove the currency symbol
  let cleaned = formatted.replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), "");

  // Replace custom separators with JavaScript defaults
  cleaned = cleaned
    .replace(new RegExp(thousands_separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), "")
    .replace(new RegExp(decimal_separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), ".");

  // Parse and return
  return parseFloat(cleaned) || 0;
}

/**
 * Format a short currency amount (e.g., "1.2K", "1.5M")
 * Useful for dashboard cards and summaries
 *
 * @param amount - The amount to format
 * @param currencyConfig - The currency configuration
 * @returns Short formatted string with suffix
 */
export function formatCurrencyShort(
  amount: number,
  currencyConfig: CurrencyConfig
): string {
  const { symbol, position } = currencyConfig;

  const suffixes = ["", "K", "M", "B", "T"];
  const suffixIndex = Math.floor(Math.log10(Math.abs(amount)) / 3) || 0;
  const shortAmount = amount / Math.pow(1000, suffixIndex);

  const formatted = `${shortAmount.toFixed(1)}${suffixes[suffixIndex]}`;

  if (position === "before") {
    return `${symbol}${formatted}`;
  } else {
    return `${formatted}${symbol}`;
  }
}

/**
 * Get decimal places for a currency code
 * Some currencies like JPY don't use decimal places
 *
 * @param currencyCode - ISO 4217 currency code
 * @returns Number of decimal places (0, 2, or 3)
 */
export function getCurrencyDecimalPlaces(currencyCode: string): number {
  const zeroDecimal: string[] = ["JPY", "ISK", "KRW", "PYG", "CLP", "HUF"];
  const threeDecimal: string[] = ["BHD", "KWD", "OMR", "TND", "LYD"];

  const upperCode = currencyCode.toUpperCase();

  if (zeroDecimal.includes(upperCode)) return 0;
  if (threeDecimal.includes(upperCode)) return 3;
  return 2; // Default for most currencies
}

/**
 * Determine if symbol should come before or after the amount
 * Based on common conventions for the currency
 *
 * @param currencyCode - ISO 4217 currency code
 * @returns "before" or "after"
 */
export function getCurrencySymbolPosition(currencyCode: string): "before" | "after" {
  const afterPosition: string[] = [
    "EUR", "GBP", "CNY", "JPY", "CHF", "NOK", "SEK", "DKK",
    "PLN", "RUB", "CZK", "HUF", "RON", "BGN",
  ];

  const upperCode = currencyCode.toUpperCase();
  return afterPosition.includes(upperCode) ? "after" : "before";
}
