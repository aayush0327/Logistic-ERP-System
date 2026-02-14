"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { CreateOrderModal } from "@/components/Modal";
import { DueDaysTab } from "@/components/orders/DueDaysTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useAppSelector } from "@/store/hooks";
import {
  useGetOrdersQuery,
  useGetOrderItemsWithAssignmentsQuery,
  useGetDueDaysStatisticsQuery,
  Order,
} from "@/services/api/ordersApi";
import {
  Plus,
  Search,
  Package,
  User,
  Phone,
  Weight,
  Clock,
  TrendingUp,
  Building2,
  Edit,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

export default function DashboardClient() {
  // Get current user from Redux store
  const { user } = useAppSelector((state) => state.auth);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>(undefined);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Fetch orders filtered by created_by_role for marketing person
  const {
    data: ordersData,
    isLoading,
    error,
    refetch: refetchOrders,
  } = useGetOrdersQuery({
    page: 1,
    per_page: 20,
    created_by_role: "marketing_person", // Filter by marketing person role
    search: searchQuery || undefined,
  });

  // Auto-refresh orders every hour
  useEffect(() => {
    const interval = setInterval(() => {
      refetchOrders();
    }, 3600000);

    return () => clearInterval(interval);
  }, [refetchOrders]);

  const orders = ordersData?.items || [];

  // Fetch due days statistics for tab badge
  const { data: dueDaysStats } = useGetDueDaysStatisticsQuery();

  // Fetch items with assignments for expanded orders
  const expandedOrderIds = Array.from(expandedOrders);

  // Create individual queries for each expanded order
  const itemsWithAssignmentsQueries = expandedOrderIds.map(orderId =>
    useGetOrderItemsWithAssignmentsQuery(orderId, {
      skip: !expandedOrders.has(orderId),
    })
  );

  // Create a map of order_id -> items with assignments data
  const itemsWithAssignmentsMap: Record<string, any> = {};
  expandedOrderIds.forEach((orderId, index) => {
    const data = itemsWithAssignmentsQueries[index]?.data;
    if (data) {
      itemsWithAssignmentsMap[orderId] = data;
    }
  });

  const getStatusConfig = (status: string) => {
    const configs = {
      draft: { variant: "default" as const, label: "Draft", color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
      submitted: { variant: "default" as const, label: "Pending Approval", color: "text-yellow-600", bgColor: "bg-yellow-50", borderColor: "border-yellow-200" },
      finance_approved: { variant: "info" as const, label: "Finance Approved", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
      finance_rejected: { variant: "destructive" as const, label: "Finance Rejected", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
      logistics_approved: { variant: "success" as const, label: "Approved", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200" },
      logistics_rejected: { variant: "destructive" as const, label: "Logistics Rejected", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
      assigned: { variant: "info" as const, label: "Assigned", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
      picked_up: { variant: "info" as const, label: "Picked Up", color: "text-indigo-600", bgColor: "bg-indigo-50", borderColor: "border-indigo-200" },
      in_transit: { variant: "info" as const, label: "In Transit", color: "text-purple-600", bgColor: "bg-purple-50", borderColor: "border-purple-200" },
      partial_in_transit: { variant: "warning" as const, label: "Partial Transit", color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
      partial_delivered: { variant: "warning" as const, label: "Partial Delivered", color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
      delivered: { variant: "success" as const, label: "Delivered", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200" },
      cancelled: { variant: "destructive" as const, label: "Cancelled", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
    };
    return configs[status as keyof typeof configs] || configs.draft;
  };

  const formatCreatedByRole = (role: string) => {
    const roleMap: Record<string, string> = {
      admin: "Admin",
      branch_manager: "Branch Manager",
      marketing_person: "Marketing Person",
    };
    return roleMap[role] || role;
  };

  const handleCreateOrder = () => {
    setEditingOrder(undefined);
    setIsCreateModalOpen(true);
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setEditingOrder(undefined);
  };

  const handleCreateOrderSuccess = () => {
    refetchOrders();
    if (editingOrder) {
      toast.success("Order updated successfully!");
    } else {
      toast.success("Order created successfully!");
    }
    setEditingOrder(undefined);
  };

  const orderStats = {
    total: orders.length,
    draft: orders.filter((o) => o.status === "draft").length,
    submitted: orders.filter((o) => o.status === "submitted").length,
    finance_approved: orders.filter((o) => o.status === "finance_approved").length,
    finance_rejected: orders.filter((o) => o.status === "finance_rejected").length,
    logistics_approved: orders.filter((o) => o.status === "logistics_approved").length,
    logistics_rejected: orders.filter((o) => o.status === "logistics_rejected").length,
    assigned: orders.filter((o) => o.status === "assigned").length,
    in_transit: orders.filter((o) => o.status === "in_transit").length,
    partial_in_transit: orders.filter((o) => o.status === "partial_in_transit").length,
    partial_delivered: orders.filter((o) => o.status === "partial_delivered").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
  };

  // Filter orders based on status filter
  const filteredOrders = statusFilter
    ? orders.filter((o) => o.status === statusFilter)
    : orders;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Marketing Person Orders
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Create and manage customer orders
              </p>
            </div>
            <Button
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 px-6 py-3 rounded-xl font-semibold"
              onClick={handleCreateOrder}
            >
              <Plus className="w-5 h-5" />
              <span>Create Order</span>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="orders" className="text-black">
              Orders ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="due-days" className="text-black">
              Due Days ({dueDaysStats?.total_due_count || 0})
            </TabsTrigger>
          </TabsList>

          {/* Orders Tab */}
          <TabsContent value="orders">

        {/* Search and Filter Bar */}
        <Card className="mb-8 border-0 shadow-lg bg-white">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search orders by customer, ID, or status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 text-gray-900 placeholder-gray-400 border-2 border-gray-200 rounded-xl outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
              </div>
              {/* Status Filter Dropdown */}
              <div className="md:w-64">
                <Select
                  value={statusFilter || ""}
                  onChange={(e) => setStatusFilter(e.target.value || null)}
                  className="w-full h-full"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft ({orderStats.draft})</option>
                  <option value="submitted">Submitted ({orderStats.submitted})</option>
                  <option value="finance_approved">Finance Approved ({orderStats.finance_approved})</option>
                  <option value="finance_rejected">Finance Rejected ({orderStats.finance_rejected})</option>
                  <option value="logistics_approved">Logistics Approved ({orderStats.logistics_approved})</option>
                  <option value="logistics_rejected">Logistics Rejected ({orderStats.logistics_rejected})</option>
                  <option value="assigned">Assigned ({orderStats.assigned})</option>
                  <option value="in_transit">In Transit ({orderStats.in_transit})</option>
                  <option value="partial_in_transit">Partial In Transit ({orderStats.partial_in_transit})</option>
                  <option value="partial_delivered">Partial Delivered ({orderStats.partial_delivered})</option>
                  <option value="delivered">Delivered ({orderStats.delivered})</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List - Simplified version showing key elements */}
        <div className="space-y-6">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const itemsWithAssignments = itemsWithAssignmentsMap[order.id]?.items || order.items;

              return (
                <Card key={order.id} className="border-0 shadow-xl bg-white rounded-2xl overflow-hidden relative">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                      {/* Left Side - Customer Details */}
                      <div className="lg:col-span-4 bg-gray-50 p-6 border-r border-gray-200">
                        {/* Order Header */}
                        <div className="mb-6 pr-8">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {order.order_number}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={statusConfig.variant}
                              className={`${statusConfig.bgColor} ${statusConfig.color} border ${statusConfig.borderColor} font-semibold px-3 py-1`}
                            >
                              {statusConfig.label}
                            </Badge>
                            {order.created_by_role && (
                              <Badge
                                variant="outline"
                                className="bg-indigo-50 text-indigo-700 border-indigo-200 font-medium px-2 py-1 text-xs"
                              >
                                Created by: {formatCreatedByRole(order.created_by_role)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Customer Information */}
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                              <User className="w-4 h-4" />
                              <span>Customer</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900">{order.customer?.name || "N/A"}</p>
                          </div>

                          {order.customer?.phone && (
                            <div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <Phone className="w-4 h-4" />
                                <span>Mobile</span>
                              </div>
                              <p className="text-sm font-bold text-gray-900">{order.customer.phone}</p>
                            </div>
                          )}

                          {order.branch && (
                            <div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <Building2 className="w-4 h-4" />
                                <span>Branch</span>
                              </div>
                              <p className="text-sm font-bold text-gray-900">{order.branch.name}</p>
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                              <Weight className="w-4 h-4" />
                              <span>Total Weight</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900">
                              {order.items && order.items.length > 0
                                ? order.items.reduce((sum, item) => {
                                  const itemWeight = (item as any).total_weight !== undefined
                                    ? (item as any).total_weight
                                    : (item.weight || 0) * ((item as any).original_quantity || item.quantity);
                                  return sum + itemWeight;
                                }, 0).toFixed(2) + ' kg'
                                : '0.00 kg'}
                            </p>
                          </div>
                        </div>

                        {/* Note: Marketing Person cannot send orders for approval */}
                      </div>

                      {/* Right Side - Order Items */}
                      <div className="lg:col-span-8 p-6">
                        <div className="mb-6">
                          <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            Order Items ({order.items_count || order.items?.length || 0})
                          </h4>
                        </div>

                        {/* Order Items Table */}
                        {(itemsWithAssignments && itemsWithAssignments.length > 0) || (order.items && order.items.length > 0) ? (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600">#</th>
                                  <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600">Product</th>
                                  <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Quantity</th>
                                  <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Wt/Unit</th>
                                  <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Total Wt</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(itemsWithAssignments || order.items).slice(0, 5).map((item: any, index: number) => {
                                  const totalQty = item.original_quantity !== undefined ? item.original_quantity : item.quantity;
                                  const totalItemWeight = (item as any).total_weight !== undefined
                                    ? (item as any).total_weight
                                    : (item.weight || 0) * totalQty;
                                  const weightPerUnit = totalQty > 0 ? totalItemWeight / totalQty : 0;

                                  return (
                                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                                      <td className="py-4 px-2 text-sm text-gray-900">{index + 1}</td>
                                      <td className="py-4 px-2">
                                        <p className="text-sm font-semibold text-gray-900">{item.product_name}</p>
                                        {item.product_code && (
                                          <p className="text-xs text-gray-500">{item.product_code}</p>
                                        )}
                                      </td>
                                      <td className="py-4 px-2 text-center text-sm font-semibold text-gray-900">
                                        {totalQty}
                                      </td>
                                      <td className="py-4 px-2 text-center text-sm text-gray-900">
                                        {weightPerUnit > 0 ? weightPerUnit.toFixed(2) : '0.00'}
                                      </td>
                                      <td className="py-4 px-2 text-center text-sm text-gray-900">
                                        {totalItemWeight > 0 ? totalItemWeight.toFixed(2) : '0.00'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            No items found
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  {/* Edit Button for Draft Orders */}
                  {order.status === "draft" ? (
                    <div className="absolute top-4 right-4 z-10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditOrder(order)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2 h-auto font-medium"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : null}
                </Card>
              );
            })
          ) : isLoading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : error ? (
            <Card className="border-0 shadow-xl bg-white rounded-2xl">
              <CardContent className="p-8">
                <EmptyState
                  title="Error loading orders"
                  description="Failed to load orders. Please try again."
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-xl bg-white rounded-2xl">
              <CardContent className="p-8">
                <EmptyState
                  title={statusFilter ? `No ${statusFilter} orders found` : "No orders found"}
                  description={statusFilter ? "Try selecting a different filter" : "Start by creating your first order"}
                  action={statusFilter ? {
                    label: "Clear Filter",
                    onClick: () => setStatusFilter(null),
                  } : {
                    label: "Create New Order",
                    onClick: handleCreateOrder,
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
        </TabsContent>

          {/* Due Days Tab */}
          <TabsContent value="due-days">
            <DueDaysTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Order Modal - Pass userType and marketingPersonId */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={handleCreateOrderSuccess}
        order={editingOrder}
        userType="marketing-person"
        marketingPersonId={user?.id}
      />
    </>
  );
}
