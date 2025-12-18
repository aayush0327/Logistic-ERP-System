"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppLayout } from "@/components/layout/AppLayout";
import { OrderDetailsModal, CreateOrderModal } from "@/components/Modal";
import { mockOrders } from "@/data/mockData";
import { Plus, Search, Package } from "lucide-react";
import { useState } from "react";
import type { Order } from "@/types";

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "on-route":
        return "info";
      case "loading":
        return "warning";
      case "pending":
        return "default";
      default:
        return "default";
    }
  };

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedOrder(null);
  };

  const handleCreateOrder = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleCreateOrderSubmit = (data: any) => {
    console.log('Creating order:', data);
    // TODO: Add order creation logic
  };

  const orderStats = {
    total: mockOrders.length,
    pending: mockOrders.filter((o) => o.status === "pending").length,
    loading: mockOrders.filter((o) => o.status === "loading").length,
    onRoute: mockOrders.filter((o) => o.status === "on-route").length,
    completed: mockOrders.filter((o) => o.status === "completed").length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
            <p className="text-gray-500 mt-2">
              Manage and track all customer orders
            </p>
          </div>
          <Button className="flex items-center gap-2" onClick={handleCreateOrder}>
            <Plus className="w-5 h-5" />
            New Order
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-gray-900">
                {orderStats.total}
              </p>
              <p className="text-sm text-gray-500">Total Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-yellow-600">
                {orderStats.pending}
              </p>
              <p className="text-sm text-gray-500">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-blue-600">
                {orderStats.loading}
              </p>
              <p className="text-sm text-gray-500">Loading</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-purple-600">
                {orderStats.onRoute}
              </p>
              <p className="text-sm text-gray-500">On Route</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-green-600">
                {orderStats.completed}
              </p>
              <p className="text-sm text-gray-500">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black w-5 h-5" />
              <input
                type="text"
                placeholder="Search orders by customer, ID, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="
          w-full pl-10 pr-4 py-2
          text-black placeholder-gray-400
          border border-gray-300 rounded-lg
          outline-none
          transition-all duration-200 ease-in-out
          focus:border-blue-500
          focus:ring-1 focus:ring-blue-500/40
          focus:shadow-md
        "
              />
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {mockOrders.length > 0 ? (
              <div className="space-y-4">
                {mockOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {order.id}
                          </h3>
                          <Badge variant={getStatusVariant(order.status)}>
                            {order.status.charAt(0).toUpperCase() +
                              order.status.slice(1).replace("-", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1 items-center">
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
                        onClick={() => handleViewDetails(order)}
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
                action={{
                  label: "Create New Order",
                  onClick: handleCreateOrder,
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal}
        order={selectedOrder}
      />

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onCreateOrder={handleCreateOrderSubmit}
      />
    </AppLayout>
  );
}
