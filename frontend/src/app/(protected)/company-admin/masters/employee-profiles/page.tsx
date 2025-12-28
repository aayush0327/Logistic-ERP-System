"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  useGetProfilesByRoleQuery,
  useGetProfileStatsQuery,
} from "@/services/api/profileApi";
import {
  ProfilesByRoleResponse,
  ProfileStatsResponse,
  RoleData,
} from "@/services/api/profileApi";
import RoleUserList from "./RoleUserList";
import {
  Search,
  Filter,
  Users,
  UserCheck,
  UserX,
  Download,
  ArrowLeft,
} from "lucide-react";

export default function EmployeeProfilesPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "completed" | "pending"
  >("all");

  // Fetch profiles grouped by roles
  const {
    data: profilesData,
    isLoading: isLoadingProfiles,
    refetch: refetchProfiles,
  } = useGetProfilesByRoleQuery({
    include_inactive: false,
    include_completion_stats: true,
  });

  // Fetch profile statistics
  const { data: profileStats, isLoading: isLoadingStats } =
    useGetProfileStatsQuery();

  // Get roles from profiles data
  const roles = profilesData?.roles || [];

  // Filter roles and users based on search and filters
  const filteredRoles = roles.filter((role: RoleData) => {
    const matchesSearch =
      role.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.users.some(
        (user) =>
          `${user.first_name} ${user.last_name}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesRoleFilter =
      !selectedRoleId || role.role_id === selectedRoleId;

    return matchesSearch && matchesRoleFilter;
  });

  // Further filter users within each role based on completion status
  const filteredRolesWithUsers = filteredRoles.map((role: RoleData) => {
    let filteredUsers = role.users;

    // Filter by completion status if needed
    if (filterStatus === "completed") {
      filteredUsers = filteredUsers.filter(
        (user) => user.profile_completion?.is_complete === true
      );
    } else if (filterStatus === "pending") {
      filteredUsers = filteredUsers.filter(
        (user) => user.profile_completion?.is_complete !== true
      );
    }

    return {
      ...role,
      users: filteredUsers,
    };
  });

  // Calculate filtered statistics
  const calculateFilteredStats = () => {
    const allUsers = filteredRolesWithUsers.flatMap((role) => role.users);
    const total = allUsers.length;
    const completed = allUsers.filter(
      (user) => user.profile_completion?.is_complete === true
    ).length;
    const pending = total - completed;

    return { total, completed, pending };
  };

  const filteredStats = calculateFilteredStats();

  const handleUserClick = (userId: string) => {
    // Ensure userId is a string (defensive check)
    const safeUserId = typeof userId === "string" ? userId : String(userId);
    console.log(
      "handleUserClick - userId:",
      userId,
      "safeUserId:",
      safeUserId,
      "type:",
      typeof userId
    );

    // Don't navigate if it's an invalid userId that became "[object Object]"
    if (safeUserId === "[object Object]" || !safeUserId) {
      console.error("Invalid userId, cannot navigate:", userId);
      return;
    }

    router.push(`/company-admin/masters/employee-profiles/${safeUserId}`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
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
              Employee Profiles
            </h1>
            <p className="text-gray-600 mt-1">
              Manage employee profiles and track completion status
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Advanced Filter
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Employees
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoadingStats ? "-" : filteredStats.total}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Profiles Completed
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {isLoadingStats ? "-" : filteredStats.completed}
                </p>
              </div>
              <UserCheck className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Profiles Pending
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {isLoadingStats ? "-" : filteredStats.pending}
                </p>
              </div>
              <UserX className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Completion Rate
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {filteredStats.total > 0
                    ? `${Math.round(
                        (filteredStats.completed / filteredStats.total) * 100
                      )}%`
                    : "0%"}
                </p>
              </div>
              <div className="relative w-8 h-8">
                <svg className="w-8 h-8 transform -rotate-90">
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    className="text-gray-200"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${
                      filteredStats.total > 0
                        ? (filteredStats.completed / filteredStats.total) * 75.4
                        : 0
                    } 75.4`}
                    className="text-blue-600"
                  />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search by employee name, email, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-wise User Lists */}
      <div className="space-y-4">
        {isLoadingProfiles ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading employee profiles...</p>
          </div>
        ) : filteredRolesWithUsers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No profiles found
              </h3>
              <p className="text-gray-600">
                {searchTerm || selectedRoleId
                  ? "Try adjusting your search or filters"
                  : "No employee profiles have been created yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRolesWithUsers.map((roleData: RoleData) => (
            <RoleUserList
              key={roleData.role_id}
              roleData={roleData}
              onUserClick={handleUserClick}
              filterStatus={filterStatus}
            />
          ))
        )}
      </div>
    </div>
  );
}
