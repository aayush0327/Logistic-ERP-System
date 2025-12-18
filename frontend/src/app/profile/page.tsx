'use client';

import { useAppSelector } from '@/store/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { AppLayout } from '@/components/layout/AppLayout';
import { User, Mail, Calendar, Shield, Briefcase, MapPin, Phone } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your personal information</p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900">
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="text-sm text-gray-500">
                  {user?.email}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Personal Information</h3>

                <div className="grid gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Name</label>
                    <p className="mt-1 text-sm font-medium text-gray-900">{user?.first_name || 'N/A'} {user?.last_name}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    Email
                  </label>
                  <p className="mt-1 text-sm font-medium text-gray-900">{user?.email || 'N/A'}</p>
                </div>

                {/* <div>
                  <label className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    Phone
                  </label>
                  <p className="mt-1 text-sm font-medium text-gray-900">Not provided</p>
                </div>

                <div>
                  <label className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Location
                  </label>
                  <p className="mt-1 text-sm font-medium text-gray-900">Not provided</p>
                </div> */}
              </div>

              {/* Professional Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Professional Information</h3>

                <div>
                  <label className="text-sm text-gray-500 flex items-center gap-1">
                    <Briefcase className="w-4 h-4" />
                    Department
                  </label>
                  <p className="mt-1 text-sm font-medium text-gray-900">Logistics</p>
                </div>

                <div>
                  <label className="text-sm text-gray-500 flex items-center gap-1">
                    <Shield className="w-4 h-4" />
                    Role
                  </label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {user?.is_superuser ? 'Super Administrator' : 'Employee'}
                  </p>
                </div>

                <div>
                  <label className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Member Since
                  </label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Last Login
                  </label>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {user?.last_login ? new Date(user.last_login).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Never'}
                  </p>
                </div>
              </div>
            </div>

            {/* Account Status */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Account Status</h3>
                  <p className="mt-1 text-sm text-gray-500">Current status of your account</p>
                </div>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${user?.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
                  }`}>
                  {user?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-4 ${user?.is_superuser ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <User className="w-6 h-6 text-gray-600 mb-2" />
                <div className="text-sm font-medium text-gray-900">Edit Profile</div>
                <div className="text-xs text-gray-500 mt-1">Update your personal information</div>
              </button>
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Shield className="w-6 h-6 text-gray-600 mb-2" />
                <div className="text-sm font-medium text-gray-900">Security Settings</div>
                <div className="text-xs text-gray-500 mt-1">Manage password and security</div>
              </button>
              {user?.is_superuser && (
                <button
                  onClick={() => window.location.href = '/super-admin'}
                  className="p-4 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Shield className="w-6 h-6 text-blue-600 mb-2" />
                  <div className="text-sm font-medium text-blue-900">Super Admin</div>
                  <div className="text-xs text-blue-600 mt-1">Manage all companies</div>
                </button>
              )}
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Mail className="w-6 h-6 text-gray-600 mb-2" />
                <div className="text-sm font-medium text-gray-900">Notification Preferences</div>
                <div className="text-xs text-gray-500 mt-1">Configure email notifications</div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}