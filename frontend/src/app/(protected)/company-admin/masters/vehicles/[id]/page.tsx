'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import {
  ArrowLeft,
  Edit,
  Truck,
  MapPin,
  Building,
  Calendar,
  Wrench,
  Settings,
  Info,
  BarChart3,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useGetVehicleQuery } from '@/services/api/companyApi';

export default function VehicleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = params.id as string;

  const { data: vehicle, isLoading, error } = useGetVehicleQuery(vehicleId);

  if (error) {
    return (
      <div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium">Error loading vehicle details</h3>
            <p className="text-red-600 text-sm mt-1">The vehicle may not exist or you don't have permission to view it</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
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
      </div>
    );
  }

  if (!vehicle) return null;

  const statusBadge = (
    <Badge variant={
      vehicle.status === 'available' ? 'success' :
      vehicle.status === 'on_trip' ? 'info' :
      vehicle.status === 'maintenance' ? 'warning' : 'default'
    }>
      {vehicle.status?.replace('_', ' ') || 'N/A'}
    </Badge>
  );

  const getTypeBadge = (vehicle: any) => {
    const typeName = vehicle.vehicle_type_relation?.name || vehicle.vehicle_type?.replace('_', ' ') || 'N/A';
    return (
      <Badge variant="default">
        {typeName}
      </Badge>
    );
  };

  const getMaintenanceStatus = () => {
    if (!vehicle.next_maintenance) return { status: 'none', message: 'No maintenance scheduled' };

    const today = new Date();
    const nextMaintenance = new Date(vehicle.next_maintenance);
    const daysUntilMaintenance = Math.ceil((nextMaintenance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilMaintenance < 0) {
      return { status: 'overdue', message: 'Maintenance overdue' };
    } else if (daysUntilMaintenance <= 7) {
      return { status: 'due', message: `Maintenance due in ${daysUntilMaintenance} days` };
    } else {
      return { status: 'scheduled', message: `Next maintenance in ${daysUntilMaintenance} days` };
    }
  };

  const maintenanceStatus = getMaintenanceStatus();

  return (
    <div>
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
              <h1 className="text-3xl font-bold text-gray-900">{vehicle.plate_number}</h1>
              <p className="text-gray-500">{vehicle.make} {vehicle.model} {vehicle.year}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {statusBadge}
            <Button onClick={() => router.push(`/company-admin/masters/vehicles/${vehicleId}/edit`)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Vehicle
            </Button>
          </div>
        </div>

        {/* Vehicle Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="w-5 h-5 mr-2" />
                Basic Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Plate Number</label>
                <p className="text-gray-900">{vehicle.plate_number}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Make</label>
                <p className="text-gray-900">{vehicle.make || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Model</label>
                <p className="text-gray-900">{vehicle.model || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Year</label>
                <p className="text-gray-900">{vehicle.year || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">{statusBadge}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Vehicle Type</label>
                <div className="mt-1">{getTypeBadge(vehicle)}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Weight Capacity</label>
                <p className="text-gray-900">{vehicle.capacity_weight ? `${vehicle.capacity_weight} kg` : 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Volume Capacity</label>
                <p className="text-gray-900">{vehicle.capacity_volume ? `${vehicle.capacity_volume} m³` : 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="w-5 h-5 mr-2" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Assigned Branch</label>
                <p className="text-gray-900">{vehicle.branch?.name || 'Not assigned'}</p>
              </div>
              {vehicle.branch && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Branch Code</label>
                    <p className="text-gray-900">{vehicle.branch.code}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Location</label>
                    <p className="text-gray-900">
                      {vehicle.branch.city && vehicle.branch.state
                        ? `${vehicle.branch.city}, ${vehicle.branch.state}`
                        : 'N/A'
                      }
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wrench className="w-5 h-5 mr-2" />
                Maintenance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                {maintenanceStatus.status === 'overdue' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                {maintenanceStatus.status === 'due' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                {maintenanceStatus.status === 'scheduled' && <CheckCircle className="w-4 h-4 text-green-500" />}
                <span className={`text-sm font-medium ${
                  maintenanceStatus.status === 'overdue' ? 'text-red-600' :
                  maintenanceStatus.status === 'due' ? 'text-yellow-600' :
                  maintenanceStatus.status === 'scheduled' ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {maintenanceStatus.message}
                </span>
              </div>
              {vehicle.last_maintenance && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Maintenance</label>
                  <p className="text-gray-900">{new Date(vehicle.last_maintenance).toLocaleDateString()}</p>
                </div>
              )}
              {vehicle.next_maintenance && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Next Maintenance</label>
                  <p className="text-gray-900">{new Date(vehicle.next_maintenance).toLocaleDateString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Vehicle Statistics */}
        {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Trips</p>
                  <p className="text-2xl font-bold text-gray-900">342</p>
                </div>
                <Truck className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Distance</p>
                  <p className="text-2xl font-bold text-gray-900">45,230 km</p>
                </div>
                <MapPin className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg. Fuel</p>
                  <p className="text-2xl font-bold text-gray-900">8.5 km/l</p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">In Service</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {vehicle.created_at ? new Date(vehicle.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div> */}

        {/* Detailed Tabs */}
        {/* <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trips">Trip History</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance Log</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Utilization Rate</span>
                      <span className="text-lg font-semibold">78%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">On-Time Delivery</span>
                      <span className="text-lg font-semibold">94%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Average Trip Distance</span>
                      <span className="text-lg font-semibold">132 km</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Uptime This Month</span>
                      <span className="text-lg font-semibold">96%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Current Load</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Weight</span>
                        <span className="font-medium">850 / 1000 kg</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Volume</span>
                        <span className="font-medium">3.2 / 4.0 m³</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '80%' }}></div>
                      </div>
                    </div>
                    <div className="pt-4">
                      <p className="text-sm text-gray-600 mb-2">Current Cargo</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Electronics Boxes</span>
                          <span>450 kg</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Furniture</span>
                          <span>400 kg</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trips">
            <Card>
              <CardHeader>
                <CardTitle>Recent Trips</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trip ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">#TRP-001</TableCell>
                      <TableCell>2024-01-15</TableCell>
                      <TableCell>Mumbai → Pune</TableCell>
                      <TableCell>150 km</TableCell>
                      <TableCell>3h 45m</TableCell>
                      <TableCell>
                        <Badge variant="success">Completed</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">#TRP-002</TableCell>
                      <TableCell>2024-01-14</TableCell>
                      <TableCell>Pune → Mumbai</TableCell>
                      <TableCell>150 km</TableCell>
                      <TableCell>4h 15m</TableCell>
                      <TableCell>
                        <Badge variant="success">Completed</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">#TRP-003</TableCell>
                      <TableCell>2024-01-13</TableCell>
                      <TableCell>Mumbai → Nashik</TableCell>
                      <TableCell>180 km</TableCell>
                      <TableCell>4h 30m</TableCell>
                      <TableCell>
                        <Badge variant="info">In Progress</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Next Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>2023-12-15</TableCell>
                      <TableCell>Scheduled</TableCell>
                      <TableCell>Regular service - Oil change, filter replacement</TableCell>
                      <TableCell>$250</TableCell>
                      <TableCell>2024-03-15</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>2023-10-20</TableCell>
                      <TableCell>Repair</TableCell>
                      <TableCell>Brake pad replacement</TableCell>
                      <TableCell>$450</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>2023-08-10</TableCell>
                      <TableCell>Scheduled</TableCell>
                      <TableCell>Full service - Comprehensive check</TableCell>
                      <TableCell>$600</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Current Month</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fuel</span>
                        <span className="font-medium">$1,200</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Maintenance</span>
                        <span className="font-medium">$250</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Insurance</span>
                        <span className="font-medium">$300</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Taxes & Fees</span>
                        <span className="font-medium">$150</span>
                      </div>
                      <div className="pt-3 border-t">
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span>$1,900</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Revenue vs Expenses</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Revenue</span>
                          <span className="font-medium">$8,500</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Expenses</span>
                          <span className="font-medium">$1,900</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-red-600 h-2 rounded-full" style={{ width: '22%' }}></div>
                        </div>
                      </div>
                      <div className="pt-3">
                        <div className="flex justify-between font-semibold text-lg">
                          <span>Net Profit</span>
                          <span className="text-green-600">$6,600</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs> */}
      </div>
    </div>
  );
}