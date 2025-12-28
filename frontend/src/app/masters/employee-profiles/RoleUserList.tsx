'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { RoleData, UserWithProfile } from '@/services/api/profileApi'
import { ChevronDown, ChevronUp, UserPlus, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface RoleUserListProps {
  roleData: RoleData
  onUserClick: (userId: string) => void
  filterStatus: 'all' | 'completed' | 'pending'
}

export default function RoleUserList({ roleData, onUserClick, filterStatus }: RoleUserListProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Filter users based on profile completion status
  const filteredUsers = roleData.users.filter((user: UserWithProfile) => {
    if (filterStatus === 'completed') return user.profile_completion?.is_complete === true
    if (filterStatus === 'pending') return user.profile_completion?.is_complete !== true
    return true
  })

  // Calculate completion statistics
  const totalUsers = roleData.users.length
  const completedUsers = roleData.users.filter(user => user.profile_completion?.is_complete === true).length
  const completionRate = totalUsers > 0 ? Math.round((completedUsers / totalUsers) * 100) : 0

  const getStatusIcon = (user: UserWithProfile) => {
    if (user.profile_completion?.is_complete === true) {
      return <CheckCircle className="w-5 h-5 text-green-600" />
    } else {
      return <AlertCircle className="w-5 h-5 text-orange-600" />
    }
  }

  const getStatusText = (user: UserWithProfile) => {
    return user.profile_completion?.is_complete === true ? 'Profile Complete' : 'Profile Pending'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </Button>
            <div>
              <CardTitle className="text-lg">{roleData.role_name}</CardTitle>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm text-gray-600">
                  {filteredUsers.length} of {roleData.total_count} employees
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {completionRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>{completedUsers}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span>{totalUsers - completedUsers}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {filterStatus === 'completed' && 'No completed profiles in this role'}
              {filterStatus === 'pending' && 'No pending profiles in this role'}
              {filterStatus === 'all' && 'No employees in this role'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onUserClick(user.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">
                        {user.first_name[0]}{user.last_name[0]}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                      {user.profile?.designation && (
                        <div className="text-sm text-gray-600">{user.profile.designation}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(user)}
                        <span className="text-sm font-medium">
                          {getStatusText(user)}
                        </span>
                      </div>
                      {user.profile?.employee_id && (
                        <div className="text-xs text-gray-500 mt-1">
                          ID: {user.profile.employee_id}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUserClick(user.id)
                      }}
                    >
                      {user.profile ? 'Edit' : 'Create Profile'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
