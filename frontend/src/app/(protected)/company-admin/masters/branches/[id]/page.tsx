"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  ArrowLeft,
  Edit,
  MapPin,
  Phone,
  Users,
  Truck,
  DollarSign,
  Info,
} from "lucide-react";
import {
  useGetBranchQuery,
  useGetBranchMetricsQuery,
  useGetCustomersQuery,
  useGetVehiclesQuery,
} from "@/services/api/companyApi";
import { toast } from "react-hot-toast";

export default function BranchDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params.id as string;

  const { data: branch, isLoading, error } = useGetBranchQuery(branchId);
  const { data: metrics } = useGetBranchMetricsQuery(branchId);

  // Fetch customers and vehicles for this branch
  const { data: customersData } = useGetCustomersQuery({
    home_branch_id: branchId,
    page: 1,
    per_page: 100,
  });
  const { data: vehiclesData } = useGetVehiclesQuery({
    branch_id: branchId,
    page: 1,
    per_page: 100,
  });

  const customers = customersData?.items || [];
  const vehicles = vehiclesData?.items || [];

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">
            Error loading branch details
          </h3>
          <p className="text-red-600 text-sm mt-1">
            The branch may not exist or you don't have permission to view it
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!branch) return null;

  const statusBadge = (
    <Badge
      variant={branch.is_active ? "success" : "default"}
      className={`px-3 py-1 text-sm font-semibold ${
        branch.is_active
          ? "bg-green-100 text-green-800 border border-green-300"
          : "bg-red-100 text-red-800 border border-red-300"
      }`}
    >
      {branch.is_active ? "Active" : "Inactive"}
    </Badge>
  );

  return (
    <div className="space-y-6">
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
            <h1 className="text-3xl font-bold text-gray-900">{branch.name}</h1>
            <p className="text-gray-500">Branch Code: {branch.code}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {statusBadge}
          <Button
            onClick={() =>
              router.push(`/company-admin/masters/branches/${branchId}/edit`)
            }
            className="bg-[#1F40AE] hover:bg-[#203BA0] active:bg-[#192F80] text-white px-4 py-2 rounded-lg font-medium"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Branch
          </Button>
        </div>
      </div>

      {/* Branch Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="min-h-70">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Info className="w-5 h-5 mr-2 text-blue-600" />
              Branch Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Branch Code
              </label>
              <p className="text-gray-900 font-medium mt-1">{branch.code}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Branch Name
              </label>
              <p className="text-gray-900 font-medium mt-1">{branch.name}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </label>
              <div className="mt-1">{statusBadge}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Created Date
              </label>
              <p className="text-gray-900 mt-1">
                {new Date(branch.created_at).toLocaleDateString()}
              </p>
            </div>
            {branch.updated_at && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Last Updated
                </label>
                <p className="text-gray-900 mt-1">
                  {new Date(branch.updated_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-70">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <MapPin className="w-5 h-5 mr-2 text-green-600" />
              Address Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Address
              </label>
              <p className="text-gray-900 mt-1">{branch.address || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                City
              </label>
              <p className="text-gray-900 mt-1">{branch.city || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                State
              </label>
              <p className="text-gray-900 mt-1">{branch.state || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Postal Code
              </label>
              <p className="text-gray-900 mt-1">
                {branch.postal_code || "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-70">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Phone className="w-5 h-5 mr-2 text-purple-600" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Phone
              </label>
              <p className="text-gray-900 mt-1">{branch.phone || "N/A"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Email
              </label>
              <p className="text-gray-900 mt-1 break-all">
                {branch.email || "N/A"}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Manager ID
              </label>
              <p className="text-gray-900 font-mono text-sm mt-1">
                {branch.manager_id || "Not assigned"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Customers Card */}
        <Card className="relative cursor-pointer overflow-hidden border-l-4 shadow-md hover:shadow-lg transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 opacity-50" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Total Customers
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {customers.length}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Vehicles Card */}
        <Card className="relative cursor-pointer overflow-hidden border-l-4  shadow-md hover:shadow-lg transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 opacity-50" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Total Vehicles
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {vehicles.length}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Truck className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Vehicles Card */}
        <Card className="relative cursor-pointer overflow-hidden border-l-4  shadow-md hover:shadow-lg transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-full -mr-8 -mt-8 opacity-50" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Active Vehicles
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {vehicles.filter((v) => v.is_active).length}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                <div className="w-6 h-6 bg-white rounded-full border-4 border-white shadow-inner" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Card */}
        <Card className="relative cursoe-pointer overflow-hidden border-l-4  shadow-md hover:shadow-lg transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -mr-8 -mt-8 opacity-50" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Revenue (MTD)
                </p>
                <p className="text-3xl font-bold text-purple-600">
                  ${(metrics?.revenue_mtd ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
