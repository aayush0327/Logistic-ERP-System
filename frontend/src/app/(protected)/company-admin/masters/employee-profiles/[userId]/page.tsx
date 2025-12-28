'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useGetUserQuery } from '@/services/api/companyApi'
import {
  useGetDriverProfileByUserQuery,
  useGetBranchManagerProfileByUserQuery,
  useGetFinanceManagerProfileByUserQuery,
  useGetLogisticsManagerProfileByUserQuery,
  DriverProfile,
  BranchManagerProfileExtended,
  FinanceManagerProfile,
  LogisticsManagerProfile,
} from '@/services/api/profileApi'
import { User } from '@/services/api/companyApi'
import EmployeeProfileForm from '../forms/EmployeeProfileForm'
import DriverProfileForm from '../forms/DriverProfileForm'
import BranchManagerProfileForm from '../forms/BranchManagerProfileForm'
import FinanceManagerProfileForm from '../forms/FinanceManagerProfileForm'
import LogisticsManagerProfileForm from '../forms/LogisticsManagerProfileForm'
import { ArrowLeft, User as UserIcon, Car, Building2, DollarSign, Truck, CheckCircle, Loader2, Pencil, Save } from 'lucide-react'

// ============================================================================
// TYPES & UTILITIES
// ============================================================================

type TabType = 'basic' | 'license' | 'branch' | 'finance' | 'logistics'

interface ProfileConfig {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  label: string
  tabId: TabType | null
  tabLabel: string | null
}

// Check if user has completed the basic employee profile
const hasEmployeeProfile = (user: User | null): boolean => {
  if (!user) return false
  return !!(
    user.designation ||
    user.department ||
    user.employee_code ||
    user.employee_id
  )
}

// Helper functions to check user role
const isDriverRole = (user: User | null) => {
  if (!user) return false
  const roleName = (user.role?.name || user.role?.role_name || '').toLowerCase()
  return roleName.includes('driver')
}

const isBranchManagerRole = (user: User | null) => {
  if (!user) return false
  const roleName = (user.role?.name || user.role?.role_name || '').toLowerCase()
  return roleName.includes('branch') && roleName.includes('manager')
}

const isFinanceManagerRole = (user: User | null) => {
  if (!user) return false
  const roleName = (user.role?.name || user.role?.role_name || '').toLowerCase()
  return roleName.includes('finance') && roleName.includes('manager')
}

const isLogisticsManagerRole = (user: User | null) => {
  if (!user) return false
  const roleName = (user.role?.name || user.role?.role_name || '').toLowerCase()
  return roleName.includes('logistics') && roleName.includes('manager')
}

const getProfileConfig = (user: User | null): ProfileConfig => {
  if (!user || !user.role) {
    return {
      icon: UserIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      label: 'Employee',
      tabId: null,
      tabLabel: null
    }
  }

  const roleName = (user.role?.name || user.role?.role_name || '').toLowerCase()

  if (roleName.includes('driver')) {
    return {
      icon: Car,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      label: 'Driver',
      tabId: 'license',
      tabLabel: 'License Info'
    }
  }

  if (roleName.includes('branch') && roleName.includes('manager')) {
    return {
      icon: Building2,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      label: 'Branch Manager',
      tabId: 'branch',
      tabLabel: 'Branch Info'
    }
  }

  if (roleName.includes('finance') && roleName.includes('manager')) {
    return {
      icon: DollarSign,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      label: 'Finance Manager',
      tabId: 'finance',
      tabLabel: 'Finance Info'
    }
  }

  if (roleName.includes('logistics') && roleName.includes('manager')) {
    return {
      icon: Truck,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      label: 'Logistics Manager',
      tabId: 'logistics',
      tabLabel: 'Logistics Info'
    }
  }

  return {
    icon: UserIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Employee',
    tabId: null,
    tabLabel: null
  }
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function EmployeeProfileDetailPage() {
  const params = useParams()
  const router = useRouter()

  // ============================================================================
  // STATE
  // ============================================================================
  const [activeTab, setActiveTab] = useState<TabType>('basic')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ============================================================================
  // URL PARAMETER EXTRACTION
  // ============================================================================
  const getUserIdFromParams = (): string | null => {
    const userIdParam = params.userId
    if (!userIdParam) return null
    if (Array.isArray(userIdParam)) return userIdParam[0] || null
    if (typeof userIdParam === 'string') return userIdParam
    return null
  }

  const userId = getUserIdFromParams()

  // Redirect if userId is invalid
  useEffect(() => {
    if (!userId) {
      router.push('/company-admin/masters/employee-profiles')
    }
  }, [userId, router])

  if (!userId) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-20">
          <p className="text-red-600">Invalid user ID. Redirecting...</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  const { data: user, isLoading, error, refetch } = useGetUserQuery(userId, {
    skip: !userId
  })

  // Fetch driver profile if user is a driver
  const skipDriverProfile = !user || !user.id || !isDriverRole(user)
  const { data: driverProfile } = useGetDriverProfileByUserQuery(
    user?.id || '',
    { skip: skipDriverProfile }
  )

  // Fetch branch manager profile if user is a branch manager
  const skipBranchManagerProfile = !user || !user.id || !isBranchManagerRole(user)
  const { data: branchManagerProfile } = useGetBranchManagerProfileByUserQuery(
    user?.id || '',
    { skip: skipBranchManagerProfile }
  )

  // Fetch finance manager profile if user is a finance manager
  const skipFinanceManagerProfile = !user || !user.id || !isFinanceManagerRole(user)
  const { data: financeManagerProfile } = useGetFinanceManagerProfileByUserQuery(
    user?.id || '',
    { skip: skipFinanceManagerProfile }
  )

  // Fetch logistics manager profile if user is a logistics manager
  const skipLogisticsManagerProfile = !user || !user.id || !isLogisticsManagerRole(user)
  const { data: logisticsManagerProfile } = useGetLogisticsManagerProfileByUserQuery(
    user?.id || '',
    { skip: skipLogisticsManagerProfile }
  )

  // Redirect to list page if user not found
  useEffect(() => {
    if (error && !isLoading) {
      router.push('/company-admin/masters/employee-profiles')
    }
  }, [error, isLoading, router])

  // ============================================================================
  // DERIVED VALUES
  // ============================================================================
  const config = getProfileConfig(user || null)
  const ProfileIcon = config.icon
  const profileLabel = config.label
  const employeeProfileComplete = hasEmployeeProfile(user || null)

  const hasRoleSpecificProfile = () => {
    if (isDriverRole(user || null)) return !!driverProfile
    if (isBranchManagerRole(user || null)) return !!branchManagerProfile
    if (isFinanceManagerRole(user || null)) return !!financeManagerProfile
    if (isLogisticsManagerRole(user || null)) return !!logisticsManagerProfile
    return false
  }

  const roleProfile = isDriverRole(user || null)
    ? driverProfile
    : isBranchManagerRole(user || null)
    ? branchManagerProfile
    : isFinanceManagerRole(user || null)
    ? financeManagerProfile
    : isLogisticsManagerRole(user || null)
    ? logisticsManagerProfile
    : null

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      // Refetch user data after save
      await refetch()
      setSaveSuccess(true)
      setIsEditing(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError('Failed to save profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setSaveError(null)
  }

  const handleTabChange = (tabId: TabType) => {
    if (tabId !== 'basic' && !employeeProfileComplete) {
      return
    }
    setActiveTab(tabId)
    // Don't reset isEditing when switching tabs - keep edit state
  }

  const handleEdit = () => {
    setIsEditing(true)
    setSaveError(null)
  }

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="ml-3 text-gray-600">Loading employee profile...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-20">
          <p className="text-gray-600">Employee not found</p>
          <Button onClick={() => router.push('/company-admin/masters/employee-profiles')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Employee Profiles
          </Button>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  const renderForm = () => {
    if (activeTab === 'basic') {
      // EmployeeProfileForm gets user data directly, not role-specific profile
      return (
        <EmployeeProfileForm
          user={user}
          profile={null}
          isEditing={isEditing}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )
    } else if (activeTab === 'license') {
      return (
        <DriverProfileForm
          user={user}
          profile={roleProfile as DriverProfile | null}
          isEditing={isEditing}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )
    } else if (activeTab === 'branch') {
      return (
        <BranchManagerProfileForm
          user={user}
          profile={roleProfile as BranchManagerProfileExtended | null}
          isEditing={isEditing}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )
    } else if (activeTab === 'finance') {
      return (
        <FinanceManagerProfileForm
          user={user}
          profile={roleProfile as FinanceManagerProfile | null}
          isEditing={isEditing}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )
    } else if (activeTab === 'logistics') {
      return (
        <LogisticsManagerProfileForm
          user={user}
          profile={roleProfile as LogisticsManagerProfile | null}
          isEditing={isEditing}
          onEdit={handleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )
    }
    return null
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push('/company-admin/masters/employee-profiles')}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Employee Profiles
      </Button>

      {/* Header Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full ${config.bgColor} flex items-center justify-center`}>
                <ProfileIcon className={`w-8 h-8 ${config.color}`} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {user.first_name} {user.last_name}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-gray-600">{user.email}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm font-medium text-gray-700">{profileLabel}</span>
                  {employeeProfileComplete && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Profile Complete
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="flex items-center gap-2"
                >
                  {employeeProfileComplete ? (
                    <>
                      <Pencil className="w-4 h-4" />
                      Edit
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Create Profile
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                employeeProfileComplete ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white'
              }`}>
                {employeeProfileComplete ? '✓' : '1'}
              </div>
              <span className="text-sm font-medium text-gray-700">Basic Info</span>
            </div>
            <div className={`w-16 h-0.5 ${employeeProfileComplete ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                hasRoleSpecificProfile() ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {hasRoleSpecificProfile() ? '✓' : '2'}
              </div>
              <span className="text-sm font-medium text-gray-700">{profileLabel} Profile</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      {employeeProfileComplete && config.tabId && (
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-6">
            <button
              onClick={() => handleTabChange('basic')}
              className={`pb-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'basic'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Basic Info
            </button>
            <button
              onClick={() => handleTabChange(config.tabId!)}
              className={`pb-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === config.tabId
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {config.tabLabel}
            </button>
          </nav>
        </div>
      )}

      {/* Success/Error Messages */}
      {saveSuccess && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">Profile saved successfully!</span>
            </div>
          </CardContent>
        </Card>
      )}

      {saveError && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <span className="font-medium">{saveError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Messages */}
      {!employeeProfileComplete && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-blue-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-blue-800">Complete Employee Profile</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Fill in the basic employee information to get started.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Content */}
      <div className="mb-24">
        {renderForm()}
      </div>
    </div>
  )
}
