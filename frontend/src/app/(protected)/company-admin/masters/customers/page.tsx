"use client";

import { useState, useRef } from "react";
import {
  BusinessTypeModel,
  BusinessTypesListResponse,
} from "@/services/api/companyApi";
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
import { useOutsideClick } from "@/components/Hooks/useOutsideClick";
import {
  Search,
  Plus,
  Edit,
  Eye,
  MapPin,
  Phone,
  Mail,
  Users,
  Building,
  Download,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  ArrowLeft,
  Power,
  PowerOff,
  Trash2,
  Filter,
  X,
  ChevronDown,
  GitBranch,
  DollarSign,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useGetCustomersQuery,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
  useGetAllBusinessTypesQuery,
} from "@/services/api/companyApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { toast } from "react-hot-toast";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";

// Type guard function to check if response is paginated
function isPaginatedBusinessTypesResponse(
  data: BusinessTypesListResponse | undefined
): data is {
  items: BusinessTypeModel[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
} {
  return data !== undefined && !Array.isArray(data) && "items" in data;
}

export default function CustomersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);

  useOutsideClick(filterRef, () => {
    if (filterDropdownOpen) {
      setFilterDropdownOpen(false);
    }
  });

  const { data: businessTypesData } = useGetAllBusinessTypesQuery({
    is_active: true,
  });

  // Handle both array and paginated response formats using type guard
  const businessTypes: BusinessTypeModel[] = isPaginatedBusinessTypesResponse(
    businessTypesData
  )
    ? businessTypesData.items
    : businessTypesData || [];

  const {
    data: customersData,
    isLoading,
    error,
  } = useGetCustomersQuery({
    page,
    per_page: 20,
    search: searchQuery || undefined,
    business_type:
      businessTypeFilter !== "all" ? businessTypeFilter : undefined,
    is_active: statusFilter !== "all" ? statusFilter === "active" : undefined,
  });

  const [deleteCustomer, { isLoading: isDeleting }] =
    useDeleteCustomerMutation();

  const [updateCustomer] = useUpdateCustomerMutation();

  // Extract customers items from paginated response
  const customers = customersData?.items || [];
  const totalCustomers = customersData?.total || 0;
  const totalPages = customersData?.pages || 1;

  const handleEdit = (id: string) => {
    router.push(`/company-admin/masters/customers/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/company-admin/masters/customers/${id}`);
  };

  const handleToggleActive = async (customer: any) => {
    try {
      await updateCustomer({
        id: customer.id,
        customer: { is_active: !customer.is_active },
      }).unwrap();
      toast.success(
        customer.is_active
          ? "Customer deactivated successfully"
          : "Customer activated successfully"
      );
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to update customer status");
    }
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;

    try {
      await deleteCustomer(customerToDelete).unwrap();
      toast.success("Customer deleted successfully");
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to delete customer");
    }
  };

  const confirmDelete = (id: string) => {
    setCustomerToDelete(id);
    setDeleteDialogOpen(true);
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? "success" : "default"}>
        {isActive ? "Active" : "Inactive"}
      </Badge>
    );
  };

  const getBusinessTypeBadge = (customer: any) => {
    // Use business_types (new multiple) if available, fallback to business_type_relation (single), then business_type (old enum)
    const businessTypes = customer.business_types || [];

    if (businessTypes.length > 0) {
      // Display first 2 business types and count for remaining
      const displayTypes = businessTypes.slice(0, 2);
      const remainingCount = businessTypes.length - 2;

      const colors: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
        individual: "default",
        small_business: "info",
        corporate: "success",
        government: "warning",
      };

      return (
        <div className="space-y-1">
          {displayTypes.map((bt: any) => {
            const badgeColor = colors[bt.code] || "info";
            return (
              <Badge key={bt.id} variant={badgeColor}>
                {bt.name}
              </Badge>
            );
          })}
          {remainingCount > 0 && (
            <div className="text-xs text-gray-500">+{remainingCount} more</div>
          )}
        </div>
      );
    }

    // Fallback to old single business type display
    const businessTypeName =
      customer.business_type_relation?.name ||
      customer.business_type?.replace("_", " ") ||
      "N/A";

    const colors: Record<
      string,
      "default" | "success" | "warning" | "danger" | "info"
    > = {
      individual: "default",
      small_business: "info",
      corporate: "success",
      government: "warning",
    };

    let badgeColor: "default" | "success" | "warning" | "danger" | "info" =
      "default";

    if (customer.business_type_relation?.code) {
      badgeColor = colors[customer.business_type_relation.code] || "info";
    } else if (customer.business_type) {
      badgeColor = colors[customer.business_type] || "default";
    } else {
      badgeColor = "default";
    }

    return <Badge variant={badgeColor}>{businessTypeName}</Badge>;
  };

  const getBranchesDisplay = (customer: any) => {
    // If available for all branches, show "All Branches"
    if (customer.available_for_all_branches) {
      return (
        <div className="flex items-center text-sm text-gray-900">
          <GitBranch className="w-3 h-3 mr-1 text-blue-500" />
          <span className="font-medium">All Branches</span>
        </div>
      );
    }

    // Show assigned branches
    const branches = customer.branches || [];
    if (branches.length === 0) {
      return (
        <div className="flex items-center text-sm text-gray-400">
          <GitBranch className="w-3 h-3 mr-1" />
          <span>None</span>
        </div>
      );
    }

    // Show first 2 branches and count for remaining
    const displayBranches = branches.slice(0, 2);
    const remainingCount = branches.length - 2;

    return (
      <div className="space-y-1">
        {displayBranches.map((cb: any) => (
          <div
            key={cb.branch.id}
            className="flex items-center text-sm text-gray-900"
          >
            <GitBranch className="w-3 h-3 mr-1 text-blue-500 flex-shrink-0" />
            <span className="truncate" title={cb.branch.name}>
              {cb.branch.name}
            </span>
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="text-xs text-gray-500 ml-4">
            +{remainingCount} more
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error loading customers</h3>
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
              Customer Management
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/company-admin/masters/business-types")}
            className="flex items-center gap-2"
          >
            <Briefcase className="w-4 h-4" />
            Manage Business Types
          </Button>
          <Button
            onClick={() => router.push("/company-admin/masters/customers/new")}
            className="flex items-center gap-2 px-3 md:px-4 py-3 bg-[#1f40ae] hover:bg-[#1f40ae] active:bg-[#1f40ae] text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm md:text-base font-semibold hover:font-bold">
              New Customer
            </span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Customers Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#edf0f7] border-2 border-[#c4cde9]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Total Customers
            </p>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading ? "..." : totalCustomers}
            </p>
          </div>
        </div>

        {/* Active Customers Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7f0] border-2 border-[#c5edd6]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Active Customers
            </p>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <div className="w-5 h-5 md:w-6 md:h-6 bg-emerald-500 rounded-full" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading ? "..." : customers.filter((c) => c.is_active).length}
            </p>
          </div>
        </div>

        {/* Corporate Customers Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7fa] border-2 border-[#c0e5f7]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Corporate
            </p>
            <div className="p-2 bg-sky-100 rounded-lg">
              <Briefcase className="w-5 h-5 md:w-6 md:h-6 text-sky-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading
                ? "..."
                : customers.filter((c) => {
                    // Check if customer has 'corporate' in business_types array
                    if (c.business_types && c.business_types.length > 0) {
                      return c.business_types.some((bt: any) => bt.code === "corporate");
                    }
                    // Fallback to old single business type fields
                    return (
                      c.business_type_relation?.code === "corporate" ||
                      c.business_type === "corporate"
                    );
                  }).length}
            </p>
          </div>
        </div>

        {/* Total Credit Limit Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#fff8f0] border-2 border-[#f8e4c2]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Total Credit Limit
            </p>
            <div className="p-2 bg-amber-100 rounded-lg">
              <div className="w-5 h-5 md:w-6 md:h-6 bg-amber-500 rounded-full flex items-center justify-center">
                <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-white" />
              </div>
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading ? (
                "..."
              ) : (
                <CurrencyDisplay
                  amount={customers.reduce((sum, c) => sum + (c.credit_limit || 0), 0)}
                />
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Customers</CardTitle>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search customers..."
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
                        <span>All Customers</span>
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

              {/* Business Type Filter */}
              <select
                value={businessTypeFilter}
                onChange={(e) => setBusinessTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option className="text-black" value="all">
                  All Types
                </option>
                {businessTypes.map((type) => (
                  <option
                    className="text-black"
                    key={type.id}
                    value={type.code}
                  >
                    {type.name}
                  </option>
                ))}
              </select>

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

          {/* Business Type Filter Chip */}
          {businessTypeFilter !== "all" && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                {businessTypes.find((bt) => bt.code === businessTypeFilter)
                  ?.name || businessTypeFilter}
                <button
                  onClick={() => setBusinessTypeFilter("all")}
                  className="ml-1 hover:bg-purple-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Customer Code</TableHead>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Contact</TableHead>
                    <TableHead className="whitespace-nowrap">Location</TableHead>
                    <TableHead className="whitespace-nowrap">Business Type</TableHead>
                    <TableHead className="whitespace-nowrap">Branches</TableHead>
                    <TableHead className="whitespace-nowrap">Credit Limit</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={index} className="animate-pulse">
                      <TableCell className="font-medium">
                        <div className="h-4 bg-gray-200 rounded w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-32" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-200 rounded w-28" />
                          <div className="h-3 bg-gray-200 rounded w-36" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-24" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 bg-gray-200 rounded w-20" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-24" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-20" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 bg-gray-200 rounded w-16" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
          ) : customers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No customers found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery ||
                statusFilter !== "all" ||
                businessTypeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by creating your first customer"}
              </p>
              {!searchQuery &&
                statusFilter === "all" &&
                businessTypeFilter === "all" && (
                  <Button
                    onClick={() =>
                      router.push("/company-admin/masters/customers/new")
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Customer
                  </Button>
                )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Customer Code</TableHead>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Contact</TableHead>
                    <TableHead className="whitespace-nowrap">Location</TableHead>
                    <TableHead className="whitespace-nowrap">Business Type</TableHead>
                    <TableHead className="whitespace-nowrap">Branches</TableHead>
                    <TableHead className="whitespace-nowrap">Credit Limit</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className={`hover:bg-gray-50 ${
                        !customer.is_active ? "bg-gray-50 opacity-60" : ""
                      }`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {customer.code}
                          {!customer.is_active && (
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
                        <div>
                          <p className="font-medium text-gray-900">
                            {customer.name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {customer.phone && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Phone className="w-3 h-3 mr-1" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Mail className="w-3 h-3 mr-1" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-1" />
                          {customer.city && customer.state
                            ? `${customer.city}, ${customer.state}`
                            : "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>{getBusinessTypeBadge(customer)}</TableCell>
                      <TableCell>{getBranchesDisplay(customer)}</TableCell>
                      <TableCell>
                        <CurrencyDisplay amount={customer.credit_limit || 0} />
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(customer.is_active)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(customer.id)}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(customer.id)}
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant={customer.is_active ? "ghost" : "outline"}
                            size="sm"
                            onClick={() => handleToggleActive(customer)}
                            title={
                              customer.is_active ? "Deactivate" : "Activate"
                            }
                            className={
                              customer.is_active
                                ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                : "text-green-600 hover:text-green-700 hover:bg-green-50"
                            }
                          >
                            {customer.is_active ? (
                              <Power className="w-4 h-4" />
                            ) : (
                              <PowerOff className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmDelete(customer.id)}
                            title="Delete"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
              {customers.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Showing {customers.length} of {totalCustomers} customers
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
                    <span className="text-sm text-gray-600 px-2">{page}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
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
              Are you sure you want to delete this customer? This action cannot
              be undone.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setCustomerToDelete(null);
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
