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

  const quickActions = [
    {
      title: "New Branch",
      icon: Building,
      href: "/company-admin/masters/branches/new",
      isPrimary: true,
    },
    {
      title: "New Customer",
      icon: Users,
      href: "/company-admin/masters/customers/new",
      isPrimary: false,
    },
    {
      title: "Add Vehicle",
      icon: Truck,
      href: "/company-admin/masters/vehicles/new",
      isPrimary: false,
    },
    {
      title: "New Product",
      icon: Package,
      href: "/company-admin/masters/products/new",
      isPrimary: false,
    },
    {
      title: "Add User",
      icon: UserCheck,
      href: "/company-admin/masters/users/new",
      isPrimary: false,
    },
    {
      title: "Configure",
      icon: Settings,
      href: "/company-admin/masters/pricing",
      isPrimary: false,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Masters Management</h1>
        {/* <p className="text-gray-500 mt-2">
          Manage all master data and configurations for your logistics business
        </p> */}
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
      <div className="shrink-0 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.href}
              onClick={() => router.push(action.href)}
              className={`flex items-center cursor-pointer justify-center gap-2 px-3 md:px-4 py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg w-full ${
                action.isPrimary
                  ? "bg-[#1f40ae] hover:bg-[#1f40ae] active:bg-[#1f40ae] text-white shadow-md"
                  : "bg-white hover:bg-[#e9edfb] active:bg-[#F3F4F6] text-black border border-gray-300 hover:border-[#D1D5DB] shadow-sm"
              }`}
            >
              <action.icon className="w-4 h-4" />
              <span className="text-sm md:text-base font-semibold hover:font-bold">
                {action.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Modules Grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          All Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module) => (
            <Link key={module.href} href={module.href} className="group block">
              <div className="bg-white rounded-xl border-2 border-gray-200 p-5 shadow-sm hover:shadow-xl transition-shadow duration-300 h-full">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 ${module.color} rounded-xl group-hover:scale-110 transition-transform duration-200`}
                  >
                    <module.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-[#1f40ae] transition-colors duration-200 mb-1">
                      {module.title}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {module.description}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#1f40ae] group-hover:translate-x-1 transition-all duration-200 flex-shrink-0 mt-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
