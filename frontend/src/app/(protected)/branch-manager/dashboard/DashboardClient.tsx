"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppLayout } from "@/components/layout/AppLayout";
import { OrderDetailsModal, CreateOrderModal } from "@/components/Modal";
import {
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useSubmitOrderMutation,
  Order,
} from "@/services/api/ordersApi";
import { Plus, Search, Package, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch real orders data
  const {
    data: ordersData,
    isLoading,
    error,
    refetch: refetchOrders,
  } = useGetOrdersQuery({
    page: 1,
    per_page: 20,
    search: searchQuery || undefined,
  });
  const orders = ordersData?.items || [];

  // Submit order mutation
  const [submitOrder, { isLoading: isSubmitting }] = useSubmitOrderMutation();

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
      case "submitted":
        return "info";
      case "draft":
        return "default";
      default:
        return "default";
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "draft":
        return "Draft";
      case "submitted":
        return "Submitted";
      case "completed":
        return "Completed";
      default:
        return (
          status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")
        );
    }
  };

  const handleViewDetails = (order: Order) => {
    console.log(order, "order");
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

  const handleCreateOrderSuccess = (order: any) => {
    // Refetch orders to update the list
    refetchOrders();

    // Show the newly created order details
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  };

  const handleSubmitOrder = async (orderId: string) => {
    try {
      await submitOrder(orderId).unwrap();
      toast.success("Order sent for approval successfully!");
      refetchOrders(); // Refresh orders to show updated status
    } catch (error: any) {
      toast.error(error.message || "Failed to send order for approval");
    }
  };

  const orderStats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "submitted").length,
    loading: orders.filter((o) => o.status === "assigned").length,
    onRoute: orders.filter(
      (o) => o.status === "picked_up" || o.status === "in_transit"
    ).length,
    completed: orders.filter((o) => o.status === "delivered").length,
  };

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
            <p className="text-gray-500 mt-2">
              Manage and track all customer orders
            </p>
          </div>
          <Button
            className="flex items-center gap-2"
            onClick={handleCreateOrder}
          >
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
            {orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {order.order_number}
                          </h3>
                          <Badge variant={getStatusVariant(order.status)}>
                            {getStatusDisplay(order.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1 items-center">
                          Customer: {order.customer?.name || "N/A"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {order.items_count || 0} items •{" "}
                          {new Date(order.created_at).toLocaleDateString()} •
                          Total: ${order.total_amount.toFixed(2)}
                        </p>

                        {/* Items Summary */}
                        {order.items && order.items.length > 0 && (
                          <div className="mt-3 border-t pt-2">
                            <div className="flex items-center gap-1 mb-2">
                              <Package className="w-3 h-3 text-gray-500" />
                              <p className="text-xs font-medium text-gray-700">
                                Items ({order.items_count}):
                              </p>
                            </div>
                            <div className="space-y-1">
                              {order.items.slice(0, 2).map((item, index) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between text-xs bg-blue-50 rounded p-2 border border-blue-100"
                                >
                                  <div className="flex-1">
                                    <span className="font-medium text-blue-900">
                                      {item.product_name}
                                    </span>
                                    {item.product_code && (
                                      <span className="ml-2 text-blue-600">
                                        ({item.product_code})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-blue-700">
                                    <span>
                                      × {item.quantity} {item.unit}
                                    </span>
                                    {item.total_weight && (
                                      <span>
                                        {item.total_weight.toFixed(1)}kg
                                      </span>
                                    )}
                                    {item.total_price && (
                                      <span className="font-medium">
                                        ${item.total_price.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {order.items.length > 2 && (
                                <p className="text-xs text-blue-600 italic text-center py-1">
                                  +{order.items.length - 2} more item
                                  {order.items.length - 2 > 1 ? "s" : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        {order.status === "draft" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSubmitOrder(order.id)}
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Send for Approval
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(order)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <EmptyState
                title="Error loading orders"
                description="Failed to load orders. Please try again."
              />
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
        onSuccess={handleCreateOrderSuccess}
      />
    </>
  );
}
