'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockActivities } from '@/data/mockData';
import { Clock, Package, Truck, CheckCircle, User } from 'lucide-react';

export default function History() {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <Package className="w-5 h-5" />;
      case 'trip':
        return <Truck className="w-5 h-5" />;
      case 'delivery':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'order':
        return 'text-blue-600 bg-blue-50';
      case 'trip':
        return 'text-purple-600 bg-purple-50';
      case 'delivery':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const orderActivities = mockActivities.filter(a => a.type === 'order');
  const tripActivities = mockActivities.filter(a => a.type === 'trip');
  const deliveryActivities = mockActivities.filter(a => a.type === 'delivery');

  const TimelineItem = ({ activity }: { activity: any }) => (
    <div className="flex gap-4">
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
        {getActivityIcon(activity.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4 mb-1">
          <p className="font-medium text-gray-900">{activity.action}</p>
          <span className="text-xs text-gray-500 whitespace-nowrap">{activity.timestamp}</span>
        </div>
        <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <User className="w-3 h-3" />
          {activity.user}
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">History</h1>
          <p className="text-gray-500 mt-2">Track all activities and events across the system</p>
        </div>

        {/* Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList>
                <TabsTrigger value="all">All Activities</TabsTrigger>
                <TabsTrigger value="orders">Orders ({orderActivities.length})</TabsTrigger>
                <TabsTrigger value="trips">Trips ({tripActivities.length})</TabsTrigger>
                <TabsTrigger value="deliveries">Deliveries ({deliveryActivities.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                <div className="space-y-6">
                  {mockActivities.map((activity) => (
                    <TimelineItem key={activity.id} activity={activity} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="orders">
                <div className="space-y-6">
                  {orderActivities.length > 0 ? (
                    orderActivities.map((activity) => (
                      <TimelineItem key={activity.id} activity={activity} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No order activities found
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="trips">
                <div className="space-y-6">
                  {tripActivities.length > 0 ? (
                    tripActivities.map((activity) => (
                      <TimelineItem key={activity.id} activity={activity} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No trip activities found
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="deliveries">
                <div className="space-y-6">
                  {deliveryActivities.length > 0 ? (
                    deliveryActivities.map((activity) => (
                      <TimelineItem key={activity.id} activity={activity} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No delivery activities found
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{orderActivities.length}</p>
                  <p className="text-sm text-gray-500">Order Activities</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Truck className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{tripActivities.length}</p>
                  <p className="text-sm text-gray-500">Trip Activities</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{deliveryActivities.length}</p>
                  <p className="text-sm text-gray-500">Delivery Activities</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-gray-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{mockActivities.length}</p>
                  <p className="text-sm text-gray-500">Total Activities</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}