"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useOutsideClick } from "@/components/Hooks/useOutsideClick";
import {
  Search,
  Plus,
  Edit,
  Users,
  Mail,
  Building,
  Shield,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  UserPlus,
  ArrowLeft,
  Eye,
  X,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { toast } from "react-hot-toast";
import {
  useGetUsersQuery,
  useGetBranchesQuery,
  useGetRolesQuery,
  useDeleteUserMutation,
  useUpdateUserStatusMutation,
  useExportUsersMutation,
  useBulkUpdateUsersMutation,
} from "@/services/api/companyApi";
import { User, Role, Branch } from "@/services/api/companyApi";
import { UserInvitationModal } from "./UserInvitationModal";
import { RoleBadge } from "./RoleSelector";

export default function UsersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<number | null>(null);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [invitationModalOpen, setInvitationModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);

  useOutsideClick(filterRef, () => {
    if (filterDropdownOpen) {
      setFilterDropdownOpen(false);
    }
  });

  // Fetch users with filters
  const {
    data: usersData,
    isLoading,
    error,
  } = useGetUsersQuery({
    page,
    search: searchQuery || undefined,
    role_id: roleFilter || undefined,
    branch_id: branchFilter || undefined,
    is_active: statusFilter === "all" ? undefined : statusFilter === "active",
    include_profile: true,
  });

  // Fetch branches for filter dropdown
  const { data: branchesData } = useGetBranchesQuery({
    page: 1,
    per_page: 100,
  });

  // Fetch roles for filter dropdown
  const { data: rolesData } = useGetRolesQuery({});
  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.items || [];

  // Mutations
  const [deleteUser] = useDeleteUserMutation();
  const [updateUserStatus] = useUpdateUserStatusMutation();
  const [exportUsers] = useExportUsersMutation();
  const [bulkUpdateUsers] = useBulkUpdateUsersMutation();

  const users = usersData?.items || [];
  const pagination = usersData
    ? {
        current: usersData.page,
        total: usersData.total,
        pages: usersData.pages,
        pageSize: usersData.per_page,
      }
    : { current: 1, total: 0, pages: 0, pageSize: 20 };

  const branches = branchesData?.items || [];

  const handleEdit = (id: string) => {
    router.push(`/company-admin/masters/users/${id}/edit`);
  };

  const handleViewProfile = (user: User) => {
    router.push(`/company-admin/masters/employee-profiles/${user.id}`);
  };

  const handleBulkSelect = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers((prev) => [...prev, userId]);
    } else {
      setSelectedUsers((prev) => prev.filter((id) => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map((u) => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleBulkAction = async (
    action: "activate" | "deactivate" | "delete"
  ) => {
    if (selectedUsers.length === 0) return;

    const confirmMessage =
      action === "delete"
        ? `Are you sure you want to delete ${selectedUsers.length} user(s)?`
        : `Are you sure you want to ${action} ${selectedUsers.length} user(s)?`;

    if (!confirm(confirmMessage)) return;

    try {
      if (action === "delete") {
        // Delete users one by one (API doesn't support bulk delete)
        for (const userId of selectedUsers) {
          await deleteUser(userId).unwrap();
        }
        toast.success(`${selectedUsers.length} users deleted successfully`);
      } else {
        await bulkUpdateUsers({
          updates: selectedUsers.map((userId) => ({
            id: userId,
            is_active: action === "activate",
          })),
        }).unwrap();
        toast.success(`${selectedUsers.length} users ${action}d successfully`);
      }

      setSelectedUsers([]);
      setShowBulkActions(false);
    } catch (error) {
      toast.error(`Failed to ${action} users`);
    }
  };

  const handleDeactivate = async (user: User) => {
    try {
      await updateUserStatus({ id: user.id, is_active: false }).unwrap();
      toast.success("User deactivated successfully");
    } catch (error) {
      toast.error("Failed to deactivate user");
    }
  };

  const handleActivate = async (user: User) => {
    try {
      await updateUserStatus({ id: user.id, is_active: true }).unwrap();
      toast.success("User activated successfully");
    } catch (error) {
      toast.error("Failed to activate user");
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    try {
      await deleteUser(userToDelete.id).unwrap();
      toast.success("User deleted successfully");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const confirmDelete = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleExport = async (format: "csv" | "excel" = "excel") => {
    try {
      const blob = await exportUsers({
        role_id: roleFilter || undefined,
        branch_id: branchFilter || undefined,
        is_active:
          statusFilter === "all" ? undefined : statusFilter === "active",
        format,
      }).unwrap();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Users exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error("Failed to export users");
    }
  };

  const getRoleBadge = (role?: Role) => {
    return <RoleBadge role={role} />;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/company-admin/masters")}
            className="flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              User Management
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              router.push("/company-admin/masters/employee-profiles")
            }
            className="flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Manage Profiles
          </Button>
          <Button
            variant="outline"
            onClick={() => setInvitationModalOpen(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Invite Users
          </Button>
          <Button
            onClick={() => router.push("/company-admin/masters/users/new")}
            className="flex items-center gap-2 px-3 md:px-4 py-3 bg-[#1f40ae] hover:bg-[#1f40ae] active:bg-[#1f40ae] text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm md:text-base font-semibold hover:font-bold">
              New User
            </span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Users Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#edf0f7] border-2 border-[#c4cde9]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Total Users
            </p>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {pagination.total}
            </p>
          </div>
        </div>

        {/* Active Users Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7f0] border-2 border-[#c5edd6]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Active
            </p>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <UserCheck className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {users.filter((u) => u.is_active).length}
            </p>
          </div>
        </div>

        {/* Inactive Users Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7fa] border-2 border-[#c0e5f7]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Inactive
            </p>
            <div className="p-2 bg-sky-100 rounded-lg">
              <UserX className="w-5 h-5 md:w-6 md:h-6 text-sky-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {users.filter((u) => !u.is_active).length}
            </p>
          </div>
        </div>

        {/* Admins Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#fff8f0] border-2 border-[#f8e4c2]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Admins
            </p>
            <div className="p-2 bg-amber-100 rounded-lg">
              <Shield className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {users.filter((u) => u.is_superuser).length}
            </p>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedUsers.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-blue-900">
                {selectedUsers.length} user{selectedUsers.length > 1 ? "s" : ""}{" "}
                selected
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("activate")}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Activate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("deactivate")}
                  className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                >
                  <UserX className="w-4 h-4 mr-2" />
                  Deactivate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("delete")}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUsers([])}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Users</CardTitle>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full sm:w-64"
                />
              </div>

              {/* Filter Button with Dropdown */}
              <div className="relative" ref={filterRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                  className="flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Filter
                  <ChevronDown className="w-4 h-4" />
                </Button>

                {/* Filter Dropdown */}
                {filterDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setStatusFilter("all");
                          setFilterDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between text-black"
                      >
                        <span>All Users</span>
                        {statusFilter === "all" && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setStatusFilter("active");
                          setFilterDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between text-black"
                      >
                        <span>Active</span>
                        {statusFilter === "active" && (
                          <span className="w-2 h-2 bg-green-600 rounded-full" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setStatusFilter("inactive");
                          setFilterDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between text-black"
                      >
                        <span>Inactive</span>
                        {statusFilter === "inactive" && (
                          <span className="w-2 h-2 bg-gray-600 rounded-full" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Role Filter */}
              <select
                value={roleFilter || ""}
                onChange={(e) =>
                  setRoleFilter(
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
                className="px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Roles</option>
                {roles?.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>

              {/* Branch Filter */}
              <select
                value={branchFilter || ""}
                onChange={(e) => setBranchFilter(e.target.value || null)}
                className="px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              {/* Export Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport("excel")}>
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Active Filter Chips */}
          {statusFilter !== "all" && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {statusFilter === "active" ? "Active" : "Inactive"}
                <button
                  onClick={() => setStatusFilter("all")}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="overflow-visible">
          {isLoading ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 whitespace-nowrap">
                      <div className="h-4 w-4 bg-gray-200 rounded" />
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Email</TableHead>
                    <TableHead className="whitespace-nowrap">Role</TableHead>
                    <TableHead className="whitespace-nowrap">Branch</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">Last Login</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={index} className="animate-pulse">
                      <TableCell>
                        <div className="h-4 w-4 bg-gray-200 rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-28" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-36" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 bg-gray-200 rounded w-20" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-24" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 bg-gray-200 rounded w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-24" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="h-8 w-8 bg-gray-200 rounded" />
                          <div className="h-8 w-8 bg-gray-200 rounded" />
                          <div className="h-8 w-8 bg-gray-200 rounded" />
                          <div className="h-8 w-8 bg-gray-200 rounded" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">
                Failed to load users. Please try again.
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No users found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery ||
                roleFilter ||
                branchFilter ||
                statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by creating your first user"}
              </p>
              {!searchQuery &&
                !roleFilter &&
                !branchFilter &&
                statusFilter === "all" && (
                  <Button
                    onClick={() =>
                      router.push("/company-admin/masters/users/new")
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={
                          selectedUsers.length === users.length &&
                          users.length > 0
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Email</TableHead>
                    <TableHead className="whitespace-nowrap">Role</TableHead>
                    <TableHead className="whitespace-nowrap">Branch</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap">
                      Last Login
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) =>
                            handleBulkSelect(user.id, e.target.checked)
                          }
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-4 h-4 mr-2" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-900">
                          <Building className="w-4 h-4 mr-2" />
                          {user.branch?.name || "Not Assigned"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "success" : "default"}>
                          {user.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(user.last_login)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewProfile(user)}
                            className="h-8 w-8 p-0"
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(user.id)}
                            className="h-8 w-8 p-0"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              user.is_active
                                ? handleDeactivate(user)
                                : handleActivate(user)
                            }
                            className={`h-8 w-8 p-0 ${
                              user.is_active
                                ? "text-yellow-600 hover:text-yellow-700"
                                : "text-green-600 hover:text-green-700"
                            }`}
                            title={user.is_active ? "Deactivate" : "Activate"}
                          >
                            {user.is_active ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmDelete(user)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.total > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Showing {users.length} of {pagination.total} users
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-gray-600 px-2">
                      {pagination.current}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= pagination.pages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete {userToDelete?.first_name}{" "}
              {userToDelete?.last_name}? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setUserToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Invitation Modal */}
      <UserInvitationModal
        isOpen={invitationModalOpen}
        onClose={() => setInvitationModalOpen(false)}
      />
    </div>
  );
}
