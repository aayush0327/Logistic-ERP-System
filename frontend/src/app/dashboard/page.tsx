'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockKPIs } from '@/data/mockData';
import {
  Truck,
  AlertTriangle,
  CheckCircle,
  Plus,
  Route,
  Users,
  Activity
} from 'lucide-react';

export default function Dashboard() {
  const getKPIIcon = (title: string) => {
    switch (title) {
      case 'Available Trucks':
        return <Truck className="w-8 h-8" />;
      case 'Overdue Customers':
        return <AlertTriangle className="w-8 h-8" />;
      case 'Today Deliveries':
        return <CheckCircle className="w-8 h-8" />;
      default:
        return <Activity className="w-8 h-8" />;
    }
  };

  const getKPIColor = (color?: string) => {
    switch (color) {
      case 'green':
        return 'text-green-600 bg-green-50';
      case 'red':
        return 'text-red-600 bg-red-50';
      case 'blue':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-2">Welcome back! Here's an overview of your logistics operations.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mockKPIs.map((kpi, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${getKPIColor(kpi.color)}`}>
                    {getKPIIcon(kpi.title)}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
                    <p className="text-sm text-gray-500">{kpi.title}</p>
                    {kpi.subtitle && (
                      <p className="text-xs text-gray-400 mt-1">{kpi.subtitle}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button className="flex items-center gap-2 h-auto p-4 flex-col">
                <Plus className="w-6 h-6" />
                <span>Create New Order</span>
              </Button>
              <Button variant="outline" className="flex items-center gap-2 h-auto p-4 flex-col">
                <Route className="w-6 h-6" />
                <span>Plan New Trip</span>
              </Button>
              <Button variant="outline" className="flex items-center gap-2 h-auto p-4 flex-col">
                <Users className="w-6 h-6" />
                <span>View Overdue Customers</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Delivery Completed</p>
                  <p className="text-xs text-gray-500">Order #ORD-001 delivered to John's Farm</p>
                </div>
                <span className="text-xs text-gray-400">2 mins ago</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">New Trip Created</p>
                  <p className="text-xs text-gray-500">Trip #TRIP-002 planned for South Branch</p>
                </div>
                <span className="text-xs text-gray-400">1 hour ago</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Order Loading</p>
                  <p className="text-xs text-gray-500">Order #ORD-003 being prepared</p>
                </div>
                <span className="text-xs text-gray-400">2 hours ago</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Due Days Functionality Test */}
        <Card>
          <CardHeader>
            <CardTitle>Due Days Functionality Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button variant="outline">Test Due Day 1</Button>
              <Button variant="outline">Test Due Day 2</Button>
              <Button variant="outline">Test Due Day 3</Button>
              <Button variant="outline">Test Due Day 4</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}