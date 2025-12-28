/**
 * Orders List Section
 * Displays list of orders with details and actions
 */
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Order } from '@/types';

interface OrdersListProps {
  orders: Order[];
  onViewDetails: (order: Order) => void;
  onCreateOrder?: () => void;
}

export function OrdersList({ orders, onViewDetails, onCreateOrder }: OrdersListProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'on-route':
        return 'info';
      case 'loading':
        return 'warning';
      case 'pending':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {order.id}
                      </h3>
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status.charAt(0).toUpperCase() +
                          order.status.slice(1).replace('-', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      Customer: {order.customer}
                    </p>
                    <p className="text-sm text-gray-500">
                      {order.items} items • {order.date} • Total: $
                      {order.total.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetails(order)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No orders found"
            description="Start by creating your first order"
            action={
              onCreateOrder
                ? {
                    label: 'Create New Order',
                    onClick: onCreateOrder,
                  }
                : undefined
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

