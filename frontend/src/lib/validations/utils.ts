import { z } from 'zod'
import {
  emailSchema,
  phoneSchema,
  licenseNumberSchema,
  bloodGroupSchema,
  pinCodeSchema,
  panSchema,
  aadharSchema,
  vehicleRegistrationSchema,
  ifscSchema,
  bankAccountSchema,
  passportSchema,
} from './schemas'

/**
 * Validation utility functions for form validation
 * These provide helper functions for common validation scenarios
 */

/**
 * Get the first error message from a Zod validation result
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Error message string or null if valid
 */
export function getZodError<T>(schema: z.ZodSchema<T>, data: any): string | null {
  const result = schema.safeParse(data)
  if (result.success) return null
  return result.error.issues[0]?.message || 'Validation error'
}

/**
 * Get all error messages from a Zod validation result
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Object with field names as keys and error messages as values
 */
export function getZodErrors<T>(schema: z.ZodSchema<T>, data: any): Record<string, string> {
  const result = schema.safeParse(data)
  if (result.success) return {}

  const errors: Record<string, string> = {}
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.')
    errors[path] = issue.message
  })
  return errors
}

/**
 * Validate a single field against a schema
 * @param schema - Zod schema to validate against
 * @param value - Value to validate
 * @returns Error message or null if valid
 */
export function validateField(schema: z.ZodSchema, value: any): string | null {
  // Handle empty/undefined values - if value is empty, optional schemas should pass
  if (value === undefined || value === null || value === '') {
    const result = schema.safeParse(value)
    if (result.success) return null
    // If it's an optional field, empty value is valid
    if (result.error.issues.length > 0) {
      return result.error.issues[0]?.message || 'Invalid value'
    }
    return null
  }

  const result = schema.safeParse(value)
  if (result.success) return null
  return result.error.issues?.[0]?.message || 'Invalid value'
}

/**
 * Common field validators that return error messages or null
 */
export const validators = {
  email: (value: string) => validateField(emailSchema, value),
  phone: (value: string) => validateField(phoneSchema, value),
  licenseNumber: (value: string) => validateField(licenseNumberSchema, value),
  bloodGroup: (value: string) => validateField(bloodGroupSchema, value),
  pinCode: (value: string) => validateField(pinCodeSchema, value),
  pan: (value: string) => validateField(panSchema, value),
  aadhar: (value: string) => validateField(aadharSchema, value),
  vehicleRegistration: (value: string) => validateField(vehicleRegistrationSchema, value),
  ifsc: (value: string) => validateField(ifscSchema, value),
  bankAccount: (value: string) => validateField(bankAccountSchema, value),
  passport: (value: string) => validateField(passportSchema, value),
}

/**
 * Transform validation errors to a format suitable for form display
 * @param errors - Zod validation errors
 * @returns Formatted error object
 */
export function formatFormErrors(errors: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {}

  errors.issues.forEach((issue) => {
    const field = issue.path.join('.')
    formatted[field] = issue.message
  })

  return formatted
}

/**
 * Create a form validation hook return type
 */
export interface FormValidationResult<T> {
  isValid: boolean
  errors: Record<keyof T, string> | null
  data: T | null
}

/**
 * Validate form data against a schema
 * @param schema - Zod schema to validate against
 * @param formData - Form data to validate
 * @returns Validation result with validity status, errors, and parsed data
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  formData: any
): FormValidationResult<T> {
  const result = schema.safeParse(formData)

  if (result.success) {
    return {
      isValid: true,
      errors: null,
      data: result.data,
    }
  }

  const errors: Record<string, string> = {}
  result.error.issues.forEach((issue) => {
    const field = issue.path.join('.')
    errors[field] = issue.message
  })

  return {
    isValid: false,
    errors: errors as Record<keyof T, string>,
    data: null,
  }
}

/**
 * Check if a date is in the future
 * @param dateString - Date string to check
 * @returns true if date is in the future
 */
export function isFutureDate(dateString: string): boolean {
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date > today
}

/**
 * Check if a date is in the past
 * @param dateString - Date string to check
 * @returns true if date is in the past
 */
export function isPastDate(dateString: string): boolean {
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return date < today
}

/**
 * Format a Zod error for display in UI
 * @param error - Zod error or unknown error
 * @returns User-friendly error message
 */
export function formatApiError(error: unknown): string {
  if (error && typeof error === 'object') {
    // Check for Zod error
    if ('issues' in error && Array.isArray(error.issues)) {
      const zodError = error as z.ZodError
      return zodError.issues[0]?.message || 'Validation error'
    }

    // Check for API response error
    if ('response' in error) {
      const apiError = error as any
      const detail = apiError.response?.data?.detail

      if (typeof detail === 'string') {
        return detail
      }

      if (detail && typeof detail === 'object' && detail.message) {
        return detail.message
      }
    }

    // Check for Error object
    if ('message' in error) {
      return String(error.message)
    }
  }

  return 'An unexpected error occurred'
}

/**
 * Real-time validation hook for individual fields
 * @param schema - Zod schema for the field
 * @param value - Current value
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns Debounced validation function
 */
export function createDebouncedValidator(
  schema: z.ZodSchema,
  debounceMs: number = 300
): (value: string) => Promise<string | null> {
  let timeoutId: NodeJS.Timeout | null = null

  return (value: string): Promise<string | null> => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        const result = schema.safeParse(value)
        resolve(result.success ? null : result.error.issues[0]?.message || 'Invalid value')
      }, debounceMs)
    })
  }
}

/**
 * Type guard to check if value is a valid Zod schema
 */
export function isZodSchema(value: unknown): value is z.ZodSchema {
  return (
    value !== null &&
    typeof value === 'object' &&
    '_def' in value &&
    'safeParse' in value &&
    typeof (value as any).safeParse === 'function'
  )
}
