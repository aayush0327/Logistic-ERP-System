"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Calendar,
  RefreshCw,
  Check,
  Package,
  User,
  Phone,
  MapPin,
  Weight,
  CreditCard,
  Building2,
  Search,
} from "lucide-react";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";
import { DateDisplay } from "@/components/DateDisplay";
import { DurationDisplay } from "@/components/DurationDisplay";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code?: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  total_price?: number;
  weight?: number;
  total_weight?: number;
  type?: string;
  weight_type?: string;
}

interface FinanceOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  branch_id: string;
  branch?: {
    name: string;
    code: string;
  };
  status: string;
  total_amount?: number;
  payment_type?: string;
  priority?: string;
  created_at: string;
  updated_at?: string;
  submitted_at?: string;
  approval_status?: "pending" | "approved" | "rejected";
  finance_approved_at?: string;
  finance_approved_by?: string;
  approval_reason?: string;
  items?: OrderItem[];
  items_count?: number;
  location?: string;
  total_units?: number;
  total_weight?: number;
  last_updated?: string;
  // Time in current status fields
  current_status_since?: string;
  time_in_current_status_minutes?: number;
}

export default function FinanceManager() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(`/api/finance/orders?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data.items || []);

        // Debug: Log first order to check time_in_status fields
        if (data.items && data.items.length > 0) {
          console.log('Finance Manager - First order data:', {
            order_number: data.items[0].order_number,
            status: data.items[0].status,
            time_in_current_status_minutes: data.items[0].time_in_current_status_minutes,
            current_status_since: data.items[0].current_status_since,
            created_at: data.items[0].created_at
          });
        }
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Fetch orders on mount and when search query changes
  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Auto-refresh orders every hour (3600000 ms) to update time-in-status
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders();
    }, 3600000); // 1 hour

    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Calculate order stats from fetched orders
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
      delivered: { variant: "success" as const, label: "Delivered", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200" },
      cancelled: { variant: "destructive" as const, label: "Cancelled", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
      approved: { variant: "success" as const, label: "Approved", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200" },
      rejected: { variant: "destructive" as const, label: "Rejected", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
    };
    return configs[status as keyof typeof configs] || configs.draft;
  };

  const handleApprove = async (orderId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/finance/approvals/order/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved: true,
          notes: "Approved by finance team",
        }),
      });

      if (response.ok) {
        fetchOrders();
      }
    } catch (error) {
      console.error("Error approving order:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (orderId: string) => {
    const reason = prompt("Please provide a reason for rejection:");
    if (!reason) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/finance/approvals/order/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved: false,
          reason: reason,
          notes: "Rejected by finance team",
        }),
      });

      if (response.ok) {
        fetchOrders();
      }
    } catch (error) {
      console.error("Error rejecting order:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedOrders.length === 0) return;

    try {
      setLoading(true);
      const response = await fetch("/api/finance/approvals/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: selectedOrders,
          approved: true,
          reason: "Bulk approval by finance team",
        }),
      });

      if (response.ok) {
        setSelectedOrders([]);
        setShowBulkActions(false);
        fetchOrders();
      }
    } catch (error) {
      console.error("Error bulk approving orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
    if (!showBulkActions) setShowBulkActions(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Finance Manager
            </h1>
            <p className="text-gray-600 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Manage order approvals and financial operations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                fetchOrders();
              }}
              className="flex items-center gap-2 bg-white"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <Card className="mb-8 border-0 shadow-lg bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search orders by order ID..."
                value={searchQuery}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setSearchQuery(newValue);
                }}
                className="w-full pl-12 pr-4 py-3 text-gray-900 placeholder-gray-400 border-2 border-gray-200 rounded-xl outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
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

      {/* Bulk Actions */}
      {showBulkActions && selectedOrders.length > 0 && (
        <Card className="mb-6 border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-blue-900">
                  {selectedOrders.length} orders selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedOrders([]);
                    setShowBulkActions(false);
                  }}
                  className="bg-white"
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkApprove}
                  disabled={loading}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4" />
                  Approve Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card className="border-0 shadow-xl bg-white rounded-2xl">
            <CardContent className="p-8">
              <EmptyState
                title={statusFilter ? `No ${statusFilter} orders found` : "No orders found"}
                description={statusFilter ? "Try selecting a different filter" : "No orders require your attention at the moment"}
                action={statusFilter ? {
                  label: "Clear Filter",
                  onClick: () => setStatusFilter(null),
                } : undefined}
              />
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            const showApprovalActions = order.status === "submitted" || order.approval_status === "pending";
            
            return (
              <Card key={order.id} className="border-0 shadow-xl bg-white rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                    {/* Left Side - Customer Details */}
                    <div className="lg:col-span-4 bg-gray-50 p-6 border-r border-gray-200">
                      {/* Order Header */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xl font-bold text-gray-900">
                            {order.order_number}
                          </h3>
                          <input
                            type="checkbox"
                            checked={selectedOrders.includes(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
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

                        {order.payment_type && (
                          <div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                              <CreditCard className="w-4 h-4" />
                              <span>Payment Type</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 uppercase">{order.payment_type}</p>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                            <Package className="w-4 h-4" />
                            <span>Total Units</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{order.items_count || 0}</p>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                            <Weight className="w-4 h-4" />
                            <span>Total Weight</span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">
                            {order.items && order.items.length > 0
                              ? order.items.reduce((sum, item) => sum + ((item.weight || 0) * item.quantity), 0).toFixed(2) + ' kg'
                              : '0.00 kg'}
                          </p>
                        </div>
                      </div>

                      {/* Approval Actions */}
                      {showApprovalActions && (
                        <div className="mt-6 space-y-3">
                          <Button
                            onClick={() => handleApprove(order.id)}
                            disabled={loading}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl shadow-lg"
                          >
                            <CheckCircle className="w-5 h-5 mr-2" />
                            Approve Order
                          </Button>
                          <Button
                            onClick={() => handleReject(order.id)}
                            disabled={loading}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl shadow-lg"
                          >
                            <XCircle className="w-5 h-5 mr-2" />
                            Reject Order
                          </Button>
                        </div>
                      )}

                      {/* Approval Status Display */}
                      {order.approval_status === "approved" && (
                        <div className="mt-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <p className="font-bold text-green-900 text-sm">Order Approved</p>
                          </div>
                          <p className="text-xs text-green-700">
                            {order.finance_approved_at && <>Approved on <DateDisplay date={order.finance_approved_at} format="short" /></>}
                          </p>
                          {order.finance_approved_by && (
                            <p className="text-xs text-green-700">By {order.finance_approved_by}</p>
                          )}
                        </div>
                      )}

                      {order.approval_status === "rejected" && (
                        <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <p className="font-bold text-red-900 text-sm">Order Rejected</p>
                          </div>
                          {order.approval_reason && (
                            <p className="text-xs text-red-700 mb-2 font-semibold">
                              Reason: {order.approval_reason}
                            </p>
                          )}
                          <p className="text-xs text-red-700">
                            {order.finance_approved_at && <>Rejected on <DateDisplay date={order.finance_approved_at} format="short" /></>}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right Side - Order Items */}
                    <div className="lg:col-span-8 p-6">
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-bold text-gray-900">
                            Order Items ({order.items_count || 0})
                          </h4>
                        </div>

                        {/* Order Items Table */}
                        {order.items && order.items.length > 0 && (
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
                                  <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Price/Unit</th>
                                  <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Total Price</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((item, index) => {
                                  const weightPerUnit = item.weight || 0;
                                  const totalItemWeight = weightPerUnit * item.quantity;
                                  const weightType = item.weight_type || item.type || 'fixed';
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
                                      <td className="py-4 px-2 text-center text-sm font-semibold text-gray-900">{item.quantity}</td>
                                      <td className="py-4 px-2 text-center text-sm text-gray-900">
                                        {weightPerUnit > 0 ? weightPerUnit.toFixed(2) : '0.00'}
                                      </td>
                                      <td className="py-4 px-2 text-center text-sm text-gray-900">
                                        {totalItemWeight > 0 ? totalItemWeight.toFixed(2) : '0.00'}
                                      </td>
                                      <td className="py-4 px-2 text-center text-sm text-gray-900">
                                        {item.unit_price ? <CurrencyDisplay amount={item.unit_price} /> : 'N/A'}
                                      </td>
                                      <td className="py-4 px-2 text-center text-sm text-gray-900">
                                        {item.total_price ? <CurrencyDisplay amount={item.total_price} /> : item.unit_price ? <CurrencyDisplay amount={item.unit_price * item.quantity} /> : 'N/A'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Overall Totals */}
                        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-bold text-gray-700">Total Amount</h5>
                            <p className="text-xl font-bold text-blue-700">{order.total_amount ? <CurrencyDisplay amount={order.total_amount} /> : 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}