'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { User } from '@/services/api/companyApi'
import { FinanceManagerProfile } from '@/services/api/profileApi'
import { useCreateFinanceManagerProfileMutation, useUpdateFinanceManagerProfileMutation } from '@/services/api/profileApi'
import { Save, X, FileText, CheckCircle } from 'lucide-react'

interface FinanceManagerProfileFormProps {
  user: User
  profile?: FinanceManagerProfile | null
  isEditing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export default function FinanceManagerProfileForm({
  user,
  profile,
  isEditing,
  onEdit,
  onSave,
  onCancel
}: FinanceManagerProfileFormProps) {
  const [formData, setFormData] = useState({
    can_approve_payments: false,
    max_approval_amount: 0,
    can_manage_payroll: false,
    can_view_financial_reports: false,
    can_create_invoices: false,
    can_manage_expenses: false,
    access_levels: {
      can_view_all_branches: false,
      can_access_bank_accounts: false,
      can_handle_tax_compliance: false,
      can_audit_transactions: false
    }
  })

  const [createProfile, { isLoading: isCreating }] = useCreateFinanceManagerProfileMutation()
  const [updateProfile, { isLoading: isUpdating }] = useUpdateFinanceManagerProfileMutation()

  useEffect(() => {
    if (profile) {
      setFormData({
        can_approve_payments: profile.can_approve_payments || false,
        max_approval_amount: profile.max_approval_amount || 0,
        can_manage_payroll: profile.can_manage_payroll || false,
        can_view_financial_reports: profile.can_view_financial_reports || false,
        can_create_invoices: profile.can_create_invoices || false,
        can_manage_expenses: profile.can_manage_expenses || false,
        access_levels: {
          can_view_all_branches: profile.access_levels?.can_view_all_branches || false,
          can_access_bank_accounts: profile.access_levels?.can_access_bank_accounts || false,
          can_handle_tax_compliance: profile.access_levels?.can_handle_tax_compliance || false,
          can_audit_transactions: profile.access_levels?.can_audit_transactions || false
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
      console.error('Error saving finance manager profile:', error)
    }
  }

  if (!isEditing && !profile) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Finance Manager Profile</h3>
          <p className="text-gray-600 mb-4">
            This finance manager doesn't have a profile yet. Click below to create one.
          </p>
          <Button onClick={onEdit} className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Create Finance Manager Profile
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
            <CardTitle className="text-lg">Finance Manager Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Approval Amount</label>
              <p className="text-gray-900">₹{profile.max_approval_amount?.toLocaleString() || 0}</p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Financial Permissions</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_approve_payments ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Approve Payments</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_manage_payroll ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Manage Payroll</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_view_financial_reports ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">View Financial Reports</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_create_invoices ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Create Invoices</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.can_manage_expenses ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Manage Expenses</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 mt-4">Access Levels</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.access_levels?.can_view_all_branches ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">View All Branches</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.access_levels?.can_access_bank_accounts ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Access Bank Accounts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.access_levels?.can_handle_tax_compliance ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Tax Compliance</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className={`w-4 h-4 ${profile.access_levels?.can_audit_transactions ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm">Audit Transactions</span>
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
          <CardTitle className="text-lg">Finance Manager Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Approval Amount</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.max_approval_amount}
                onChange={(e) => handleInputChange('max_approval_amount', parseFloat(e.target.value) || 0)}
                placeholder="Enter max approval amount"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Financial Permissions</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_approve_payments}
                  onChange={(e) => handleInputChange('can_approve_payments', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Approve Payments</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_manage_payroll}
                  onChange={(e) => handleInputChange('can_manage_payroll', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Manage Payroll</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_view_financial_reports}
                  onChange={(e) => handleInputChange('can_view_financial_reports', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">View Financial Reports</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_create_invoices}
                  onChange={(e) => handleInputChange('can_create_invoices', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Create Invoices</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_manage_expenses}
                  onChange={(e) => handleInputChange('can_manage_expenses', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Manage Expenses</span>
              </label>
            </div>

            <h4 className="font-medium text-gray-900 mt-4">Access Levels</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.access_levels.can_view_all_branches}
                  onChange={(e) => handleInputChange('access_levels.can_view_all_branches', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">View All Branches</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.access_levels.can_access_bank_accounts}
                  onChange={(e) => handleInputChange('access_levels.can_access_bank_accounts', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Access Bank Accounts</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.access_levels.can_handle_tax_compliance}
                  onChange={(e) => handleInputChange('access_levels.can_handle_tax_compliance', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Tax Compliance</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.access_levels.can_audit_transactions}
                  onChange={(e) => handleInputChange('access_levels.can_audit_transactions', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Audit Transactions</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}