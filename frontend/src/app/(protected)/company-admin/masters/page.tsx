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

export default function MastersPage() {
  const router = useRouter();

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg mr-4">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Branches
                </p>
                <Link
                  href="/company-admin/masters/branches"
                  className="text-2xl font-bold text-gray-900 hover:text-blue-600"
                >
                  View
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg mr-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Customers
                </p>
                <Link
                  href="/company-admin/masters/customers"
                  className="text-2xl font-bold text-gray-900 hover:text-green-600"
                >
                  View
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg mr-4">
                <Truck className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Vehicles
                </p>
                <Link
                  href="/company-admin/masters/vehicles"
                  className="text-2xl font-bold text-gray-900 hover:text-purple-600"
                >
                  View
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg mr-4">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Products
                </p>
                <Link
                  href="/company-admin/masters/products"
                  className="text-2xl font-bold text-gray-900 hover:text-orange-600"
                >
                  View
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50"
              onClick={() => router.push("/company-admin/masters/branches/new")}
            >
              <Building className="w-8 h-8" />
              <span>New Branch</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50"
              onClick={() => router.push("/company-admin/masters/customers/new")}
            >
              <Users className="w-8 h-8" />
              <span>New Customer</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50"
              onClick={() => router.push("/company-admin/masters/vehicles/new")}
            >
              <Truck className="w-8 h-8" />
              <span>Add Vehicle</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50"
              onClick={() => router.push("/company-admin/masters/products/new")}
            >
              <Package className="w-8 h-8" />
              <span>New Product</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50"
              onClick={() => router.push("/company-admin/masters/users/new")}
            >
              <UserCheck className="w-8 h-8" />
              <span>Add User</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50"
              onClick={() => router.push("/company-admin/masters/pricing")}
            >
              <Settings className="w-8 h-8" />
              <span>Configure</span>
            </Button>
          </div>
        </CardContent>
      </Card>

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
