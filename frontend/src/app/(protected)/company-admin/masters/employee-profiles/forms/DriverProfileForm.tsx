'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import { User } from '@/services/api/companyApi'
import { DriverProfile as DriverProfileType } from '@/services/api/profileApi'
import { useCreateDriverProfileMutation, useUpdateDriverProfileMutation } from '@/services/api/profileApi'
import { Car, X, Save } from 'lucide-react'
import { licenseNumberSchema, futureDateSchema, phoneSchema, emailSchema, validateField, formatApiError } from '@/lib/validations'

interface DriverProfileFormProps {
  user: User
  profile?: DriverProfileType | null
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export default function DriverProfileForm({
  user,
  profile,
  isEditing,
  onEdit,
  onSave,
  onCancel
}: DriverProfileFormProps) {
  const [formData, setFormData] = useState({
    driver_code: '',
    license_number: '',
    license_type: '',
    license_expiry_date: '',
    license_issuing_authority: '',
    badge_number: '',
    badge_expiry_date: '',
    preferred_vehicle_types: [] as string[],
    experience_years: 0
  })

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)

  const availableLicenseTypes = [
    'Light Motor Vehicle (LMV)',
    'Heavy Motor Vehicle (HMV)',
    'Transport Vehicle',
    'Goods Carrier',
    'Passenger Carrier',
    'Trailer',
    'Temporary License'
  ]

  const availableVehicles = [
    'Truck - Light',
    'Truck - Medium',
    'Truck - Heavy',
    'Trailer',
    'Container Truck',
    'Tanker',
    'Flatbed',
    'Refrigerated Truck'
  ]

  const [createProfile, { isLoading: isCreating }] = useCreateDriverProfileMutation()
  const [updateProfile, { isLoading: isUpdating }] = useUpdateDriverProfileMutation()

  useEffect(() => {
    if (profile) {
      setFormData({
        driver_code: profile.driver_code || '',
        license_number: profile.license_number || '',
        license_type: profile.license_type || '',
        license_expiry_date: profile.license_expiry ? profile.license_expiry.split('T')[0] : '',
        license_issuing_authority: profile.license_issuing_authority || '',
        badge_number: profile.badge_number || '',
        badge_expiry_date: profile.badge_expiry ? profile.badge_expiry.split('T')[0] : '',
        preferred_vehicle_types: profile.preferred_vehicle_types || [],
        experience_years: profile.experience_years || 0
      })
    }
  }, [profile])

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

    // Validate license number (required, alphanumeric)
    const licenseError = validateField(licenseNumberSchema, formData.license_number)
    if (licenseError) newErrors.license_number = licenseError

    // Validate license type (required)
    if (!formData.license_type) {
      newErrors.license_type = 'License type is required'
    }

    // Validate license expiry date (must be future date)
    const expiryError = validateField(futureDateSchema, formData.license_expiry_date)
    if (expiryError) newErrors.license_expiry_date = expiryError

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleVehicleToggle = (vehicle: string) => {
    setFormData(prev => ({
      ...prev,
      preferred_vehicle_types: prev.preferred_vehicle_types.includes(vehicle)
        ? prev.preferred_vehicle_types.filter(v => v !== vehicle)
        : [...prev.preferred_vehicle_types, vehicle]
    }))
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
      // Map frontend form data to backend schema
      // Backend expects: license_type (string), license_expiry (datetime), badge_expiry, preferred_vehicle_types
      const profileData = {
        driver_code: formData.driver_code || undefined,
        license_number: formData.license_number,
        license_type: formData.license_type, // String, not array
        license_expiry: formData.license_expiry_date, // Map license_expiry_date to license_expiry
        license_issuing_authority: formData.license_issuing_authority || '',
        badge_number: formData.badge_number,
        badge_expiry: formData.badge_expiry_date, // Map badge_expiry_date to badge_expiry
        preferred_vehicle_types: formData.preferred_vehicle_types, // Map vehicle_preferences to preferred_vehicle_types
        experience_years: formData.experience_years,
      }

      if (profile) {
        await updateProfile({ driverId: profile.id!, profile: profileData }).unwrap()
      } else {
        await createProfile({ userId: user.id, profile: profileData }).unwrap()
      }
      onSave()
    } catch (error) {
      console.error('Error saving driver profile:', error)
      const errorMessage = formatApiError(error)
      setApiError(errorMessage)
    }
  }

  const isLoading = isCreating || isUpdating

  // VIEW MODE - Display existing data
  if (!isEditing && profile) {
    return (
      <div className="space-y-6">
        {/* License Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="w-5 h-5" />
              License Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Driver Code</label>
                <p className="text-gray-900 font-medium">{profile.driver_code || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">License Number</label>
                <p className="text-gray-900 font-medium">{profile.license_number || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">License Type</label>
                <p className="text-gray-900 font-medium">{profile.license_type || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Issuing Authority</label>
                <p className="text-gray-900 font-medium">{profile.license_issuing_authority || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Expiry Date</label>
                <p className="text-gray-900 font-medium">
                  {profile.license_expiry ? new Date(profile.license_expiry).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Badge Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Badge Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Badge Number</label>
                <p className="text-gray-900 font-medium">{profile.badge_number || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Badge Expiry Date</label>
                <p className="text-gray-900 font-medium">
                  {profile.badge_expiry ? new Date(profile.badge_expiry).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Driver Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Driver Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Vehicle Preferences</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.preferred_vehicle_types && profile.preferred_vehicle_types.length > 0 ? (
                  profile.preferred_vehicle_types.map((vehicle, index) => (
                    <span key={index} className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                      {vehicle}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-600">No vehicle preferences specified</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Experience</label>
              <p className="text-gray-900 font-medium">{profile.experience_years || 0} years</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // NO PROFILE YET - Show create prompt
  if (!isEditing && !profile) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Car className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Driver Profile</h3>
          <p className="text-gray-600 mb-4">
            This driver doesn't have a profile yet. Click below to create one.
          </p>
          <Button onClick={onEdit} className="flex items-center gap-2">
            <Car className="w-4 h-4" />
            Create Driver Profile
          </Button>
        </CardContent>
      </Card>
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

      {/* License Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="w-5 h-5" />
            License Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Code</label>
              <Input
                value={formData.driver_code}
                onChange={(e) => handleInputChange('driver_code', e.target.value)}
                placeholder="e.g., DRV-001"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">Unique driver code (letters, numbers, hyphens, underscores)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Number *</label>
              <Input
                value={formData.license_number}
                onChange={(e) => handleInputChange('license_number', e.target.value)}
                placeholder="e.g., DL123456789 or ABC-1234567"
                required
                error={!!errors.license_number}
              />
              <p className="text-xs text-gray-500 mt-1">Alphanumeric only (letters and numbers, no special characters)</p>
              <FormError error={errors.license_number} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Authority</label>
              <Input
                value={formData.license_issuing_authority}
                onChange={(e) => handleInputChange('license_issuing_authority', e.target.value)}
                placeholder="e.g., RTO Mumbai"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Type *</label>
              <select
                value={formData.license_type}
                onChange={(e) => handleInputChange('license_type', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.license_type ? 'border-red-500' : 'border-gray-300'}`}
                required
              >
                <option value="">Select license type</option>
                {availableLicenseTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <FormError error={errors.license_type} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
              <Input
                type="date"
                value={formData.license_expiry_date}
                onChange={(e) => handleInputChange('license_expiry_date', e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
                error={!!errors.license_expiry_date}
              />
              <FormError error={errors.license_expiry_date} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badge Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Badge Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Badge Number</label>
              <Input
                value={formData.badge_number}
                onChange={(e) => handleInputChange('badge_number', e.target.value)}
                placeholder="Enter badge number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Badge Expiry Date</label>
              <Input
                type="date"
                value={formData.badge_expiry_date}
                onChange={(e) => handleInputChange('badge_expiry_date', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Driver Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Driver Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Preferences</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {availableVehicles.map((vehicle) => (
                <label key={vehicle} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.preferred_vehicle_types.includes(vehicle)}
                    onChange={() => handleVehicleToggle(vehicle)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{vehicle}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
            <Input
              type="number"
              min="0"
              value={formData.experience_years}
              onChange={(e) => handleInputChange('experience_years', parseInt(e.target.value) || 0)}
              placeholder="Enter years of experience"
            />
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
