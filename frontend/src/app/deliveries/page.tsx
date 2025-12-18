'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AppLayout } from '@/components/layout/AppLayout';
import { mockDeliveries } from '@/data/mockData';
import { CheckCircle, Truck, MapPin, Calendar } from 'lucide-react';

export default function Deliveries() {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'on-route':
        return 'info';
      default:
        return 'default';
    }
  };

  const deliveryStats = {
    completed: mockDeliveries.filter(d => d.status === 'completed').length,
    onRoute: mockDeliveries.filter(d => d.status === 'on-route').length,
    total: mockDeliveries.length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deliveries</h1>
          <p className="text-gray-500 mt-2">Track and manage all delivery operations</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{deliveryStats.total}</p>
                  <p className="text-sm text-gray-500">Total Deliveries</p>
                </div>
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Truck className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-green-600">{deliveryStats.completed}</p>
                  <p className="text-sm text-gray-500">Completed</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-blue-600">{deliveryStats.onRoute}</p>
                  <p className="text-sm text-gray-500">On Route</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Deliveries */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockDeliveries.map((delivery) => (
                <div key={delivery.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{delivery.id}</h3>
                        <Badge variant={getStatusVariant(delivery.status)}>
                          {delivery.status === 'on-route' ? 'On Route' : 'Completed'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Customer: {delivery.customer}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {delivery.address}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {delivery.date}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order IDs */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">Orders:</span>
                    <div className="flex gap-2">
                      {delivery.orderIds.map((orderId) => (
                        <span key={orderId} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {orderId}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {mockDeliveries.length === 0 && (
              <div className="text-center py-12">
                <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries yet</h3>
                <p className="text-gray-500">Deliveries will appear here once orders are dispatched</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}