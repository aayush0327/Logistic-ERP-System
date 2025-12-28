'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { User } from '@/services/api/companyApi'
import { BranchManagerProfileExtended } from '@/services/api/profileApi'
import { useCreateBranchManagerProfileMutation, useUpdateBranchManagerProfileMutation } from '@/services/api/profileApi'
import { useGetBranchesQuery } from '@/services/api/companyApi'
import { Save, X, Building, CheckCircle } from 'lucide-react'

interface BranchManagerProfileFormProps {
  user: User
  profile?: BranchManagerProfileExtended | null
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export default function BranchManagerProfileForm({
  user,
  profile,
  isEditing,
  onEdit,
  onSave,
  onCancel
}: BranchManagerProfileFormProps) {
  const [formData, setFormData] = useState({
    managed_branch_id: '',
    can_create_quotes: false,
    can_approve_discounts: false,
    max_discount_percentage: 0,
    can_manage_inventory: false,
    can_manage_vehicles: false,
    staff_management_permissions: {
      hire: false,
      terminate: false,
      approve_leave: false,
      schedule_shifts: false,
      performance_reviews: false,
      salary_adjustments: false
    }
  })

  const { data: branches } = useGetBranchesQuery({})
  const [createProfile, { isLoading: isCreating }] = useCreateBranchManagerProfileMutation()
  const [updateProfile, { isLoading: isUpdating }] = useUpdateBranchManagerProfileMutation()

  useEffect(() => {
    if (profile) {
      setFormData({
        managed_branch_id: profile.managed_branch_id || '',
        can_create_quotes: profile.can_create_quotes || false,
        can_approve_discounts: profile.can_approve_discounts || false,
        max_discount_percentage: profile.max_discount_percentage || 0,
        can_manage_inventory: profile.can_manage_inventory || false,
        can_manage_vehicles: profile.can_manage_vehicles || false,
        staff_management_permissions: {
          hire: profile.staff_management_permissions?.hire || false,
          terminate: profile.staff_management_permissions?.terminate || false,
          approve_leave: profile.staff_management_permissions?.approve_leave || false,
          schedule_shifts: profile.staff_management_permissions?.schedule_shifts || false,
          performance_reviews: profile.staff_management_permissions?.performance_reviews || false,
          salary_adjustments: profile.staff_management_permissions?.salary_adjustments || false
        }
      })
    }
  }, [profile])

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
      if (profile) {
        await updateProfile({ userId: user.id, profile: formData }).unwrap()
      } else {
        await createProfile({ userId: user.id, profile: formData }).unwrap()
      }
      onSave()
    } catch (error) {
      console.error('Error saving branch manager profile:', error)
    }
  }

  if (!isEditing && !profile) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Branch Manager Profile</h3>
          <p className="text-gray-600 mb-4">
            This branch manager doesn't have a profile yet. Click below to create one.
          </p>
          <Button onClick={onEdit} className="flex items-center gap-2">
            <Building className="w-4 h-4" />
            Create Branch Manager Profile
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!isEditing && profile) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Branch Manager Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Managed Branch</label>
                <p className="text-gray-900">
                  {branches?.items.find(b => b.id === profile.managed_branch_id)?.name || '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Discount Percentage</label>
                <p className="text-gray-900">{profile.max_discount_percentage || 0}%</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Permissions</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_create_quotes ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Create Quotes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_approve_discounts ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Approve Discounts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_manage_inventory ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Manage Inventory</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_manage_vehicles ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Manage Vehicles</span>
                </div>
              </div>

              <h4 className="font-medium text-gray-900 mt-4">Staff Management Permissions</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.staff_management_permissions?.hire ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Hire Staff</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.staff_management_permissions?.terminate ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Terminate Staff</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.staff_management_permissions?.approve_leave ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Approve Leave</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.staff_management_permissions?.schedule_shifts ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Schedule Shifts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.staff_management_permissions?.performance_reviews ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Performance Reviews</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.staff_management_permissions?.salary_adjustments ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Salary Adjustments</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <form id="profile-form" onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Branch Manager Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Managed Branch</label>
              <select
                value={formData.managed_branch_id}
                onChange={(e) => handleInputChange('managed_branch_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select branch</option>
                {branches?.items.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Discount Percentage</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.max_discount_percentage}
                onChange={(e) => handleInputChange('max_discount_percentage', parseFloat(e.target.value) || 0)}
                placeholder="Enter max discount %"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Permissions</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_create_quotes}
                  onChange={(e) => handleInputChange('can_create_quotes', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Create Quotes</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_approve_discounts}
                  onChange={(e) => handleInputChange('can_approve_discounts', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Approve Discounts</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_manage_inventory}
                  onChange={(e) => handleInputChange('can_manage_inventory', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Manage Inventory</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_manage_vehicles}
                  onChange={(e) => handleInputChange('can_manage_vehicles', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Manage Vehicles</span>
              </label>
            </div>

            <h4 className="font-medium text-gray-900 mt-4">Staff Management Permissions</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.staff_management_permissions.hire}
                  onChange={(e) => handleInputChange('staff_management_permissions.hire', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Hire Staff</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.staff_management_permissions.terminate}
                  onChange={(e) => handleInputChange('staff_management_permissions.terminate', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Terminate Staff</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.staff_management_permissions.approve_leave}
                  onChange={(e) => handleInputChange('staff_management_permissions.approve_leave', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Approve Leave</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.staff_management_permissions.schedule_shifts}
                  onChange={(e) => handleInputChange('staff_management_permissions.schedule_shifts', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Schedule Shifts</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.staff_management_permissions.performance_reviews}
                  onChange={(e) => handleInputChange('staff_management_permissions.performance_reviews', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Performance Reviews</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.staff_management_permissions.salary_adjustments}
                  onChange={(e) => handleInputChange('staff_management_permissions.salary_adjustments', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Salary Adjustments</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}