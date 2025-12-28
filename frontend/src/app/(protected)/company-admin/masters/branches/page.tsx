"use client";

import { useState, useEffect } from "react";
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
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Search,
  Plus,
  Edit,
  Eye,
  MapPin,
  Phone,
  Mail,
  Building,
  Users,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  X,
  ChevronDown,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useGetBranchesQuery,
  useDeleteBranchMutation,
  useUpdateBranchMutation,
} from "@/services/api/companyApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { toast } from "react-hot-toast";

export default function BranchesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const {
    data: branchesData,
    isLoading,
    error,
  } = useGetBranchesQuery({
    page,
    per_page: 20,
    search: searchQuery || undefined,
    is_active: statusFilter !== "all" ? statusFilter === "active" : undefined,
  });

  const [deleteBranch, { isLoading: isDeleting }] = useDeleteBranchMutation();
  const [updateBranch] = useUpdateBranchMutation();

  const branches = branchesData?.items || [];

  const filteredBranches =
    branches?.filter((branch) => {
      const matchesSearch =
        !searchQuery ||
        branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        branch.city?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && branch.is_active) ||
        (statusFilter === "inactive" && !branch.is_active);

      return matchesSearch && matchesStatus;
    }) || [];

  const handleEdit = (id: string) => {
    router.push(`/company-admin/masters/branches/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/company-admin/masters/branches/${id}`);
  };

  const handleToggleActive = async (branch: any) => {
    try {
      await updateBranch({
        id: branch.id,
        branch: { is_active: !branch.is_active },
      }).unwrap();
      toast.success(
        branch.is_active
          ? "Branch deactivated successfully"
          : "Branch activated successfully"
      );
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to update branch status");
    }
  };

  const handleDelete = async () => {
    if (!branchToDelete) return;

    try {
      await deleteBranch(branchToDelete).unwrap();
      toast.success("Branch deleted successfully");
      setDeleteDialogOpen(false);
      setBranchToDelete(null);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to delete branch");
    }
  };

  const confirmDelete = (id: string) => {
    setBranchToDelete(id);
    setDeleteDialogOpen(true);
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? "success" : "default"}>
        {isActive ? "Active" : "Inactive"}
      </Badge>
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error loading branches</h3>
          <p className="text-red-600 text-sm mt-1">
            Please try refreshing the page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
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
              Branch Management
            </h1>
            <p className="text-gray-500 mt-2">
              Manage your company branches and locations
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.push("/company-admin/masters/branches/new")}
          className="flex items-center gap-2 px-3 md:px-4 py-3 bg-[#1f40ae] hover:bg-[#1f40ae] active:bg-[#1f40ae] text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm md:text-base font-semibold hover:font-bold">
            New Branch
          </span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Branches Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#edf0f7] border-2 border-[#c4cde9]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Total Branches
            </p>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading ? "..." : branches?.length || 0}
            </p>
          </div>
        </div>

        {/* Active Branches Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7f0] border-2 border-[#c5edd6]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Active Branches
            </p>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <div className="w-5 h-5 md:w-6 md:h-6 bg-emerald-500 rounded-full" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading
                ? "..."
                : branches?.filter((b) => b.is_active).length || 0}
            </p>
          </div>
        </div>

        {/* Inactive Branches Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7fa] border-2 border-[#c0e5f7]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Inactive Branches
            </p>
            <div className="p-2 bg-sky-100 rounded-lg">
              <div className="w-5 h-5 md:w-6 md:h-6 bg-sky-500 rounded-full" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading
                ? "..."
                : branches?.filter((b) => !b.is_active).length || 0}
            </p>
          </div>
        </div>

        {/* Total Customers Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#fff8f0] border-2 border-[#f8e4c2]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Total Customers
            </p>
            <div className="p-2 bg-amber-100 rounded-lg">
              <Users className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading
                ? "..."
                : branches?.reduce(
                    (acc, branch) => acc + (branch.customers?.length || 0),
                    0
                  ) || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Branches Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Branches</CardTitle>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search branches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full sm:w-64"
                />
              </div>

              {/* Filter Button with Dropdown */}
              <div className="relative">
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
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                      >
                        <span>All Branches</span>
                        {statusFilter === "all" && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setStatusFilter("active");
                          setFilterDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
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
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
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

              {/* Export Button */}
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
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
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="text-center py-8">
              <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No branches found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by creating your first branch"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button
                  onClick={() =>
                    router.push("/company-admin/masters/branches/new")
                  }
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Branch
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Branch Code</TableHead>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Customers</TableHead>
                    <TableHead>Vehicles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-[80px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBranches.map((branch) => (
                    <TableRow
                      key={branch.id}
                      className={`hover:bg-gray-50 ${
                        !branch.is_active ? "bg-gray-50 opacity-60" : ""
                      }`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {branch.code}
                          {!branch.is_active && (
                            <Badge
                              variant="default"
                              className="text-xs bg-gray-400"
                            >
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p
                            className="font-medium text-gray-900 truncate"
                            title={branch.name}
                          >
                            {branch.name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                          <span className="truncate">
                            {branch.city && branch.state
                              ? `${branch.city}, ${branch.state}`
                              : "N/A"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {branch.phone && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="w-3 h-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{branch.phone}</span>
                            </div>
                          )}
                          {branch.email && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="w-3 h-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{branch.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-900">
                          {branch.manager_id || "Not assigned"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center text-sm text-gray-900">
                          <Users className="w-3 h-3 mr-1" />
                          {branch.customers?.length || 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center text-sm text-gray-900">
                          <Building className="w-3 h-3 mr-1" />
                          {branch.vehicles?.length || 0}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(branch.is_active)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(branch.id)}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(branch.id)}
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant={branch.is_active ? "ghost" : "outline"}
                            size="sm"
                            onClick={() => handleToggleActive(branch)}
                            title={branch.is_active ? "Deactivate" : "Activate"}
                            className={
                              branch.is_active
                                ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                : "text-green-600 hover:text-green-700 hover:bg-green-50"
                            }
                          >
                            {branch.is_active ? (
                              <Power className="w-4 h-4" />
                            ) : (
                              <PowerOff className="w-4 h-4" />
                            )}
                          </Button>
                          {/* Delete button - commented out as per request
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmDelete(branch.id)}
                            title="Delete"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          */}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {filteredBranches.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Showing {filteredBranches.length} of {branches?.length || 0}{" "}
                    branches
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600 px-2">
                      Page {page}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={filteredBranches.length < 20}
                    >
                      Next
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
              Are you sure you want to delete this branch? This action cannot be
              undone.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setBranchToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
