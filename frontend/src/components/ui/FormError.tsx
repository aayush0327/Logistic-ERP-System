import { AlertCircle } from 'lucide-react'

interface FormErrorProps {
  error?: string | null
  className?: string
}

/**
 * FormError component - Displays validation error messages
 * Shows an alert icon with error text in red
 */
export function FormError({ error, className = '' }: FormErrorProps) {
  if (!error) return null

  return (
    <div className={`mt-1 text-sm text-red-600 flex items-center gap-1 ${className}`}>
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{error}</span>
    </div>
  )
}

interface FormFieldWrapperProps {
  label?: string
  error?: string | null
  required?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * FormFieldWrapper component - Wraps form fields with label and error display
 * Provides consistent layout for form fields
 */
export function FormFieldWrapper({
  label,
  error,
  required,
  children,
  className = '',
}: FormFieldWrapperProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && <FormError error={error} />}
    </div>
  )
}
