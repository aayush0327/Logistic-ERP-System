'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { User as UserType } from '@/services/api/companyApi'
import { useUpdateEmployeeProfileMutation } from '@/services/api/profileApi'
import { Save, X, User } from 'lucide-react'

interface EmployeeProfileFormProps {
  user: UserType
  profile?: UserType | null
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
    reporting_manager_id: '',
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
    current_address: {
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: ''
    },
    bank_details: {
      bank_name: '',
      account_number: '',
      ifsc_code: '',
      branch_name: '',
      account_type: 'savings' as 'savings' | 'current'
    }
  })

  const [updateProfile, { isLoading: isUpdating }] = useUpdateEmployeeProfileMutation()

  // Initialize form data from user object (which now has all employee fields)
  useEffect(() => {
    // Use the profile if passed, otherwise use user
    const source = profile || user

    setFormData({
      employee_id: source.employee_id || source.employee_code || '',
      department: source.department || '',
      designation: source.designation || '',
      date_of_joining: source.date_of_joining || source.hire_date || '',
      reporting_manager_id: source.reporting_manager_id || source.reports_to || '',
      emergency_contact_name: source.emergency_contact_name || '',
      emergency_contact_number: source.emergency_contact_number || source.emergency_contact_phone || '',
      blood_group: source.blood_group || '',
      date_of_birth: source.date_of_birth || '',
      gender: (source.gender || '') as 'male' | 'female' | 'other' | '',
      marital_status: (source.marital_status || '') as 'single' | 'married' | 'divorced' | 'widowed' | '',
      nationality: source.nationality || '',
      aadhar_number: source.aadhar_number || source.aadhaar_number || '',
      pan_number: source.pan_number || '',
      passport_number: source.passport_number || '',
      current_address: source.current_address ? {
        address_line1: source.current_address.address_line1 || '',
        address_line2: source.current_address.address_line2 || '',
        city: source.current_address.city || '',
        state: source.current_address.state || '',
        postal_code: source.current_address.postal_code || '',
        country: source.current_address.country || 'India'
      } : {
        address_line1: source.address || '',
        address_line2: '',
        city: source.city || '',
        state: source.state || '',
        postal_code: source.postal_code || '',
        country: source.country || 'India'
      },
      bank_details: source.bank_details ? {
        bank_name: source.bank_details.bank_name || '',
        account_number: source.bank_details.account_number || '',
        ifsc_code: source.bank_details.ifsc_code || '',
        branch_name: source.bank_details.branch_name || '',
        account_type: source.bank_details.account_type || 'savings' as 'savings' | 'current'
      } : {
        bank_name: source.bank_name || '',
        account_number: source.bank_account_number || '',
        ifsc_code: source.bank_ifsc || '',
        branch_name: '',
        account_type: 'savings' as 'savings' | 'current'
      }
    })
  }, [user, profile])

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Map frontend format to backend format
      const updateData: any = {
        employee_code: formData.employee_id || undefined,
        designation: formData.designation || undefined,
        department: formData.department || undefined,
        hire_date: formData.date_of_joining || undefined,
        reports_to: formData.reporting_manager_id || undefined,
        emergency_contact_name: formData.emergency_contact_name || undefined,
        emergency_contact_phone: formData.emergency_contact_number || undefined,
        blood_group: formData.blood_group || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender || undefined,
        address: formData.current_address?.address_line1 || undefined,
        city: formData.current_address?.city || undefined,
        state: formData.current_address?.state || undefined,
        postal_code: formData.current_address?.postal_code || undefined,
        country: formData.current_address?.country || undefined,
        bank_name: formData.bank_details?.bank_name || undefined,
        bank_account_number: formData.bank_details?.account_number || undefined,
        bank_ifsc: formData.bank_details?.ifsc_code || undefined,
        pan_number: formData.pan_number || undefined,
        aadhar_number: formData.aadhar_number || undefined,
        marital_status: formData.marital_status || undefined,
        nationality: formData.nationality || undefined,
        passport_number: formData.passport_number || undefined,
      }

      await updateProfile({ userId: user.id, profile: updateData }).unwrap()
      onSave()
    } catch (error) {
      console.error('Error saving profile:', error)
    }
  }

  // Check if user has any profile data
  const source = profile || user
  const hasProfileData = !!(
    source.designation ||
    source.department ||
    source.employee_code ||
    source.employee_id
  )

  if (!isEditing && !hasProfileData) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Employee Profile</h3>
          <p className="text-gray-600 mb-4">
            This employee doesn't have a profile yet. Click below to create one.
          </p>
          <Button onClick={onEdit} className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Create Employee Profile
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!isEditing) {
    // Read-only view - display current data
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <p className="text-gray-900">{formData.employee_id || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <p className="text-gray-900">{formData.department || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <p className="text-gray-900">{formData.designation || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining</label>
                <p className="text-gray-900">{formData.date_of_joining || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <p className="text-gray-900">{formData.date_of_birth || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <p className="text-gray-900 capitalize">{formData.gender || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                <p className="text-gray-900">{formData.blood_group || '-'}</p>
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
                <p className="text-gray-900">{formData.emergency_contact_name || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Number</label>
                <p className="text-gray-900">{formData.emergency_contact_number || '-'}</p>
              </div>
            </div>
            {(formData.current_address.address_line1 || formData.current_address.city) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Address</label>
                <p className="text-gray-900">
                  {formData.current_address.address_line1}
                  {formData.current_address.address_line2 && `, ${formData.current_address.address_line2}`}
                  <br />
                  {formData.current_address.city}, {formData.current_address.state} {formData.current_address.postal_code}
                  <br />
                  {formData.current_address.country}
                </p>
              </div>
            )}
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
                <p className="text-gray-900">{formData.aadhar_number || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                <p className="text-gray-900">{formData.pan_number || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        {(formData.bank_details.bank_name || formData.bank_details.account_number) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bank Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <p className="text-gray-900">{formData.bank_details.bank_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <p className="text-gray-900">{'****' + formData.bank_details.account_number.slice(-4)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                  <p className="text-gray-900">{formData.bank_details.ifsc_code}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Edit mode - show form
  return (
    <form id="profile-form" onSubmit={handleSubmit} className="space-y-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
              <Input
                value={formData.blood_group}
                onChange={(e) => handleInputChange('blood_group', e.target.value)}
                placeholder="e.g., O+, A-, B+"
              />
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
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Address</label>
            <div className="space-y-2">
              <Input
                value={formData.current_address.address_line1}
                onChange={(e) => handleInputChange('current_address.address_line1', e.target.value)}
                placeholder="Address line 1"
              />
              <Input
                value={formData.current_address.address_line2}
                onChange={(e) => handleInputChange('current_address.address_line2', e.target.value)}
                placeholder="Address line 2 (optional)"
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Input
                  value={formData.current_address.city}
                  onChange={(e) => handleInputChange('current_address.city', e.target.value)}
                  placeholder="City"
                />
                <Input
                  value={formData.current_address.state}
                  onChange={(e) => handleInputChange('current_address.state', e.target.value)}
                  placeholder="State"
                />
                <Input
                  value={formData.current_address.postal_code}
                  onChange={(e) => handleInputChange('current_address.postal_code', e.target.value)}
                  placeholder="Postal code"
                />
                <Input
                  value={formData.current_address.country}
                  onChange={(e) => handleInputChange('current_address.country', e.target.value)}
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
              <Input
                value={formData.pan_number}
                onChange={(e) => handleInputChange('pan_number', e.target.value)}
                placeholder="Enter PAN number"
                maxLength={10}
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
                value={formData.bank_details.bank_name}
                onChange={(e) => handleInputChange('bank_details.bank_name', e.target.value)}
                placeholder="Enter bank name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <Input
                type="password"
                value={formData.bank_details.account_number}
                onChange={(e) => handleInputChange('bank_details.account_number', e.target.value)}
                placeholder="Enter account number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <Input
                value={formData.bank_details.ifsc_code}
                onChange={(e) => handleInputChange('bank_details.ifsc_code', e.target.value)}
                placeholder="Enter IFSC code"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
