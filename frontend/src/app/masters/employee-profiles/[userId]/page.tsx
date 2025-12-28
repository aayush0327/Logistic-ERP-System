'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useGetUserQuery } from '@/services/api/companyApi'
import { useGetDriverProfileByUserQuery, useGetBranchManagerProfileByUserQuery, useGetFinanceManagerProfileByUserQuery, useGetLogisticsManagerProfileByUserQuery } from '@/services/api/profileApi'
import { User } from '@/services/api/companyApi'
import { DriverProfile, BranchManagerProfileExtended, FinanceManagerProfile, LogisticsManagerProfile } from '@/services/api/profileApi'
import EmployeeProfileForm from '../forms/EmployeeProfileForm'
import DriverProfileForm from '../forms/DriverProfileForm'
import BranchManagerProfileForm from '../forms/BranchManagerProfileForm'
import FinanceManagerProfileForm from '../forms/FinanceManagerProfileForm'
import LogisticsManagerProfileForm from '../forms/LogisticsManagerProfileForm'
import { ArrowLeft, User, Car, Building, Truck, DollarSign, FileText, AlertCircle, CheckCircle, Save, X, Loader2 } from 'lucide-react'

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

const getProfileConfig = (roleName: string | undefined) => {
  const name = (roleName || '').toLowerCase()

  if (name.includes('driver')) {
    return {
      icon: Car,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      label: 'Driver',
      tabId: 'license',
      tabLabel: 'License Info'
    }
  } else if (name.includes('branch manager') || name.includes('branch-manager')) {
    return {
      icon: Building,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      label: 'Branch Manager',
      tabId: 'branch',
      tabLabel: 'Branch Management'
    }
  } else if (name.includes('finance manager') || name.includes('finance-manager')) {
    return {
      icon: DollarSign,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      label: 'Finance Manager',
      tabId: 'finance',
      tabLabel: 'Finance Settings'
    }
  } else if (name.includes('logistics manager') || name.includes('logistics-manager')) {
    return {
      icon: Truck,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      label: 'Logistics Manager',
      tabId: 'logistics',
      tabLabel: 'Logistics Settings'
    }
  }
  return {
    icon: User,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Employee',
    tabId: null,
    tabLabel: null
  }
}

export default function EmployeeProfileDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string

  const [activeTab, setActiveTab] = useState<'basic' | 'license' | 'branch' | 'finance' | 'logistics'>('basic')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Fetch user details
  const { data: user, isLoading, error, refetch } = useGetUserQuery(userId)

  // Fetch role-specific profiles
  const driverProfileResult = useGetDriverProfileByUserQuery(userId, { skip: !user })
  const { data: driverProfile } = driverProfileResult
  const { data: branchManagerProfile } = useGetBranchManagerProfileByUserQuery(userId, { skip: !user })
  const { data: financeManagerProfile } = useGetFinanceManagerProfileByUserQuery(userId, { skip: !user })
  const { data: logisticsManagerProfile } = useGetLogisticsManagerProfileByUserQuery(userId, { skip: !user })

  // Debug logging for driver profile
  useEffect(() => {
    console.log('Page - driverProfileResult:', driverProfileResult)
    console.log('Page - driverProfile:', driverProfile)
    console.log('Page - isLoading:', driverProfileResult.isLoading)
    console.log('Page - isFetching:', driverProfileResult.isFetching)
    console.log('Page - status:', driverProfileResult.status)
    console.log('Page - error:', driverProfileResult.error)
  }, [driverProfileResult])

  // Redirect to list page if user not found
  useEffect(() => {
    if (error && !isLoading) {
      router.push('/masters/employee-profiles')
    }
  }, [error, isLoading, router])

  const config = user ? getProfileConfig(user.role_name || user.role?.name) : getProfileConfig(undefined)
  const ProfileIcon = config.icon
  const profileLabel = config.label
  const employeeProfileComplete = hasEmployeeProfile(user || null)

  // Debug logging for user and config
  useEffect(() => {
    console.log('Page - user:', user)
    console.log('Page - config:', config)
    console.log('Page - profileLabel:', profileLabel)
    console.log('Page - employeeProfileComplete:', employeeProfileComplete)
    console.log('Page - activeTab:', activeTab)
    console.log('Page - config.tabId:', config.tabId)
  }, [user, config, profileLabel, employeeProfileComplete, activeTab])

  // Define tabs based on employee profile completion
  const tabs = [
    { id: 'basic' as const, label: '1. Basic Info', icon: User }
  ]

  if (employeeProfileComplete && config.tabId) {
    tabs.push({ id: config.tabId as any, label: `2. ${config.tabLabel}!`, icon: config.icon })
  }

  const handleSave = () => {
    setIsSaving(true)
    setSaveError(null)

    // Simulate save and refetch
    setTimeout(() => {
      setIsSaving(false)
      setIsEditing(false)
      setJustSaved(true)
      refetch()

      setTimeout(() => setJustSaved(false), 3000)
    }, 1000)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setSaveError(null)
  }

  const handleTabChange = (tabId: typeof activeTab) => {
    if (tabId !== 'basic' && !employeeProfileComplete) {
      return
    }
    setActiveTab(tabId)
    setIsEditing(false)
  }

  const renderForm = () => {
    if (!user) return null

    // Get the appropriate profile based on active tab
    let profile: DriverProfile | BranchManagerProfileExtended | FinanceManagerProfile | LogisticsManagerProfile | null = null
    if (activeTab === 'license') {
      profile = driverProfile || null
      console.log('renderForm - activeTab: license, profile:', profile)
      console.log('renderForm - driverProfile:', driverProfile)
    } else if (activeTab === 'branch') {
      profile = branchManagerProfile || null
    } else if (activeTab === 'finance') {
      profile = financeManagerProfile || null
    } else if (activeTab === 'logistics') {
      profile = logisticsManagerProfile || null
    }

    const formProps = {
      user,
      profile,
      isEditing,
      onEdit: () => setIsEditing(true),
      onSave: handleSave,
      onCancel: handleCancel
    }

    if (activeTab === 'basic') {
      return <EmployeeProfileForm {...formProps} />
    } else if (activeTab === 'license') {
      return <DriverProfileForm {...formProps} />
    } else if (activeTab === 'branch') {
      return <BranchManagerProfileForm {...formProps} />
    } else if (activeTab === 'finance') {
      return <FinanceManagerProfileForm {...formProps} />
    } else if (activeTab === 'logistics') {
      return <LogisticsManagerProfileForm {...formProps} />
    }
    return <EmployeeProfileForm {...formProps} />
  }

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
          <Button onClick={() => router.push('/masters/employee-profiles')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Employee Profiles
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.push('/masters/employee-profiles')} className="mb-4">
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
                        Basic Profile Complete
                      </span>
                    </>
                  )}
                  {user.role?.name && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-500">{user.role.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                employeeProfileComplete ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white'
              }`}>
                {employeeProfileComplete ? '✓' : activeTab === 'basic' && isEditing ? '⠿' : '1'}
              </div>
              <span className={`text-sm font-medium ${activeTab === 'basic' ? 'text-blue-600' : 'text-gray-700'}`}>
                Basic Info
              </span>
            </div>
            <div className={`w-12 h-0.5 ${employeeProfileComplete ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                employeeProfileComplete && activeTab !== 'basic' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {employeeProfileComplete ? '2' : '⏳'}
              </div>
              <span className={`text-sm font-medium ${activeTab !== 'basic' ? 'text-blue-600' : 'text-gray-500'}`}>
                {profileLabel} Profile
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex -mb-px gap-2">
            {tabs.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.id
              const isDisabled = tab.id !== 'basic' && !employeeProfileComplete
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  disabled={isDisabled}
                  className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm rounded-t-lg transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : isDisabled
                      ? 'border-transparent text-gray-400 cursor-not-allowed bg-gray-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* Info Messages */}
      {!employeeProfileComplete && activeTab === 'basic' && !isEditing && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">Step 1: Complete Basic Employee Profile</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Fill in the basic employee information first. After completing this, you can add {profileLabel.toLowerCase()}-specific details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {employeeProfileComplete && activeTab === 'basic' && !isEditing && config.tabId && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800">Step 1 Complete!</h4>
                <p className="text-sm text-green-700 mt-1">
                  Basic employee profile is complete. Now you can add {profileLabel.toLowerCase()}-specific details in the next tab.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success/Error Messages */}
      {justSaved && (
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
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">{saveError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Content */}
      <div className="mb-20">
        {renderForm()}
      </div>

      {/* Sticky Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
        <div className="container mx-auto max-w-6xl flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {activeTab === 'basic' && !employeeProfileComplete && 'Complete all required fields marked with *'}
            {activeTab !== 'basic' && `${profileLabel} profile information`}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/masters/employee-profiles')}>
              Cancel
            </Button>
            {!isEditing ? (
              <Button type="button" onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsEditing(true)
              }}>
                {activeTab === 'basic' ? (employeeProfileComplete ? 'Edit Basic Info' : 'Create Basic Profile') : `Create ${profileLabel} Profile`}
              </Button>
            ) : (
              <Button type="submit" form="profile-form" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
