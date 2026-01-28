import { z } from 'zod'

/**
 * Common validation schemas for form fields
 * These reusable schemas ensure consistent validation across the application
 */

// Email validation - requires @ and domain extension
export const emailSchema = z.string({
  required_error: 'Email is required',
})
  .min(1, 'Email is required')
  .email('Invalid email format')
  .refine(
    (val) => val.includes('.') && val.split('.').pop()!.length >= 2,
    'Email must contain a valid domain extension (e.g., .com, .org)'
  )

// Phone validation - exactly 10 digits, numeric only
export const phoneSchema = z.string({
  required_error: 'Phone number is required',
})
  .min(1, 'Phone number is required')
  .regex(/^\d{10}$/, 'Phone number must be exactly 10 digits')

// Optional phone validation
export const phoneOptionalSchema = phoneSchema.optional().or(z.literal(''))

// License number - alphanumeric (letters and numbers only)
export const licenseNumberSchema = z.string({
  required_error: 'License number is required',
})
  .min(1, 'License number is required')
  .regex(/^[A-Za-z0-9]+$/, 'License number can only contain letters and numbers (no special characters)')
  .min(2, 'License number must be at least 2 characters')
  .max(50, 'License number cannot exceed 50 characters')

// Blood group - max 5 characters (based on backend schema)
export const bloodGroupSchema = z.string()
  .max(5, 'Blood group cannot exceed 5 characters')
  .optional()
  .or(z.literal(''))

// Pin code / Postal code - exactly 6 digits for India
export const pinCodeSchema = z.string({
  required_error: 'Pin code is required',
})
  .regex(/^\d{6}$/, 'Pin code must be exactly 6 digits')

// Optional pin code
export const pinCodeOptionalSchema = pinCodeSchema.optional().or(z.literal(''))

// PAN card format - 5 letters + 4 digits + 1 letter (Indian format)
export const panSchema = z.string()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format. Must be 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)')
  .optional()
  .or(z.literal(''))

// Aadhar number - exactly 12 digits
export const aadharSchema = z.string()
  .regex(/^\d{12}$/, 'Aadhar number must be exactly 12 digits')
  .optional()
  .or(z.literal(''))

// GSTIN format - Indian GST identification
export const gstinSchema = z.string()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format')
  .optional()
  .or(z.literal(''))

// Vehicle registration number - Indian format
export const vehicleRegistrationSchema = z.string({
  required_error: 'Vehicle registration number is required',
})
  .min(1, 'Vehicle registration number is required')
  .regex(/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/, 'Invalid registration format (e.g., MH12AB1234)')

// URL validation
export const urlSchema = z.string()
  .url('Invalid URL format')
  .optional()
  .or(z.literal(''))

// Date validation - must be future date
export const futureDateSchema = z.string({
  required_error: 'Date is required',
})
  .min(1, 'Date is required')
  .refine(
    (val) => {
      const date = new Date(val)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return date > today
    },
    'Date must be in the future'
  )

// Date validation - must be past date
export const pastDateSchema = z.string({
  required_error: 'Date is required',
})
  .min(1, 'Date is required')
  .refine(
    (val) => {
      const date = new Date(val)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      return date < today
    },
    'Date must be in the past'
  )

// Bank account number - numeric only
export const bankAccountSchema = z.string()
  .regex(/^\d{9,18}$/, 'Account number must be 9-18 digits')
  .optional()
  .or(z.literal(''))

// IFSC code - Indian format
export const ifscSchema = z.string({
  required_error: 'IFSC code is required',
})
  .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC format (e.g., SBIN0001234)')

// Passport number - alphanumeric
export const passportSchema = z.string()
  .regex(/^[A-Z0-9]{6,9}$/, 'Passport number must be 6-9 alphanumeric characters')
  .optional()
  .or(z.literal(''))

// Name validation - letters and spaces only
export const nameSchema = z.string({
  required_error: 'Name is required',
})
  .min(1, 'Name is required')
  .min(2, 'Name must be at least 2 characters')
  .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces')

// Required string with min length
export const requiredString = (fieldName: string, minLength = 1) =>
  z.string({
    required_error: `${fieldName} is required`,
  })
    .min(1, `${fieldName} is required`)
    .min(minLength, `${fieldName} must be at least ${minLength} characters`)

// Positive number validation
export const positiveNumberSchema = (fieldName: string = 'Value') =>
  z.number({
    required_error: `${fieldName} is required`,
  })
    .min(0, `${fieldName} must be positive`)

// Integer validation
export const integerSchema = z.number({
  required_error: 'Value is required',
})
  .int('Value must be a whole number')

/**
 * Composed schemas for common forms
 */

// Driver profile schema
export const driverProfileSchema = z.object({
  license_number: licenseNumberSchema,
  license_type: requiredString('License type'),
  license_expiry: futureDateSchema,
  license_issuing_authority: z.string().optional(),
  badge_number: z.string().optional(),
  badge_expiry: z.string().optional(),
  preferred_vehicle_types: z.array(z.string()).optional(),
  experience_years: z.number().min(0).max(50).optional(),
})

// Employee profile schema (personal info)
export const employeeProfileSchema = z.object({
  employee_id: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  date_of_joining: z.string().optional(),
  emergency_contact_name: z.string().min(1, 'Emergency contact name is required').optional().or(z.literal('')),
  emergency_contact_number: phoneOptionalSchema,
  blood_group: bloodGroupSchema,
  date_of_birth: pastDateSchema.optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed']).optional().or(z.literal('')),
  nationality: z.string().optional(),
  aadhar_number: aadharSchema,
  pan_number: panSchema,
  passport_number: passportSchema,
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: pinCodeOptionalSchema,
  country: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account_number: bankAccountSchema,
  bank_ifsc: ifscSchema.optional().or(z.literal('')),
})

// Customer contact info schema
export const customerContactSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  alternate_phone: phoneOptionalSchema,
})

// Branch contact info schema
export const branchContactSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: pinCodeOptionalSchema,
})

// Vehicle schema
export const vehicleSchema = z.object({
  registration_number: vehicleRegistrationSchema,
  chassis_number: z.string().min(6, 'Chassis number must be at least 6 characters').optional(),
  engine_number: z.string().min(6, 'Engine number must be at least 6 characters').optional(),
  insurance_expiry: z.string().optional(),
  fitness_expiry: z.string().optional(),
  pollution_expiry: z.string().optional(),
})
