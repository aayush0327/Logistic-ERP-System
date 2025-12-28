'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { User } from '@/services/api/companyApi'
import { DriverProfile } from '@/services/api/profileApi'
import { useCreateDriverProfileMutation, useUpdateDriverProfileMutation } from '@/services/api/profileApi'
import { Save, X, Car, CheckCircle } from 'lucide-react'

interface DriverProfileFormProps {
  user: User
  profile?: DriverProfile | null
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
  // Debug logging to understand data flow
  console.log('DriverProfileForm - profile:', profile)
  console.log('DriverProfileForm - profile.employee:', profile?.employee)
  console.log('DriverProfileForm - isEditing:', isEditing)
  console.log('DriverProfileForm - user:', user)

  const [formData, setFormData] = useState({
    license_number: '',
    license_types: [] as string[],
    license_issue_date: '',
    license_expiry_date: '',
    license_issuing_authority: '',
    badge_number: '',
    badge_expiry_date: '',
    vehicle_preferences: [] as string[],
    preferred_routes: [] as string[],
    experience_years: 0
  })

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
        license_number: profile.license_number || '',
        license_types: profile.license_type ? [profile.license_type] : [], // Map license_type string to array
        license_issue_date: profile.license_issue_date || '',
        license_expiry_date: profile.license_expiry || '', // Map license_expiry to license_expiry_date
        license_issuing_authority: profile.license_issuing_authority || '',
        badge_number: profile.badge_number || '',
        badge_expiry_date: profile.badge_expiry || '', // Map badge_expiry to badge_expiry_date
        vehicle_preferences: profile.preferred_vehicle_types || [], // Map preferred_vehicle_types to vehicle_preferences
        preferred_routes: profile.preferred_routes || [],
        experience_years: profile.experience_years || 0
      })
    }
  }, [profile])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleLicenseTypeToggle = (licenseType: string) => {
    setFormData(prev => ({
      ...prev,
      license_types: prev.license_types.includes(licenseType)
        ? prev.license_types.filter(type => type !== licenseType)
        : [...prev.license_types, licenseType]
    }))
  }

  const handleVehiclePreferenceToggle = (vehicle: string) => {
    setFormData(prev => ({
      ...prev,
      vehicle_preferences: prev.vehicle_preferences.includes(vehicle)
        ? prev.vehicle_preferences.filter(v => v !== vehicle)
        : [...prev.vehicle_preferences, vehicle]
    }))
  }

  const handlePreferredRouteAdd = () => {
    const input = document.getElementById('route-input') as HTMLInputElement
    if (input?.value && input.value.trim()) {
      setFormData(prev => ({
        ...prev,
        preferred_routes: [...prev.preferred_routes, input.value.trim()]
      }))
      input.value = ''
    }
  }

  const handlePreferredRouteRemove = (route: string) => {
    setFormData(prev => ({
      ...prev,
      preferred_routes: prev.preferred_routes.filter(r => r !== route)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Map frontend form data to backend schema
    // Backend expects: license_type (string), license_expiry (datetime), badge_expiry, preferred_vehicle_types
    const submitData = {
      employee_profile_id: user.id,
      license_number: formData.license_number,
      license_type: formData.license_types[0] || 'Light Motor Vehicle (LMV)', // Take first license type
      license_expiry: formData.license_expiry_date, // Map license_expiry_date to license_expiry
      license_issuing_authority: formData.license_issuing_authority,
      badge_number: formData.badge_number,
      badge_expiry: formData.badge_expiry_date, // Map badge_expiry_date to badge_expiry
      preferred_vehicle_types: formData.vehicle_preferences, // Map vehicle_preferences to preferred_vehicle_types
      experience_years: formData.experience_years
    }

    try {
      if (profile) {
        await updateProfile({ driverId: user.id, profile: submitData }).unwrap()
      } else {
        await createProfile({ userId: user.id, profile: submitData }).unwrap()
      }
      onSave()
    } catch (error) {
      console.error('Error saving driver profile:', error)
    }
  }

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

  if (!isEditing && profile) {
    // Use employee data from profile.employee if available, otherwise fallback to user
    const employee = profile.employee || {}
    const employeeName = employee.first_name && employee.last_name
      ? `${employee.first_name} ${employee.last_name}`
      : `${user.first_name} ${user.last_name}`

    return (
      <div className="space-y-6">
        {/* Employee Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <p className="text-gray-900">{employee.employee_id || employee.employee_code || user.employee_id || user.employee_code || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900">{employee.email || user.email || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <p className="text-gray-900">{employee.phone_number || employee.phone || user.phone_number || user.phone || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <p className="text-gray-900">{employee.department || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <p className="text-gray-900">{employee.designation || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
                <p className="text-gray-900">
                  {employee.date_of_joining || employee.hire_date
                    ? (new Date(employee.date_of_joining || employee.hire_date)).toLocaleDateString()
                    : '-'}
                </p>
              </div>
            </div>
            {employee.current_address && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <p className="text-gray-900">
                  {employee.current_address.address_line1}
                  {employee.current_address.city && `, ${employee.current_address.city}`}
                  {employee.current_address.state && `, ${employee.current_address.state}`}
                  {employee.current_address.postal_code && ` - ${employee.current_address.postal_code}`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

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
                <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                <p className="text-gray-900">{profile.license_number}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Authority</label>
                <p className="text-gray-900">{profile.license_issuing_authority || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <p className="text-gray-900">{profile.license_expiry ? (new Date(profile.license_expiry)).toLocaleDateString() : '-'}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Type</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.license_type ? (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                    {profile.license_type}
                  </span>
                ) : (
                  <span className="text-gray-600">No license type specified</span>
                )}
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
                <p className="text-gray-900">{profile.badge_number || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Badge Expiry Date</label>
                <p className="text-gray-900">{profile.badge_expiry ? (new Date(profile.badge_expiry)).toLocaleDateString() : '-'}</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Preferences</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience</label>
              <p className="text-gray-900">{profile.experience_years || 0} years</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <p className="text-gray-900 capitalize">{profile.current_status || 'available'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <form id="profile-form" onSubmit={handleSubmit} className="space-y-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">License Number *</label>
              <Input
                value={formData.license_number}
                onChange={(e) => handleInputChange('license_number', e.target.value)}
                placeholder="Enter license number"
                required
              />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
              <Input
                type="date"
                value={formData.license_issue_date}
                onChange={(e) => handleInputChange('license_issue_date', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
              <Input
                type="date"
                value={formData.license_expiry_date}
                onChange={(e) => handleInputChange('license_expiry_date', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">License Types</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableLicenseTypes.map((type) => (
                <label key={type} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.license_types.includes(type)}
                    onChange={() => handleLicenseTypeToggle(type)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{type}</span>
                </label>
              ))}
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
                    checked={formData.vehicle_preferences.includes(vehicle)}
                    onChange={() => handleVehiclePreferenceToggle(vehicle)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{vehicle}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Routes</label>
            <div className="flex gap-2 mb-2">
              <Input
                id="route-input"
                placeholder="Enter route name"
                className="flex-1"
              />
              <Button type="button" onClick={handlePreferredRouteAdd}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.preferred_routes.map((route, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded-full flex items-center gap-1"
                >
                  {route}
                  <button
                    type="button"
                    onClick={() => handlePreferredRouteRemove(route)}
                    className="text-purple-500 hover:text-purple-700"
                  >
                    ×
                  </button>
                </span>
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
    </form>
  )
}