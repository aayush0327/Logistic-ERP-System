"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Building,
  Calendar,
  Edit,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useGetUserQuery } from "@/services/api/companyApi";
import { User as UserType } from "@/services/api/companyApi";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  // Fetch user data with RTK Query
  const {
    data: user,
    isLoading,
    error,
  } = useGetUserQuery(userId, {
    skip: !userId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto inline space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !user) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              User not found
            </h2>
            <p className="text-gray-500 mb-4">
              {error
                ? "Failed to load user details."
                : "The user you're looking for doesn't exist."}
            </p>
            <Button onClick={() => router.push("/masters/users")}>
              Back to Users
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto inline space-y-6">
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
              <h1 className="text-3xl font-bold text-gray-900">
                {user.first_name} {user.last_name}
              </h1>
              <p className="text-gray-500">User Details</p>
            </div>
          </div>
          <Button onClick={() => router.push(`/masters/users/${user.id}/edit`)}>
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
                <p className="font-medium">
                  {user.first_name} {user.last_name}
                </p>
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
                <p className="font-medium">{user.phone_number || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Profile Type</p>
                <Badge variant="secondary" className="capitalize">
                  {user.profile_type}
                </Badge>
              </div>
              {user.profile && (
                <div>
                  <p className="text-sm text-gray-500">Employee ID</p>
                  <p className="font-medium">
                    {user.profile.employee_id || "N/A"}
                  </p>
                </div>
              )}
              {user.profile && (
                <div>
                  <p className="text-sm text-gray-500">Department</p>
                  <p className="font-medium">
                    {user.profile.department || "N/A"}
                  </p>
                </div>
              )}
              {user.profile && (
                <div>
                  <p className="text-sm text-gray-500">Designation</p>
                  <p className="font-medium">
                    {user.profile.designation || "N/A"}
                  </p>
                </div>
              )}
              {user.profile?.current_address && (
                <div>
                  <p className="text-sm text-gray-500">Current Address</p>
                  <p className="font-medium text-sm">
                    {user.profile.current_address.address_line1},<br />
                    {user.profile.current_address.city},{" "}
                    {user.profile.current_address.state}{" "}
                    {user.profile.current_address.postal_code}
                    <br />
                    {user.profile.current_address.country}
                  </p>
                </div>
              )}
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
                <Badge
                  variant={
                    user.role?.name.toLowerCase() === "admin"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {user.role?.name || "N/A"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={user.is_active ? "success" : "default"}>
                  {user.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Superuser</p>
                <Badge
                  variant={user.is_superuser ? "destructive" : "secondary"}
                >
                  {user.is_superuser ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Assigned Branch</p>
                <p className="font-medium flex items-center">
                  <Building className="w-4 h-4 mr-2" />
                  {user.branch?.name || "Not assigned"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Login</p>
                <p className="font-medium flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  {user.last_login
                    ? new Date(user.last_login).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Never"}
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
                <p className="text-sm text-gray-500">Tenant ID</p>
                <p className="font-medium">{user.tenant_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created On</p>
                <p className="font-medium">
                  {new Date(user.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="font-medium">
                  {user.updated_at
                    ? new Date(user.updated_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Never"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
