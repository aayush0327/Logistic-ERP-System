'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { User } from '@/services/api/companyApi'
import { LogisticsManagerProfile } from '@/services/api/profileApi'
import { useCreateLogisticsManagerProfileMutation, useUpdateLogisticsManagerProfileMutation } from '@/services/api/profileApi'
import { useGetBranchesQuery } from '@/services/api/companyApi'
import { Save, X, Truck, CheckCircle } from 'lucide-react'

interface LogisticsManagerProfileFormProps {
  user: User
  profile?: LogisticsManagerProfile | null
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export default function LogisticsManagerProfileForm({
  user,
  profile,
  isEditing,
  onEdit,
  onSave,
  onCancel
}: LogisticsManagerProfileFormProps) {
  const [formData, setFormData] = useState({
    managed_branches: [] as string[],
    can_plan_routes: false,
    can_dispatch_vehicles: false,
    can_manage_drivers: false,
    can_track_shipments: false,
    can_handle_emergency_dispatch: false,
    fleet_management_permissions: {
      can_maintain_vehicles: false,
      can_purchase_vehicles: false,
      can_sell_vehicles: false,
      can_monitor_fuel: false
    }
  })

  const { data: branches } = useGetBranchesQuery({})
  const [createProfile, { isLoading: isCreating }] = useCreateLogisticsManagerProfileMutation()
  const [updateProfile, { isLoading: isUpdating }] = useUpdateLogisticsManagerProfileMutation()

  useEffect(() => {
    if (profile) {
      setFormData({
        managed_branches: profile.managed_branches || [],
        can_plan_routes: profile.can_plan_routes || false,
        can_dispatch_vehicles: profile.can_dispatch_vehicles || false,
        can_manage_drivers: profile.can_manage_drivers || false,
        can_track_shipments: profile.can_track_shipments || false,
        can_handle_emergency_dispatch: profile.can_handle_emergency_dispatch || false,
        fleet_management_permissions: {
          can_maintain_vehicles: profile.fleet_management_permissions?.can_maintain_vehicles || false,
          can_purchase_vehicles: profile.fleet_management_permissions?.can_purchase_vehicles || false,
          can_sell_vehicles: profile.fleet_management_permissions?.can_sell_vehicles || false,
          can_monitor_fuel: profile.fleet_management_permissions?.can_monitor_fuel || false
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

  const handleManagedBranchToggle = (branchId: string) => {
    setFormData(prev => ({
      ...prev,
      managed_branches: prev.managed_branches.includes(branchId)
        ? prev.managed_branches.filter(id => id !== branchId)
        : [...prev.managed_branches, branchId]
    }))
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
      console.error('Error saving logistics manager profile:', error)
    }
  }

  if (!isEditing && !profile) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Logistics Manager Profile</h3>
          <p className="text-gray-600 mb-4">
            This logistics manager doesn't have a profile yet. Click below to create one.
          </p>
          <Button onClick={onEdit} className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Create Logistics Manager Profile
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
            <CardTitle className="text-lg">Logistics Manager Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Managed Branches</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.managed_branches?.map((branchId) => {
                  const branch = branches?.items.find(b => b.id === branchId)
                  return branch ? (
                    <span key={branchId} className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                      {branch.name}
                    </span>
                  ) : null
                }) || <span className="text-gray-600">No branches assigned</span>}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Logistics Permissions</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_plan_routes ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Plan Routes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_dispatch_vehicles ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Dispatch Vehicles</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_manage_drivers ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Manage Drivers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_track_shipments ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Track Shipments</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_handle_emergency_dispatch ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Emergency Dispatch</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 mt-4">Fleet Management Permissions</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.fleet_management_permissions?.can_maintain_vehicles ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Maintain Vehicles</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.fleet_management_permissions?.can_purchase_vehicles ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Purchase Vehicles</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.fleet_management_permissions?.can_sell_vehicles ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Sell Vehicles</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.fleet_management_permissions?.can_monitor_fuel ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Monitor Fuel</span>
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
          <CardTitle className="text-lg">Logistics Manager Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Managed Branches</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {branches?.items.map((branch) => (
                <label key={branch.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.managed_branches.includes(branch.id)}
                    onChange={() => handleManagedBranchToggle(branch.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{branch.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Logistics Permissions</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_plan_routes}
                  onChange={(e) => handleInputChange('can_plan_routes', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Plan Routes</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_dispatch_vehicles}
                  onChange={(e) => handleInputChange('can_dispatch_vehicles', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Dispatch Vehicles</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_manage_drivers}
                  onChange={(e) => handleInputChange('can_manage_drivers', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Manage Drivers</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_track_shipments}
                  onChange={(e) => handleInputChange('can_track_shipments', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Track Shipments</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_handle_emergency_dispatch}
                  onChange={(e) => handleInputChange('can_handle_emergency_dispatch', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Emergency Dispatch</span>
              </label>
            </div>

            <h4 className="font-medium text-gray-900 mt-4">Fleet Management Permissions</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.fleet_management_permissions.can_maintain_vehicles}
                  onChange={(e) => handleInputChange('fleet_management_permissions.can_maintain_vehicles', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Maintain Vehicles</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.fleet_management_permissions.can_purchase_vehicles}
                  onChange={(e) => handleInputChange('fleet_management_permissions.can_purchase_vehicles', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Purchase Vehicles</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.fleet_management_permissions.can_sell_vehicles}
                  onChange={(e) => handleInputChange('fleet_management_permissions.can_sell_vehicles', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Sell Vehicles</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.fleet_management_permissions.can_monitor_fuel}
                  onChange={(e) => handleInputChange('fleet_management_permissions.can_monitor_fuel', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Monitor Fuel</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}