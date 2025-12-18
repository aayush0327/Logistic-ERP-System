'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  ArrowLeft,
  Edit,
  MapPin,
  Phone,
  Mail,
  Building,
  Users,
  Truck,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Info,
  Settings,
  BarChart3,
  Plus
} from 'lucide-react';
import { useGetBranchQuery, useGetBranchMetricsQuery } from '@/services/api/companyApi';
import { toast } from 'react-hot-toast';

export default function BranchDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params.id as string;

  const { data: branch, isLoading, error } = useGetBranchQuery(branchId);
  const { data: metrics } = useGetBranchMetricsQuery(branchId);

  if (error) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium">Error loading branch details</h3>
            <p className="text-red-600 text-sm mt-1">The branch may not exist or you don't have permission to view it</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!branch) return null;

  const statusBadge = (
    <Badge variant={branch.is_active ? 'success' : 'default'}>
      {branch.is_active ? 'Active' : 'Inactive'}
    </Badge>
  );

  return (
    <AppLayout>
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
            <Button onClick={() => router.push(`/masters/branches/${branchId}/edit`)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Branch
            </Button>
          </div>
        </div>

        {/* Branch Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="w-5 h-5 mr-2" />
                Branch Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Branch Code</label>
                <p className="text-gray-900">{branch.code}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Branch Name</label>
                <p className="text-gray-900">{branch.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">{statusBadge}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Created Date</label>
                <p className="text-gray-900">
                  {new Date(branch.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Address Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Address</label>
                <p className="text-gray-900">{branch.address || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">City</label>
                <p className="text-gray-900">{branch.city || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">State</label>
                <p className="text-gray-900">{branch.state || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Postal Code</label>
                <p className="text-gray-900">{branch.postal_code || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="w-5 h-5 mr-2" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <p className="text-gray-900">{branch.phone || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900">{branch.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Manager ID</label>
                <p className="text-gray-900">{branch.manager_id || 'Not assigned'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {branch.customers?.length || 0}
                  </p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Vehicles</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {branch.vehicles?.length || 0}
                  </p>
                </div>
                <Truck className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Vehicles</p>
                  <p className="text-2xl font-bold text-green-600">
                    {branch.vehicles?.filter(v => v.is_active).length || 0}
                  </p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-green-600 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Revenue (MTD)</p>
                  <p className="text-2xl font-bold text-purple-600">
                    ${metrics?.revenue_mtd?.toLocaleString() || '0'}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics?.recent_activities?.map((activity: any, index: number) => (
                      <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                          <p className="text-xs text-gray-500">{activity.date}</p>
                        </div>
                      </div>
                    )) || (
                      <p className="text-sm text-gray-500">No recent activities</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Orders This Month</span>
                      <span className="text-lg font-semibold">{metrics?.orders_mtd || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Delivery Success Rate</span>
                      <span className="text-lg font-semibold">{metrics?.delivery_success_rate || 0}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Average Delivery Time</span>
                      <span className="text-lg font-semibold">{metrics?.avg_delivery_time || 0}h</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Customer Satisfaction</span>
                      <span className="text-lg font-semibold">{metrics?.customer_satisfaction || 0}/5</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Customers</CardTitle>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Customer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {branch.customers && branch.customers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Business Type</TableHead>
                        <TableHead>Credit Limit</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branch.customers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.code}</TableCell>
                          <TableCell>{customer.name}</TableCell>
                          <TableCell>{customer.phone || 'N/A'}</TableCell>
                          <TableCell>{customer.business_type || 'N/A'}</TableCell>
                          <TableCell>${customer.credit_limit.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={customer.is_active ? 'success' : 'default'}>
                              {customer.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No customers</h3>
                    <p className="text-gray-500">This branch doesn't have any customers assigned yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Vehicles</CardTitle>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vehicle
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {branch.vehicles && branch.vehicles.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plate Number</TableHead>
                        <TableHead>Make/Model</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branch.vehicles.map((vehicle) => (
                        <TableRow key={vehicle.id}>
                          <TableCell className="font-medium">{vehicle.plate_number}</TableCell>
                          <TableCell>{vehicle.make} {vehicle.model}</TableCell>
                          <TableCell>{vehicle.vehicle_type}</TableCell>
                          <TableCell>{vehicle.capacity_weight} kg</TableCell>
                          <TableCell>
                            <Badge variant={
                              vehicle.status === 'available' ? 'success' :
                              vehicle.status === 'on_trip' ? 'info' : 'warning'
                            }>
                              {vehicle.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No vehicles</h3>
                    <p className="text-gray-500">This branch doesn't have any vehicles assigned yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Monthly Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-green-900">Orders Completed</span>
                      <span className="text-lg font-bold text-green-600">
                        {metrics?.orders_completed || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-medium text-blue-900">Revenue Generated</span>
                      <span className="text-lg font-bold text-blue-600">
                        ${metrics?.revenue_generated?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                      <span className="text-sm font-medium text-purple-900">Fuel Efficiency</span>
                      <span className="text-lg font-bold text-purple-600">
                        {metrics?.fuel_efficiency || 0} km/l
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                      <span className="text-sm font-medium text-orange-900">On-Time Delivery</span>
                      <span className="text-lg font-bold text-orange-600">
                        {metrics?.on_time_delivery_rate || 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Growth Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Customer Growth (MoM)</span>
                      <div className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm font-medium text-green-600">
                          +{metrics?.customer_growth || 0}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Revenue Growth (MoM)</span>
                      <div className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                        <span className="text-sm font-medium text-green-600">
                          +{metrics?.revenue_growth || 0}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Order Volume Growth</span>
                      <div className="flex items-center">
                        {metrics?.order_volume_growth >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                        )}
                        <span className={`text-sm font-medium ${
                          metrics?.order_volume_growth >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {metrics?.order_volume_growth >= 0 ? '+' : ''}{metrics?.order_volume_growth || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}