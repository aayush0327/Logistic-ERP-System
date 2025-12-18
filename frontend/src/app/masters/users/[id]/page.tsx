'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Building,
  Calendar,
  Edit
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Mock user data - This will be replaced with real API calls
const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'john.doe@company.com',
  role: 'admin',
  branch: 'Mumbai Main',
  status: 'active',
  lastLogin: '2024-01-15 10:30 AM',
  createdAt: '2024-01-01',
  phone: '+91 98765 43210',
  address: '123, Main Street, Mumbai, Maharashtra 400001'
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState(mockUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual API call
    const fetchUser = async () => {
      try {
        setLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        // In real implementation:
        // const response = await fetch(`/api/users/${params.id}`);
        // const data = await response.json();
        // setUser(data);
      } catch (error) {
        toast.error('Failed to fetch user details');
        router.push('/masters/users');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchUser();
    }
  }, [params.id, router]);

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">User not found</h2>
            <p className="text-gray-500 mb-4">The user you're looking for doesn't exist.</p>
            <Button onClick={() => router.push('/masters/users')}>
              Back to Users
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{user.name}</h1>
              <p className="text-gray-500">User Details</p>
            </div>
          </div>
          <Button
            onClick={() => router.push(`/masters/users/${user.id}/edit`)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit User
          </Button>
        </div>

        {/* User Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium">{user.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email Address</p>
                <p className="font-medium flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  {user.email}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone Number</p>
                <p className="font-medium">{user.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{user.address || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={user.status === 'active' ? 'success' : 'danger'}>
                  {user.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Assigned Branch</p>
                <p className="font-medium flex items-center">
                  <Building className="w-4 h-4 mr-2" />
                  {user.branch || 'Not assigned'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Login</p>
                <p className="font-medium flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  {user.lastLogin}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">User ID</p>
                <p className="font-medium">{user.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created On</p>
                <p className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}