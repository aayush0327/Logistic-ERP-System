'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Building,
  Package,
  Truck,
  DollarSign,
  Activity,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  useGetBranchesQuery,
  useGetCustomersQuery,
  useGetVehiclesQuery,
  useGetProductsQuery,
  useGetLowStockProductsQuery
} from '@/services/api/companyApi';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  description?: string;
}

function MetricCard({ title, value, change, icon, description }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              {icon}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              {description && (
                <p className="text-xs text-gray-500">{description}</p>
              )}
            </div>
          </div>
          {change !== undefined && (
            <div className={`flex items-center text-sm ${
              change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              {change > 0 ? <ArrowUpRight className="w-4 h-4" /> :
               change < 0 ? <ArrowDownRight className="w-4 h-4" /> : null}
              {Math.abs(change)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
}

function QuickAction({ title, description, icon, onClick, color = "blue" }: QuickActionProps) {
  const colorClasses = {
    blue: "hover:bg-blue-50",
    green: "hover:bg-green-50",
    purple: "hover:bg-purple-50",
    orange: "hover:bg-orange-50",
  };

  return (
    <Card className={`cursor-pointer transition-colors ${colorClasses[color as keyof typeof colorClasses]}`}
          onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 bg-${color}-50 rounded-lg`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface RecentActivityProps {
  type: 'customer' | 'branch' | 'vehicle' | 'product' | 'order';
  title: string;
  description: string;
  time: string;
  status?: 'success' | 'warning' | 'error';
}

function RecentActivity({ type, title, description, time, status }: RecentActivityProps) {
  const getIcon = () => {
    switch (type) {
      case 'customer':
        return <Users className="w-4 h-4" />;
      case 'branch':
        return <Building className="w-4 h-4" />;
      case 'vehicle':
        return <Truck className="w-4 h-4" />;
      case 'product':
        return <Package className="w-4 h-4" />;
      case 'order':
        return <Package className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg">
      <div className="p-2 bg-gray-100 rounded-lg">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-600">{description}</p>
        <p className="text-xs text-gray-400">{time}</p>
      </div>
      <div className="flex-shrink-0">
        {getStatusIcon()}
      </div>
    </div>
  );
}

export default function MastersDashboard() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Fetch data from API
  const { data: branchesData, isLoading: branchesLoading } = useGetBranchesQuery({});
  const { data: customersData, isLoading: customersLoading } = useGetCustomersQuery({});
  const { data: vehiclesData, isLoading: vehiclesLoading } = useGetVehiclesQuery({});
  const { data: productsData, isLoading: productsLoading } = useGetProductsQuery({});
  const { data: lowStockProductsData } = useGetLowStockProductsQuery({});

  // Extract items from paginated responses
  const branches = branchesData?.items || [];
  const customers = customersData?.items || [];
  const vehicles = vehiclesData?.items || [];
  const products = productsData?.items || [];
  const lowStockProducts = lowStockProductsData?.items || [];

  // Calculate metrics
  const activeBranches = branches.filter(b => b.is_active).length;
  const activeCustomers = customers.filter(c => c.is_active).length;
  const activeVehicles = vehicles.filter(v => v.is_active && v.status === 'available').length;
  const activeProducts = products.filter(p => p.is_active).length;
  const lowStockCount = lowStockProducts.length;

  const quickActions = [
    {
      title: 'New Customer',
      description: 'Add a new customer',
      icon: <Users className="w-5 h-5 text-blue-600" />,
      onClick: () => router.push('/masters/customers/new'),
      color: 'blue' as const
    },
    {
      title: 'New Branch',
      description: 'Create a new branch',
      icon: <Building className="w-5 h-5 text-green-600" />,
      onClick: () => router.push('/masters/branches/new'),
      color: 'green' as const
    },
    {
      title: 'Add Vehicle',
      description: 'Register new vehicle',
      icon: <Truck className="w-5 h-5 text-purple-600" />,
      onClick: () => router.push('/masters/vehicles/new'),
      color: 'purple' as const
    },
    {
      title: 'Add Product',
      description: 'Create new product',
      icon: <Package className="w-5 h-5 text-orange-600" />,
      onClick: () => router.push('/masters/products/new'),
      color: 'orange' as const
    }
  ];

  // Mock recent activities (will be replaced with real API later)
  const recentActivities: RecentActivityProps[] = [
    {
      type: 'customer',
      title: 'New customer registered',
      description: 'ABC Corp added to customer list',
      time: '2 minutes ago',
      status: 'success'
    },
    {
      type: 'vehicle',
      title: 'Vehicle maintenance scheduled',
      description: 'Truck MH-12-AB-1234 scheduled for maintenance',
      time: '1 hour ago',
      status: 'warning'
    },
    {
      type: 'product',
      title: 'Low stock alert',
      description: '5 products running low on inventory',
      time: '2 hours ago',
      status: 'error'
    },
    {
      type: 'branch',
      title: 'Branch performance updated',
      description: 'Mumbai branch monthly report generated',
      time: '3 hours ago',
      status: 'success'
    }
  ];

  // Top performing branches (mock data for now)
  const topBranches = branches?.slice(0, 3).map(branch => ({
    name: branch.name,
    customers: customers?.filter(c => c.home_branch_id === branch.id).length || 0,
    vehicles: vehicles?.filter(v => v.branch_id === branch.id).length || 0,
    growth: Math.floor(Math.random() * 20) - 5
  })) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Masters Dashboard</h1>
          <p className="text-gray-500 mt-2">Overview of your company's master data and key metrics</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Branches"
            value={branchesLoading ? '...' : activeBranches}
            change={12}
            icon={<Building className="w-6 h-6 text-blue-600" />}
            description="Active branches"
          />
          <MetricCard
            title="Total Customers"
            value={customersLoading ? '...' : activeCustomers}
            change={8}
            icon={<Users className="w-6 h-6 text-green-600" />}
            description="Active customers"
          />
          <MetricCard
            title="Available Vehicles"
            value={vehiclesLoading ? '...' : activeVehicles}
            change={-2}
            icon={<Truck className="w-6 h-6 text-purple-600" />}
            description="Ready for dispatch"
          />
          <MetricCard
            title="Total Products"
            value={productsLoading ? '...' : activeProducts}
            change={15}
            icon={<Package className="w-6 h-6 text-orange-600" />}
            description={`${lowStockCount} low in stock`}
          />
        </div>

        {/* Quick Actions and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {quickActions.map((action, index) => (
                  <QuickAction key={index} {...action} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivities.map((activity, index) => (
                  <RecentActivity key={index} {...activity} />
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button variant="ghost" className="w-full">
                  View All Activities
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics and Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performing Branches */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Branches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topBranches.map((branch, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-sm text-gray-600 flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {branch.customers} customers
                        </span>
                        <span className="text-sm text-gray-600 flex items-center">
                          <Truck className="w-3 h-3 mr-1" />
                          {branch.vehicles} vehicles
                        </span>
                      </div>
                    </div>
                    <div className={`text-sm font-medium ${
                      branch.growth > 0 ? 'text-green-600' : branch.growth < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {branch.growth > 0 ? '+' : ''}{branch.growth}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">API Services</span>
                  </div>
                  <Badge variant="success">Operational</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">Database</span>
                  </div>
                  <Badge variant="success">Connected</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-900">Inventory</span>
                  </div>
                  <Badge variant="warning">{lowStockCount} items low</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Last Sync</span>
                  </div>
                  <span className="text-sm text-blue-700">2 minutes ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}