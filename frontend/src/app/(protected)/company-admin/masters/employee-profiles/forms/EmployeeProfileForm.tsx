'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import { User as UserType, UserProfile, useUpdateUserMutation } from '@/services/api/companyApi'
import { CheckCircle, User, Pencil, X, Save } from 'lucide-react'
import {
  phoneOptionalSchema,
  bloodGroupSchema,
  pinCodeOptionalSchema,
  panSchema,
  aadharSchema,
  passportSchema,
  bankAccountSchema,
  ifscSchema,
  validateField,
  formatApiError,
  emailSchema,
} from '@/lib/validations'

interface EmployeeProfileFormProps {
  user: UserType
  profile?: UserProfile | null
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export default function EmployeeProfileForm({
  user,
  profile,
  isEditing,
  onEdit,
  onSave,
  onCancel
}: EmployeeProfileFormProps) {
  const [formData, setFormData] = useState({
    employee_id: '',
    department: '',
    designation: '',
    date_of_joining: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    blood_group: '',
    date_of_birth: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    marital_status: '' as 'single' | 'married' | 'divorced' | 'widowed' | '',
    nationality: '',
    aadhar_number: '',
    pan_number: '',
    passport_number: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc: '',
  })

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)

  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation()

  // Populate form data from user/profile
  useEffect(() => {
    // Use profile if available, otherwise fall back to user data
    const dataSource = profile || user

    if (dataSource) {
      // Cast to any to handle additional API fields not in TypeScript interface
      const data = dataSource as any

      setFormData({
        employee_id: data.employee_id || data.employee_code || '',
        department: data.department || '',
        designation: data.designation || '',
        date_of_joining: data.date_of_joining || data.hire_date
          ? (data.date_of_joining || data.hire_date || '').split('T')[0]
          : '',
        emergency_contact_name: data.emergency_contact_name || '',
        emergency_contact_number: data.emergency_contact_number || data.emergency_contact_phone || '',
        blood_group: data.blood_group || '',
        date_of_birth: data.date_of_birth ? data.date_of_birth.split('T')[0] : '',
        gender: data.gender || '',
        marital_status: data.marital_status || '',
        nationality: data.nationality || '',
        aadhar_number: data.aadhar_number || '',
        pan_number: data.pan_number || '',
        passport_number: data.passport_number || '',
        address: data.address || data.current_address?.address_line1 || '',
        city: data.city || data.current_address?.city || '',
        state: data.state || data.current_address?.state || '',
        postal_code: data.postal_code || data.current_address?.postal_code || '',
        country: data.country || data.current_address?.country || '',
        bank_name: data.bank_name || data.bank_details?.bank_name || '',
        bank_account_number: data.bank_account_number || data.bank_details?.account_number || '',
        bank_ifsc: data.bank_ifsc || data.bank_details?.ifsc_code || '',
      })
    }
  }, [profile, user])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    // Clear API error when user starts typing
    if (apiError) {
      setApiError(null)
    }
  }

  // Validate form before submission
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate emergency contact number (optional phone format)
    if (formData.emergency_contact_number) {
      const phoneError = validateField(phoneOptionalSchema, formData.emergency_contact_number)
      if (phoneError) newErrors.emergency_contact_number = phoneError
    }

    // Validate blood group (max 5 characters)
    if (formData.blood_group) {
      const bloodGroupError = validateField(bloodGroupSchema, formData.blood_group)
      if (bloodGroupError) newErrors.blood_group = bloodGroupError
    }

    // Validate Aadhar number (optional, 12 digits)
    if (formData.aadhar_number) {
      const aadharError = validateField(aadharSchema, formData.aadhar_number)
      if (aadharError) newErrors.aadhar_number = aadharError
    }

    // Validate PAN number (optional, proper format)
    if (formData.pan_number) {
      const panError = validateField(panSchema, formData.pan_number.toUpperCase())
      if (panError) newErrors.pan_number = panError
    }

    // Validate passport number (optional)
    if (formData.passport_number) {
      const passportError = validateField(passportSchema, formData.passport_number.toUpperCase())
      if (passportError) newErrors.passport_number = passportError
    }

    // Validate postal code (optional, 6 digits)
    if (formData.postal_code) {
      const pinCodeError = validateField(pinCodeOptionalSchema, formData.postal_code)
      if (pinCodeError) newErrors.postal_code = pinCodeError
    }

    // Validate bank account number (optional)
    if (formData.bank_account_number) {
      const bankAccountError = validateField(bankAccountSchema, formData.bank_account_number)
      if (bankAccountError) newErrors.bank_account_number = bankAccountError
    }

    // Validate IFSC code (optional)
    if (formData.bank_ifsc) {
      const ifscError = validateField(ifscSchema, formData.bank_ifsc.toUpperCase())
      if (ifscError) newErrors.bank_ifsc = ifscError
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isEditing) {
      return
    }

    // Validate form before submission
    if (!validateForm()) {
      return
    }

    try {
      const profileData: any = {
        employee_code: formData.employee_id || undefined,
        department: formData.department || undefined,
        designation: formData.designation || undefined,
        hire_date: formData.date_of_joining || undefined,
        emergency_contact_name: formData.emergency_contact_name || undefined,
        emergency_contact_phone: formData.emergency_contact_number || undefined,
        blood_group: formData.blood_group || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender || undefined,
        marital_status: formData.marital_status || undefined,
        nationality: formData.nationality || undefined,
        aadhar_number: formData.aadhar_number || undefined,
        pan_number: formData.pan_number || undefined,
        passport_number: formData.passport_number || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        postal_code: formData.postal_code || undefined,
        country: formData.country || undefined,
        bank_name: formData.bank_name || undefined,
        bank_account_number: formData.bank_account_number || undefined,
        bank_ifsc: formData.bank_ifsc || undefined,
      }

      // Remove undefined values
      Object.keys(profileData).forEach(key => {
        if (profileData[key] === undefined || profileData[key] === '') {
          delete profileData[key]
        }
      })

      // Use updateUser mutation which calls PUT /company/users/{id}
      await updateUser({ id: user.id, user: profileData }).unwrap()

      onSave()
    } catch (error) {
      console.error('Error saving profile:', error)
      const errorMessage = formatApiError(error)
      setApiError(errorMessage)
    }
  }

  const isLoading = isUpdating

  // Always compute dataSource - used in both view and edit modes
  const dataSource = profile || user

  // VIEW MODE - Display existing data
  if (!isEditing) {
    // Cast to any to handle additional API fields not in TypeScript interface
    const data = dataSource as any

    return (
      <div className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Employee ID</label>
                <p className="text-gray-900 font-medium">{data?.employee_id || data?.employee_code || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Department</label>
                <p className="text-gray-900 font-medium">{data?.department || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Designation</label>
                <p className="text-gray-900 font-medium">{data?.designation || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Date of Joining</label>
                <p className="text-gray-900 font-medium">
                  {data.date_of_joining || data.hire_date
                    ? new Date(data.date_of_joining || data.hire_date).toLocaleDateString()
                    : '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Date of Birth</label>
                <p className="text-gray-900 font-medium">
                  {data.date_of_birth ? new Date(data.date_of_birth).toLocaleDateString() : '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Gender</label>
                <p className="text-gray-900 font-medium capitalize">{data.gender || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Marital Status</label>
                <p className="text-gray-900 font-medium capitalize">{data.marital_status || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Blood Group</label>
                <p className="text-gray-900 font-medium">{data.blood_group || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Emergency Contact Name</label>
                <p className="text-gray-900 font-medium">{data.emergency_contact_name || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Emergency Contact Number</label>
                <p className="text-gray-900 font-medium">
                  {data.emergency_contact_number || data.emergency_contact_phone || '-'}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Address</label>
              <p className="text-gray-900 font-medium">
                {data.address || data.current_address?.address_line1 || '-'}
                {(data.city || data.current_address?.city) && `, ${data.city || data.current_address?.city}`}
                {(data.state || data.current_address?.state) && `, ${data.state || data.current_address?.state}`}
                {(data.postal_code || data.current_address?.postal_code) && ` - ${data.postal_code || data.current_address?.postal_code}`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Government IDs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Government IDs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Aadhar Number</label>
                <p className="text-gray-900 font-medium">{data.aadhar_number || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">PAN Number</label>
                <p className="text-gray-900 font-medium">{data.pan_number || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Passport Number</label>
                <p className="text-gray-900 font-medium">{data.passport_number || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Nationality</label>
                <p className="text-gray-900 font-medium">{data.nationality || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bank Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.bank_name || data.bank_details?.bank_name ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Bank Name</label>
                  <p className="text-gray-900 font-medium">
                    {data.bank_name || data.bank_details?.bank_name}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Account Number</label>
                  <p className="text-gray-900 font-medium">
                    {data.bank_account_number || data.bank_details?.account_number
                      ? '****' + (data.bank_account_number || data.bank_details?.account_number || '').slice(-4)
                      : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">IFSC Code</label>
                  <p className="text-gray-900 font-medium">
                    {data.bank_ifsc || data.bank_details?.ifsc_code || '-'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-600">No bank details provided</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // EDIT MODE - Form inputs
  return (
    <form id="profile-form" onSubmit={handleSubmit} className="space-y-6">
      {/* API Error Display */}
      {apiError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{apiError}</p>
        </div>
      )}

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
              <Input
                value={formData.employee_id}
                onChange={(e) => handleInputChange('employee_id', e.target.value)}
                placeholder="Enter employee ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <Input
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                placeholder="Enter department"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
              <Input
                value={formData.designation}
                onChange={(e) => handleInputChange('designation', e.target.value)}
                placeholder="Enter designation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
              <Input
                type="date"
                value={formData.date_of_joining}
                onChange={(e) => handleInputChange('date_of_joining', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <Input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
              <select
                value={formData.marital_status}
                onChange={(e) => handleInputChange('marital_status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
              <Input
                value={formData.blood_group}
                onChange={(e) => handleInputChange('blood_group', e.target.value)}
                placeholder="e.g., O+, A-, B+"
                error={!!errors.blood_group}
              />
              <FormError error={errors.blood_group} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
              <Input
                value={formData.emergency_contact_name}
                onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)}
                placeholder="Enter emergency contact name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Number</label>
              <Input
                value={formData.emergency_contact_number}
                onChange={(e) => handleInputChange('emergency_contact_number', e.target.value)}
                placeholder="Enter emergency contact number"
                error={!!errors.emergency_contact_number}
              />
              <FormError error={errors.emergency_contact_number} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Address</label>
            <div className="space-y-2">
              <Input
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Address line 1"
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="City"
                />
                <Input
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  placeholder="State"
                />
                <div>
                  <Input
                    value={formData.postal_code}
                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                    placeholder="Postal code"
                    error={!!errors.postal_code}
                  />
                  <FormError error={errors.postal_code} />
                </div>
                <Input
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  placeholder="Country"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Government IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Government IDs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number</label>
              <Input
                value={formData.aadhar_number}
                onChange={(e) => handleInputChange('aadhar_number', e.target.value)}
                placeholder="Enter Aadhar number"
                maxLength={12}
                error={!!errors.aadhar_number}
              />
              <FormError error={errors.aadhar_number} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
              <Input
                value={formData.pan_number}
                onChange={(e) => handleInputChange('pan_number', e.target.value.toUpperCase())}
                placeholder="Enter PAN number (e.g., ABCDE1234F)"
                maxLength={10}
                error={!!errors.pan_number}
              />
              <FormError error={errors.pan_number} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number</label>
              <Input
                value={formData.passport_number}
                onChange={(e) => handleInputChange('passport_number', e.target.value.toUpperCase())}
                placeholder="Enter passport number"
                error={!!errors.passport_number}
              />
              <FormError error={errors.passport_number} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
              <Input
                value={formData.nationality}
                onChange={(e) => handleInputChange('nationality', e.target.value)}
                placeholder="Enter nationality"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bank Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
              <Input
                value={formData.bank_name}
                onChange={(e) => handleInputChange('bank_name', e.target.value)}
                placeholder="Enter bank name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <Input
                type="password"
                value={formData.bank_account_number}
                onChange={(e) => handleInputChange('bank_account_number', e.target.value)}
                placeholder="Enter account number (9-18 digits)"
                error={!!errors.bank_account_number}
              />
              <FormError error={errors.bank_account_number} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <Input
                value={formData.bank_ifsc}
                onChange={(e) => handleInputChange('bank_ifsc', e.target.value.toUpperCase())}
                placeholder="Enter IFSC code (e.g., SBIN0001234)"
                error={!!errors.bank_ifsc}
              />
              <FormError error={errors.bank_ifsc} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
