"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MapPin, Weight } from "lucide-react";

interface ApprovedOrdersTabProps {
  approvedOrders: any[];
  getPriorityVariant: (priority: string) => string;
}

export default function ApprovedOrdersTab({
  approvedOrders,
  getPriorityVariant,
}: ApprovedOrdersTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-black">
          Approved Orders ({approvedOrders.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {approvedOrders.map((order) => (
            <div
              key={order.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-gray-900">{order.id}</h3>
                  <Badge
                    variant={
                      getPriorityVariant(order.priority) as
                        | "default"
                        | "success"
                        | "warning"
                        | "danger"
                        | "info"
                    }
                    className="mt-1"
                  >
                    {order.priority}
                  </Badge>
                  <Badge variant="success">
                    {order.status.charAt(0).toUpperCase() +
                      order.status.slice(1)}
                  </Badge>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-500">{order.date}</span>
                  <p className="text-lg font-semibold text-gray-900">
                    ₹{order.total.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-medium text-gray-900">{order.customer}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Items</p>
                  <p className="font-medium text-gray-900">{order.items}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Weight</p>
                  <p className="font-medium text-gray-900 flex items-center gap-1">
                    <Weight className="w-4 h-4" />
                    {order.weight} kg
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Volume</p>
                  <p className="font-medium text-gray-900">{order.volume} L</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-900">
                  <MapPin className="w-4 h-4 inline mr-1 text-gray-400" />
                  {order.address}
                </p>
              </div>

              <div className="mt-3 flex gap-2">
                <Button size="sm">Assign to Trip</Button>
                <Button size="sm" variant="outline">
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
