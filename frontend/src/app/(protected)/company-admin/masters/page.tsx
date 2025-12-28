"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Building,
  Users,
  Package,
  Truck,
  UserCheck,
  ArrowRight,
  Settings,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useGetBranchesQuery,
  useGetCustomersQuery,
  useGetVehiclesQuery,
  useGetProductsQuery,
} from "@/services/api/companyApi";

export default function MastersPage() {
  const router = useRouter();

  // Fetch data from API
  const { data: branchesData, isLoading: branchesLoading } =
    useGetBranchesQuery({});
  const { data: customersData, isLoading: customersLoading } =
    useGetCustomersQuery({});
  const { data: vehiclesData, isLoading: vehiclesLoading } =
    useGetVehiclesQuery({});
  const { data: productsData, isLoading: productsLoading } =
    useGetProductsQuery({});

  // Extract items from paginated responses
  const branches = branchesData?.items || [];
  const customers = customersData?.items || [];
  const vehicles = vehiclesData?.items || [];
  const products = productsData?.items || [];

  // Calculate total counts
  const totalBranches = branches.length;
  const totalCustomers = customers.length;
  const totalVehicles = vehicles.length;
  const totalProducts = products.length;

  const modules = [
    {
      title: "Branch Management",
      description: "Manage branches and their locations",
      icon: Building,
      href: "/company-admin/masters/branches",
      color: "bg-blue-500",
    },
    {
      title: "Customer Management",
      description: "Manage customers and their information",
      icon: Users,
      href: "/company-admin/masters/customers",
      color: "bg-green-500",
    },
    {
      title: "Vehicle Management",
      description: "Manage fleet of vehicles",
      icon: Truck,
      href: "/company-admin/masters/vehicles",
      color: "bg-purple-500",
    },
    {
      title: "Product Management",
      description: "Manage product catalog and inventory",
      icon: Package,
      href: "/company-admin/masters/products",
      color: "bg-orange-500",
    },
    {
      title: "User Management",
      description: "Manage users and their permissions",
      icon: UserCheck,
      href: "/company-admin/masters/users",
      color: "bg-indigo-500",
    },
    {
      title: "Pricing Configuration",
      description: "Configure pricing rules and rates",
      icon: DollarSign,
      href: "/company-admin/masters/pricing",
      color: "bg-pink-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Masters Management</h1>
        <p className="text-gray-500 mt-2">
          Manage all master data and configurations for your logistics business
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Branches Card */}
        <Link href="/company-admin/masters/branches" className="block group">
          <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#edf0f7] border-2 border-[#c4cde9] cursor-pointer">
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
                {branchesLoading ? "..." : totalBranches}
              </p>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 group-hover:-rotate-45 transition-transform duration-200" />
            </div>
          </div>
        </Link>

        {/* Total Customers Card */}
        <Link href="/company-admin/masters/customers" className="block group">
          <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7f0] border-2 border-[#c5edd6] cursor-pointer">
            <div className="flex justify-between items-start">
              <p className="text-sm md:text-base font-semibold text-black">
                Total Customers
              </p>
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
              </div>
            </div>
            <div className="flex items-end justify-between mt-3">
              <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                {customersLoading ? "..." : totalCustomers}
              </p>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-emerald-600 group-hover:-rotate-45 transition-transform duration-200" />
            </div>
          </div>
        </Link>

        {/* Total Vehicles Card */}
        <Link href="/company-admin/masters/vehicles" className="block group">
          <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7fa] border-2 border-[#c0e5f7] cursor-pointer">
            <div className="flex justify-between items-start">
              <p className="text-sm md:text-base font-semibold text-black">
                Total Vehicles
              </p>
              <div className="p-2 bg-sky-100 rounded-lg">
                <Truck className="w-5 h-5 md:w-6 md:h-6 text-sky-500" />
              </div>
            </div>
            <div className="flex items-end justify-between mt-3">
              <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                {vehiclesLoading ? "..." : totalVehicles}
              </p>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-sky-600 group-hover:-rotate-45 transition-transform duration-200" />
            </div>
          </div>
        </Link>

        {/* Total Products Card */}
        <Link href="/company-admin/masters/products" className="block group">
          <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#fff8f0] border-2 border-[#f8e4c2] cursor-pointer">
            <div className="flex justify-between items-start">
              <p className="text-sm md:text-base font-semibold text-black">
                Total Products
              </p>
              <div className="p-2 bg-amber-100 rounded-lg">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
              </div>
            </div>
            <div className="flex items-end justify-between mt-3">
              <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                {productsLoading ? "..." : totalProducts}
              </p>
              <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-amber-600 group-hover:-rotate-45 transition-transform duration-200" />
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2  md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* New Branch - Primary Button */}
          <button
            onClick={() => router.push("/company-admin/masters/branches/new")}
            className="flex items-center cursor-pointer justify-center gap-2 px-3 md:px-4 py-3 bg-[#1f40ae] hover:bg-[#1f40ae] active:bg-[#1f40ae] text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-md w-full"
          >
            <Building className="w-4 h-4" />
            <span className="text-sm md:text-base font-semibold hover:font-bold">
              New Branch
            </span>
          </button>

          {/* New Customer */}
          <button
            onClick={() => router.push("/company-admin/masters/customers/new")}
            className="flex items-center cursor-pointer justify-center gap-2 px-3 md:px-4 py-3 bg-white hover:bg-[#e9edfb] active:bg-[#F3F4F6] text-black border border-gray-300 hover:border-[#D1D5DB] rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-sm shadow-md w-full"
          >
            <Users className="w-4 h-4" />
            <span className="text-sm md:text-base font-semibold hover:font-bold">
              New Customer
            </span>
          </button>

          {/* Add Vehicle */}
          <button
            onClick={() => router.push("/company-admin/masters/vehicles/new")}
            className="flex items-center cursor-pointer justify-center gap-2 px-3 md:px-4 py-3 bg-white hover:bg-[#e9edfb] active:bg-[#F3F4F6] text-black border border-gray-300 hover:border-[#D1D5DB] rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-sm shadow-md w-full"
          >
            <Truck className="w-4 h-4" />
            <span className="text-sm md:text-base font-semibold hover:font-bold">
              Add Vehicle
            </span>
          </button>

          {/* New Product */}
          <button
            onClick={() => router.push("/company-admin/masters/products/new")}
            className="flex items-center cursor-pointer justify-center gap-2 px-3 md:px-4 py-3 bg-white hover:bg-[#e9edfb] active:bg-[#F3F4F6] text-black border border-gray-300 hover:border-[#D1D5DB] rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-sm shadow-md w-full"
          >
            <Package className="w-4 h-4" />
            <span className="text-sm md:text-base font-semibold hover:font-bold">
              New Product
            </span>
          </button>

          {/* Add User */}
          <button
            onClick={() => router.push("/company-admin/masters/users/new")}
            className="flex items-center cursor-pointer justify-center gap-2 px-3 md:px-4 py-3 bg-white hover:bg-[#e9edfb] active:bg-[#F3F4F6] text-black border border-gray-300 hover:border-[#D1D5DB] rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-sm shadow-md w-full"
          >
            <UserCheck className="w-4 h-4" />
            <span className="text-sm md:text-base font-semibold hover:font-bold">
              Add User
            </span>
          </button>

          {/* Configure */}
          <button
            onClick={() => router.push("/company-admin/masters/pricing")}
            className="flex items-center cursor-pointer justify-center gap-2 px-3 md:px-4 py-3 bg-white hover:bg-[#e9edfb] active:bg-[#F3F4F6] text-black border border-gray-300 hover:border-[#D1D5DB] rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-sm shadow-md w-full"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm md:text-base font-semibold hover:font-bold">
              Configure
            </span>
          </button>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => (
          <Link key={module.href} href={module.href} className="group block">
            <Card className="h-48 hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6 h-full">
                <div className="flex flex-col h-full">
                  <div className="flex items-center mb-4">
                    <div className={`p-3 ${module.color} rounded-lg mr-4`}>
                      <module.icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                        {module.title}
                      </h3>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                  </div>
                  <p className="text-gray-600 flex-1">{module.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Reports & Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Reports & Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="flex items-center justify-center space-x-2 h-12"
              onClick={() => router.push("/company-admin/masters/dashboard")}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </Button>
            <Button
              variant="outline"
              className="flex items-center justify-center space-x-2 h-12"
              onClick={() => {
                // Mock report generation
                alert("Report generation feature coming soon!");
              }}
            >
              <Settings className="w-4 h-4" />
              <span>Generate Reports</span>
            </Button>
            <Button
              variant="outline"
              className="flex items-center justify-center space-x-2 h-12"
              onClick={() => {
                // Mock analytics view
                alert("Detailed analytics coming soon!");
              }}
            >
              <BarChart3 className="w-4 h-4" />
              <span>View Analytics</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
