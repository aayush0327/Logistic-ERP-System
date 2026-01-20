"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateOrderModal } from "@/components/Modal";
import { OrderDocumentsViewer } from "@/components/branch";
import { DueDaysTab } from "@/components/orders/DueDaysTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  useGetOrdersQuery,
  useGetOrderItemsWithAssignmentsQuery,
  useSubmitOrderMutation,
  useGetDueDaysStatisticsQuery,
  Order,
  OrderItemAssignment,
} from "@/services/api/ordersApi";
import {
  Plus,
  Search,
  Package,
  Send,
  User,
  MapPin,
  Phone,
  Calendar,
  Weight,
  DollarSign,
  Clock,
  TrendingUp,
  Box,
  Building2,
  Hash,
  FileText,
  Truck,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Edit
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";
import { DateDisplay } from "@/components/DateDisplay";
import { DurationDisplay } from "@/components/DurationDisplay";

export default function Orders() {
  const [activeTab, setActiveTab] = useState("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>(undefined);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

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

  // Auto-refresh orders every hour (3600000 ms) to update time-in-status
  useEffect(() => {
    const interval = setInterval(() => {
      refetchOrders();
    }, 3600000); // 1 hour

    return () => clearInterval(interval);
  }, [refetchOrders]);

  const orders = ordersData?.items || [];

  // Fetch due days statistics for tab badge
  const { data: dueDaysStats } = useGetDueDaysStatisticsQuery();

  // Debug: Log first order to check time_in_status fields
  if (orders.length > 0 && orders[0]) {
    console.log('First order data:', {
      order_number: orders[0].order_number,
      status: orders[0].status,
      time_in_current_status_minutes: orders[0].time_in_current_status_minutes,
      current_status_since: orders[0].current_status_since,
      created_at: orders[0].created_at
    });
  }

  // Submit order mutation
  const [submitOrder, { isLoading: isSubmitting }] = useSubmitOrderMutation();

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

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

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

  const getAssignmentStatusConfig = (status: string) => {
    const configs = {
      pending_to_assign: { variant: "default" as const, label: "Pending", color: "text-gray-600", bgColor: "bg-gray-100" },
      planning: { variant: "info" as const, label: "Planning", color: "text-blue-600", bgColor: "bg-blue-50" },
      loading: { variant: "warning" as const, label: "Loading", color: "text-orange-600", bgColor: "bg-orange-50" },
      on_route: { variant: "info" as const, label: "On Route", color: "text-purple-600", bgColor: "bg-purple-50" },
      delivered: { variant: "success" as const, label: "Delivered", color: "text-green-600", bgColor: "bg-green-50" },
      failed: { variant: "destructive" as const, label: "Failed", color: "text-red-600", bgColor: "bg-red-50" },
      returned: { variant: "default" as const, label: "Returned", color: "text-gray-600", bgColor: "bg-gray-100" },
    };
    return configs[status as keyof typeof configs] || configs.pending_to_assign;
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

  const handleSubmitOrder = async (orderId: string) => {
    try {
      await submitOrder(orderId).unwrap();
      toast.success("Order sent for approval successfully!");
      refetchOrders();
    } catch (error: any) {
      toast.error(error.message || "Failed to send order for approval");
    }
  };

  const orderStats = {
    total: orders.length,
    draft: orders.filter((o) => o.status === "draft").length,
    submitted: orders.filter((o) => o.status === "submitted").length,
    approved: orders.filter(
      (o) => o.status === "finance_approved" || o.status === "logistics_approved"
    ).length,
  };

  // Filter orders based on status filter
  const filteredOrders = statusFilter
    ? orders.filter((o) => {
      if (statusFilter === "approved") {
        return o.status === "finance_approved" || o.status === "logistics_approved";
      }
      return o.status === statusFilter;
    })
    : orders;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-6 lg:p-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Orders Management
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Track and manage all customer orders
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

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card
            className={`bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer ${statusFilter === null ? 'ring-4 ring-blue-500' : ''
              }`}
            onClick={() => setStatusFilter(null)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Box className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-1">
                {orderStats.total}
              </p>
              <p className="text-sm text-gray-600 font-medium">Total Orders</p>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-gray-50 to-slate-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer ${statusFilter === 'draft' ? 'ring-4 ring-gray-500' : ''
              }`}
            onClick={() => setStatusFilter(statusFilter === 'draft' ? null : 'draft')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-3xl font-bold text-gray-700 mb-1">
                {orderStats.draft}
              </p>
              <p className="text-sm text-gray-700 font-medium">Draft</p>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-yellow-50 to-orange-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer ${statusFilter === 'submitted' ? 'ring-4 ring-yellow-500' : ''
              }`}
            onClick={() => setStatusFilter(statusFilter === 'submitted' ? null : 'submitted')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
              <p className="text-3xl font-bold text-yellow-700 mb-1">
                {orderStats.submitted}
              </p>
              <p className="text-sm text-yellow-700 font-medium">Submitted</p>
            </CardContent>
          </Card>

          <Card
            className={`bg-gradient-to-br from-green-50 to-emerald-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer ${statusFilter === 'approved' ? 'ring-4 ring-green-500' : ''
              }`}
            onClick={() => setStatusFilter(statusFilter === 'approved' ? null : 'approved')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-700 mb-1">
                {orderStats.approved}
              </p>
              <p className="text-sm text-green-700 font-medium">Approved</p>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <Card className="mb-8 border-0 shadow-lg bg-white">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search orders by customer, ID, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 text-gray-900 placeholder-gray-400 border-2 border-gray-200 rounded-xl outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <div className="space-y-6">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const isExpanded = expandedOrders.has(order.id);
              const itemsData = itemsWithAssignmentsMap[order.id];
              const summary = itemsData?.summary;
              const itemsWithAssignments = itemsData?.items || order.items;

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
                          <Badge
                            variant={statusConfig.variant}
                            className={`${statusConfig.bgColor} ${statusConfig.color} border ${statusConfig.borderColor} font-semibold px-3 py-1`}
                          >
                            {statusConfig.label}
                          </Badge>

                          {/* Time in current status */}
                          {(order.time_in_current_status_minutes !== undefined && order.time_in_current_status_minutes !== null) && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-gray-600">
                              <Clock className="w-3 h-3" />
                              <span>
                                For <DurationDisplay minutes={order.time_in_current_status_minutes || 0} />
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Date and Time */}
                        <div className="mb-6 pb-6 border-b border-gray-200">
                          <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span><DateDisplay date={order.created_at} format="short" /></span>
                          </div>
                          {order.updated_at && order.updated_at !== order.created_at && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span>Last updated: <DateDisplay date={order.updated_at} format="short" /></span>
                            </div>
                          )}
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

                          {order.customer?.address && (
                            <div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <MapPin className="w-4 h-4" />
                                <span>Location</span>
                              </div>
                              <p className="text-sm font-bold text-gray-900">{order.customer.address}</p>
                            </div>
                          )}

                          {order.branch && (
                            <div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <Building2 className="w-4 h-4" />
                                <span>Branch</span>
                              </div>
                              <p className="text-sm font-bold text-gray-900">{order.branch.name}</p>
                              <p className="text-xs text-gray-600">{order.branch.code}</p>
                            </div>
                          )}

                          {/* Assignment Summary */}
                          {summary && (
                            <>
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                                  <Package className="w-4 h-4" />
                                  <span>Assignment Summary</span>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">Total:</span>
                                    <span className="text-sm font-bold text-gray-900">{summary.total_original_quantity}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">Assigned:</span>
                                    <span className="text-sm font-bold text-green-700">{summary.total_assigned_quantity}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">Remaining:</span>
                                    <span className="text-sm font-bold text-orange-700">{summary.total_remaining_quantity}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Items Status Summary */}
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                                  <TrendingUp className="w-4 h-4" />
                                  <span>Items Status</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-blue-50 rounded-lg p-2">
                                    <p className="text-lg font-bold text-blue-700">{itemsData?.items_status_summary?.planning || 0}</p>
                                    <p className="text-xs text-blue-600">Planning</p>
                                  </div>
                                  <div className="bg-orange-50 rounded-lg p-2">
                                    <p className="text-lg font-bold text-orange-700">{itemsData?.items_status_summary?.loading || 0}</p>
                                    <p className="text-xs text-orange-600">Loading</p>
                                  </div>
                                  <div className="bg-purple-50 rounded-lg p-2">
                                    <p className="text-lg font-bold text-purple-700">{itemsData?.items_status_summary?.on_route || 0}</p>
                                    <p className="text-xs text-purple-600">On Route</p>
                                  </div>
                                  <div className="bg-green-50 rounded-lg p-2">
                                    <p className="text-lg font-bold text-green-700">{itemsData?.items_status_summary?.delivered || 0}</p>
                                    <p className="text-xs text-green-600">Delivered</p>
                                  </div>
                                </div>
                              </div>

                              {/* TMS Status Badge */}
                              {itemsData?.tms_order_status && (
                                <div className="mt-3">
                                  <Badge
                                    variant={itemsData.tms_order_status === 'available' ? 'success' : itemsData.tms_order_status === 'partial' ? 'warning' : 'default'}
                                    className={`${itemsData.tms_order_status === 'available' ? 'bg-green-50 text-green-700 border-green-200' :
                                        itemsData.tms_order_status === 'partial' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                          'bg-blue-50 text-blue-700 border-blue-200'
                                      } text-xs font-semibold px-2 py-1`}
                                  >
                                    {itemsData.tms_order_status === 'available' ? 'Available' : itemsData.tms_order_status === 'partial' ? 'Partially Assigned' : 'Fully Assigned'}
                                  </Badge>
                                </div>
                              )}
                            </>
                          )}

                          <div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                              <Weight className="w-4 h-4" />
                              <span>Total Weight</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900">
                              {order.items && order.items.length > 0
                                ? order.items.reduce((sum, item) => {
                                  // Use total_weight if available (already calculated based on original quantity)
                                  // If total_weight is not available, calculate using original_quantity or quantity
                                  const itemWeight = (item as any).total_weight !== undefined
                                    ? (item as any).total_weight
                                    : (item.weight || 0) * ((item as any).original_quantity || item.quantity);
                                  return sum + itemWeight;
                                }, 0).toFixed(2) + ' kg'
                                : '0.00 kg'}
                            </p>
                          </div>
                        </div>

                        {/* Assign to Trip Button */}
                        {/* {order.status === "submitted" && (
                          <Button
                            className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                          >
                            <Package className="w-4 h-4 mr-2" />
                            Assign to Trip
                          </Button>
                        )} */}

                        {/* Send for Approval Button */}
                        {order.status === "draft" && (
                          <Button
                            onClick={() => handleSubmitOrder(order.id)}
                            disabled={isSubmitting}
                            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Send for Approval
                          </Button>
                        )}
                      </div>

                      {/* Right Side - Order Items with Assignments */}
                      <div className="lg:col-span-8 p-6">
                        <div className="mb-6">
                          <div
                            className="flex items-center justify-between mb-4"
                          // onClick={() => toggleOrderExpansion(order.id)}
                          >
                            <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                              Order Items ({order.items_count})
                              {summary && (
                                <span className="text-sm font-normal text-gray-500">
                                  ({summary.total_assigned_quantity} assigned, {summary.total_remaining_quantity} remaining)
                                </span>
                              )}
                            </h4>
                            {/* {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-500" />
                            )} */}
                          </div>  

                          {/* Order Items Table with Assignments */}
                          {(itemsWithAssignments && itemsWithAssignments.length > 0) || (order.items && order.items.length > 0) ? (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600">#</th>
                                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600">Product</th>
                                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Type</th>
                                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Quantity</th>
                                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Wt/Unit</th>
                                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Total Wt</th>
                                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Remaining Qty</th>
                                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">planning</th>
                                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">loading</th>
                                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">on_route</th>
                                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">delivered</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(itemsWithAssignments || order.items).map((item: any, index: number) => {
                                    const weightType = item.weight_type || 'fixed';
                                    // Use total_weight if available (already calculated by API based on original quantity), otherwise calculate
                                    const totalQty = item.original_quantity !== undefined ? item.original_quantity : item.quantity;
                                    const totalItemWeight = (item as any).total_weight !== undefined
                                      ? (item as any).total_weight
                                      : (item.weight || 0) * totalQty;
                                    const weightPerUnit = totalQty > 0 ? totalItemWeight / totalQty : 0;
                                    // Use assignment data if available, otherwise fall back to basic item data
                                    const assignedQty = item.assigned_quantity !== undefined ? item.assigned_quantity : 0;
                                    const remainingQty = item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity;
                                    const displayQty = totalQty; // Show total quantity (original quantity)

                                    // Group assignments by status and sum quantities
                                    const statusQuantities: Record<string, number> = {
                                      planning: 0,
                                      loading: 0,
                                      on_route: 0,
                                      delivered: 0,
                                      pending_to_assign: 0,
                                      failed: 0,
                                      returned: 0,
                                    };

                                    if (item.assignments && item.assignments.length > 0) {
                                      item.assignments.forEach((assignment: OrderItemAssignment) => {
                                        const status = assignment.item_status;
                                        if (status in statusQuantities) {
                                          statusQuantities[status] += assignment.assigned_quantity;
                                        }
                                      });
                                    }

                                    // Calculate remaining quantity
                                    const totalAssignedQty = statusQuantities.planning + statusQuantities.loading + statusQuantities.on_route + statusQuantities.delivered;
                                    const remainingQuantity = displayQty - totalAssignedQty;

                                    return (
                                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-4 px-2 text-sm text-gray-900">{index + 1}</td>
                                        <td className="py-4 px-2">
                                          <p className="text-sm font-semibold text-gray-900">{item.product_name}</p>
                                          {item.product_code && (
                                            <p className="text-xs text-gray-500">{item.product_code}</p>
                                          )}
                                        </td>
                                        <td className="py-4 px-2 text-center">
                                          <Badge
                                            variant={weightType === 'variable' ? 'warning' : 'default'}
                                            className={`${weightType === 'variable' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-700 border-gray-200'} text-xs font-semibold px-2 py-1`}
                                          >
                                            {weightType === 'variable' ? 'Var' : 'Fixed'}
                                          </Badge>
                                        </td>
                                        <td className="py-4 px-2 text-center text-sm font-semibold text-gray-900">
                                          {displayQty}
                                        </td>
                                        <td className="py-4 px-2 text-center text-sm text-gray-900">
                                          {weightPerUnit > 0 ? weightPerUnit.toFixed(2) : '0.00'}
                                        </td>
                                        <td className="py-4 px-2 text-center text-sm text-gray-900">
                                          {totalItemWeight > 0 ? totalItemWeight.toFixed(2) : '0.00'}
                                        </td>
                                        <td className="py-4 px-2 text-center text-sm font-semibold text-orange-600">
                                          {remainingQuantity}
                                        </td>
                                        <td className="py-4 px-2 text-center text-sm font-semibold text-gray-900">
                                          {statusQuantities.planning || 0}
                                        </td>
                                        <td className="py-4 px-2 text-center text-sm font-semibold text-blue-600">
                                          {statusQuantities.loading || 0}
                                        </td>
                                        <td className="py-4 px-2 text-center text-sm font-semibold text-purple-600">
                                          {statusQuantities.on_route || 0}
                                        </td>
                                        <td className="py-4 px-2 text-center text-sm font-semibold text-green-600">
                                          {statusQuantities.delivered || 0}
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

                          {/* Status Summary Footer - Always shown */}
                          {(() => {
                            // Calculate summary from items directly
                            const itemsList = itemsWithAssignments || order.items || [];
                            let totalOriginalQty = 0;
                            let totalPlanning = 0;
                            let totalLoading = 0;
                            let totalOnRoute = 0;
                            let totalDelivered = 0;

                            itemsList.forEach((item: any) => {
                              const qty = item.original_quantity !== undefined ? item.original_quantity : item.quantity;
                              totalOriginalQty += qty;

                              const statusQuantities: Record<string, number> = {
                                planning: 0,
                                loading: 0,
                                on_route: 0,
                                delivered: 0,
                                pending_to_assign: 0,
                                failed: 0,
                                returned: 0,
                              };

                              if (item.assignments && item.assignments.length > 0) {
                                item.assignments.forEach((assignment: OrderItemAssignment) => {
                                  const status = assignment.item_status;
                                  if (status in statusQuantities) {
                                    statusQuantities[status] += assignment.assigned_quantity;
                                  }
                                });
                              }

                              totalPlanning += statusQuantities.planning;
                              totalLoading += statusQuantities.loading;
                              totalOnRoute += statusQuantities.on_route;
                              totalDelivered += statusQuantities.delivered;
                            });

                            return (
                              <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                                <h5 className="text-sm font-bold text-gray-700 mb-3">Order Items Status Summary</h5>
                                <div className="grid grid-cols-6 gap-3">
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs text-gray-600 mb-1">Total Items</p>
                                    <p className="text-lg font-bold text-gray-900">{totalOriginalQty}</p>
                                  </div>
                                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                                    <p className="text-xs text-red-600 mb-1">Remaining</p>
                                    <p className="text-lg font-bold text-red-700">{totalOriginalQty - totalPlanning - totalLoading - totalOnRoute - totalDelivered}</p>
                                  </div>
                                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                    <p className="text-xs text-blue-600 mb-1">Planning</p>
                                    <p className="text-lg font-bold text-blue-700">{totalPlanning}</p>
                                  </div>
                                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                                    <p className="text-xs text-orange-600 mb-1">Loading</p>
                                    <p className="text-lg font-bold text-orange-700">{totalLoading}</p>
                                  </div>
                                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                    <p className="text-xs text-purple-600 mb-1">On Route</p>
                                    <p className="text-lg font-bold text-purple-700">{totalOnRoute}</p>
                                  </div>
                                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                    <p className="text-xs text-green-600 mb-1">Delivered</p>
                                    <p className="text-lg font-bold text-green-700">{totalDelivered}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Delivery Documents Section */}
                          {(order.status === 'delivered' || order.status === 'partial_delivered') && (
                            <div className="mt-4">
                              <OrderDocumentsViewer orderId={order.order_number} />
                            </div>
                          )}
                        </div>

                        {/* Notes Section */}
                        {/* <div className="mt-6">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <span>💬</span>
                              Notes
                            </h5>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                            >
                              + Add Note
                            </Button>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <textarea
                              placeholder="Enter your note here..."
                              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={4}
                            />
                            <div className="flex items-center justify-between mt-3">
                              <p className="text-xs text-gray-500">0 / 5000 characters</p>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-sm"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
                                >
                                  Add Note
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div> */}
                      </div>
                    </div>
                  </CardContent>
                  {/* Edit Button for Draft Orders - Absolutely positioned in top-right */}
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
                  ) : (
                    <div className="absolute top-4 right-4 z-10">
                      {/* <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-2 h-auto"
                      >
                        <span className="text-lg leading-none">⋮</span>
                      </Button> */}
                    </div>
                  )}
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

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onSuccess={handleCreateOrderSuccess}
        order={editingOrder}
      />
    </>
  );
}
