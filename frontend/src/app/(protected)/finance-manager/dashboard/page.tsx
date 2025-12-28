"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AppLayout } from "@/components/layout/AppLayout";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Search,
  Filter,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Users,
  Calendar,
  Download,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Eye,
  Check,
  X,
  FileText,
  X as XIcon,
  Package,
} from "lucide-react";

// Define types for order items
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
  volume?: number;
}

// Define types for finance data
interface FinanceOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer?: {
    name: string;
    phone?: string;
    email?: string;
  };
  branch_id: string;
  status: string;
  total_amount?: number;
  payment_type?: string;
  priority?: string;
  created_at: string;
  submitted_at?: string;
  approval_status?: "pending" | "approved" | "rejected";
  finance_approved_at?: string;
  finance_approved_by?: string;
  approval_action_id?: string;
  approval_reason?: string;
  items?: OrderItem[];
  items_count?: number;
}

interface DashboardStats {
  total_pending_orders: number;
  total_pending_amount: number;
  approved_orders: number;
  approved_amount: number;
  rejected_orders: number;
  rejected_amount: number;
  approval_rate: number;
}

export default function FinanceManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPaymentType, setSelectedPaymentType] = useState("all");
  const [dateRange, setDateRange] = useState("7days"); // 7days, 30days, 90days
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "cards">("cards");
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<FinanceOrder | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  // Mock data for demonstration - replace with actual API calls
  useEffect(() => {
    fetchOrders();
    fetchDashboardStats();
  }, [searchQuery, selectedStatus, currentPage, dateRange]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Replace with actual API call to finance service
      const response = await fetch("/api/finance/orders", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data.items || []);
      } else {
        throw new Error("Failed to fetch orders");
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      // Use mock data for now
      setOrders(getMockOrders());
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      // Replace with actual API call to finance service
      const response = await fetch("/api/finance/reports/dashboard/summary", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.summary);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      // Use mock data for now
      setStats(getMockStats());
    }
  };

  const fetchOrderDetails = async (orderId: string) => {
    setLoadingOrderDetails(true);
    try {
      const response = await fetch(`/api/finance/orders/${orderId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedOrder(data);
        setShowOrderDetails(true);
      } else {
        throw new Error("Failed to fetch order details");
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
      toast.error("Failed to load order details");
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const getMockOrders = (): FinanceOrder[] => [
    {
      id: "1",
      order_number: "ORD-20251221-001",
      customer_id: "CUST001",
      customer: { name: "ABC Corporation", phone: "+1234567890" },
      branch_id: "BRANCH001",
      status: "submitted",
      total_amount: 15000.0,
      payment_type: "credit",
      priority: "high",
      created_at: "2025-12-21T10:00:00Z",
      submitted_at: "2025-12-21T11:00:00Z",
      approval_status: "pending",
    },
    {
      id: "2",
      order_number: "ORD-20251221-002",
      customer_id: "CUST002",
      customer: { name: "XYZ Logistics", phone: "+0987654321" },
      branch_id: "BRANCH002",
      status: "submitted",
      total_amount: 8500.5,
      payment_type: "cod",
      priority: "normal",
      created_at: "2025-12-21T09:30:00Z",
      submitted_at: "2025-12-21T10:30:00Z",
      approval_status: "approved",
      finance_approved_at: "2025-12-21T14:00:00Z",
      finance_approved_by: "finance_user_1",
    },
    {
      id: "3",
      order_number: "ORD-20251221-003",
      customer_id: "CUST003",
      customer: { name: "Global Traders", phone: "+1122334455" },
      branch_id: "BRANCH001",
      status: "submitted",
      total_amount: 25000.0,
      payment_type: "credit",
      priority: "high",
      created_at: "2025-12-21T08:00:00Z",
      submitted_at: "2025-12-21T09:00:00Z",
      approval_status: "rejected",
      finance_approved_at: "2025-12-21T13:00:00Z",
      finance_approved_by: "finance_user_2",
      approval_reason: "Insufficient credit limit",
    },
  ];

  const getMockStats = (): DashboardStats => ({
    total_pending_orders: 15,
    total_pending_amount: 125000.0,
    approved_orders: 45,
    approved_amount: 450000.0,
    rejected_orders: 8,
    rejected_amount: 75000.0,
    approval_rate: 0.85,
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "finance_approved":
      case "approved":
        return "success";
      case "finance_rejected":
      case "rejected":
        return "destructive";
      case "submitted":
        return "warning";
      case "pending":
        return "warning";
      default:
        return "default";
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "finance_approved":
        return "APPROVED";
      case "finance_rejected":
        return "REJECTED";
      case "submitted":
        return "PENDING";
      case "approved":
        return "APPROVED";
      case "rejected":
        return "REJECTED";
      case "pending":
        return "PENDING";
      default:
        return status.toUpperCase();
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high":
        return "text-red-600";
      case "medium":
        return "text-yellow-600";
      case "normal":
      case "low":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-4 h-4" />;
      case "rejected":
        return <XCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const handleApprove = async (orderId: string, reason?: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/finance/approvals/order/${orderId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approved: true,
          reason: reason,
          notes: "Approved by finance team",
        }),
      });

      if (response.ok) {
        toast.success("Order approved successfully");
        fetchOrders();
        fetchDashboardStats();
      } else {
        throw new Error("Failed to approve order");
      }
    } catch (error) {
      console.error("Error approving order:", error);
      toast.error("Failed to approve order");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (orderId: string, reason?: string) => {
    if (!reason) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/finance/approvals/order/${orderId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approved: false,
          reason: reason,
          notes: "Rejected by finance team",
        }),
      });

      if (response.ok) {
        toast.success("Order rejected successfully");
        fetchOrders();
        fetchDashboardStats();
      } else {
        throw new Error("Failed to reject order");
      }
    } catch (error) {
      console.error("Error rejecting order:", error);
      toast.error("Failed to reject order");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedOrders.length === 0) {
      toast.error("Please select orders to approve");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/finance/approvals/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_ids: selectedOrders,
          approved: true,
          reason: "Bulk approval by finance team",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Approved ${data.approved_orders} orders successfully`);
        setSelectedOrders([]);
        setShowBulkActions(false);
        fetchOrders();
        fetchDashboardStats();
      } else {
        throw new Error("Failed to bulk approve orders");
      }
    } catch (error) {
      console.error("Error bulk approving orders:", error);
      toast.error("Failed to bulk approve orders");
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
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      searchQuery === "" ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "pending" && order.status === "submitted") ||
      (selectedStatus === "approved" &&
        (order.status === "finance_approved" || order.status === "approved")) ||
      (selectedStatus === "rejected" &&
        (order.status === "finance_rejected" || order.status === "rejected")) ||
      order.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Finance Manager</h1>
        <p className="text-gray-600 mt-2">
          Manage order approvals and financial operations
        </p>
      </div>

      {/* Dashboard Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Pending Orders
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats.total_pending_orders}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    ₹{stats.total_pending_amount.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Approved Orders
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats.approved_orders}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    ₹{stats.approved_amount.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Rejected Orders
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats.rejected_orders}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    ₹{stats.rejected_amount.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Approval Rate
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {(stats.approval_rate * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search orders by number or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            </div>

            {/* Date Range */}
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
              </select>
              <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  fetchOrders();
                  fetchDashboardStats();
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {showBulkActions && (
        <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-blue-900">
                  {selectedOrders.length} orders selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedOrders([]);
                    setShowBulkActions(false);
                  }}
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkApprove}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Approve Selected
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedOrders([]);
                    setShowBulkActions(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Orders for Approval</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "cards" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("cards")}
              >
                Cards
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                List
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading orders...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-12 h-12" />}
              title="No orders found"
              description={
                searchQuery
                  ? "No orders match your search criteria"
                  : "No orders require your attention at the moment"
              }
            />
          ) : viewMode === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">
                        {order.order_number}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {order.customer?.name}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                      className="mt-1"
                      onClick={() => {
                        if (!showBulkActions) {
                          setShowBulkActions(true);
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Amount</span>
                      <span className="font-semibold text-black">
                        ₹{order.total_amount?.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Priority</span>
                      <span
                        className={`text-sm font-medium ${getPriorityColor(
                          order.priority
                        )}`}
                      >
                        {order.priority?.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Payment</span>
                      <span className="text-sm font-medium">
                        {order.payment_type?.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Status</span>
                      <Badge variant={getStatusVariant(order.status)}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(order.status)}
                          {getStatusDisplay(order.status)}
                        </span>
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Created</span>
                      <span className="text-sm">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {order.status === "submitted" && (
                    <div className="mt-6 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchOrderDetails(order.id)}
                        disabled={loadingOrderDetails}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(order.id)}
                        disabled={loading}
                        className="flex-1"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const reason = prompt(
                            "Please provide reason for rejection:"
                          );
                          if (reason) {
                            handleReject(order.id, reason);
                          }
                        }}
                        disabled={loading}
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {/* Show View Details button for non-submitted orders too */}
                  {order.status !== "submitted" && (
                    <div className="mt-6">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => fetchOrderDetails(order.id)}
                        disabled={loadingOrderDetails}
                        className="w-full"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  )}

                  {order.approval_status === "approved" && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-800">
                        Approved on{" "}
                        {new Date(
                          order.finance_approved_at || ""
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {order.approval_status === "rejected" && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-800">
                        Rejected:{" "}
                        {order.approval_reason || "No reason provided"}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={
                          selectedOrders.length === filteredOrders.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrders(
                              filteredOrders.map((order) => order.id)
                            );
                            setShowBulkActions(true);
                          } else {
                            setSelectedOrders([]);
                          }
                        }}
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Order
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Customer
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Priority
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Payment
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Created
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          onClick={() => {
                            if (!showBulkActions) {
                              setShowBulkActions(true);
                            }
                          }}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {order.order_number}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {order.id}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {order.customer?.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {order.customer?.phone}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-black">
                          ₹{order.total_amount?.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-sm font-medium ${getPriorityColor(
                            order.priority
                          )}`}
                        >
                          {order.priority?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-black">
                          {order.payment_type?.toUpperCase()}W
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusVariant(order.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(order.status)}
                            {getStatusDisplay(order.status)}
                          </span>
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-black">
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchOrderDetails(order.id)}
                            disabled={loadingOrderDetails}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {order.status === "submitted" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(order.id)}
                                disabled={loading}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const reason = prompt(
                                    "Please provide reason for rejection:"
                                  );
                                  if (reason) {
                                    handleReject(order.id, reason);
                                  }
                                }}
                                disabled={loading}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedOrder.order_number}</p>
              </div>
              <button
                onClick={() => {
                  setShowOrderDetails(false);
                  setSelectedOrder(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {loadingOrderDetails ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading order details...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Order Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-black mb-2">Customer Information</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="font-medium text-black">{selectedOrder.customer?.name || "N/A"}</p>
                        <p className="text-sm text-black mt-1">{selectedOrder.customer?.phone || "N/A"}</p>
                        <p className="text-sm text-black">{selectedOrder.customer?.email || "N/A"}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-black mb-2">Order Information</h3>
                      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-black">Status:</span>
                          <Badge variant={getStatusVariant(selectedOrder.status)}>
                            {getStatusDisplay(selectedOrder.status)}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-black">Priority:</span>
                          <span className="text-sm font-medium text-black">
                            {selectedOrder.priority?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-black">Payment Type:</span>
                          <span className="text-sm font-medium text-black">{selectedOrder.payment_type?.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-black">Created:</span>
                          <span className="text-sm text-black">{new Date(selectedOrder.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div>
                    <h3 className="text-lg font-medium text-black mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Order Items ({selectedOrder.items_count || selectedOrder.items?.length || 0})
                    </h3>

                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left py-3 px-4 font-medium text-black">Product</th>
                              <th className="text-left py-3 px-4 font-medium text-black">Code</th>
                              <th className="text-center py-3 px-4 font-medium text-black">Quantity</th>
                              <th className="text-right py-3 px-4 font-medium text-black">Unit Price</th>
                              <th className="text-right py-3 px-4 font-medium text-black">Total Price</th>
                              <th className="text-right py-3 px-4 font-medium text-black">Weight</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedOrder.items.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="py-3 px-4">
                                  <div>
                                    <p className="font-medium text-black">{item.product_name}</p>
                                    {item.description && (
                                      <p className="text-sm text-black mt-1">{item.description}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-sm text-black">{item.product_code || "N/A"}</td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-medium text-black">{item.quantity}</span>
                                  <span className="text-sm text-black ml-1">{item.unit}</span>
                                </td>
                                <td className="py-3 px-4 text-right text-black">
                                  {item.unit_price ? `₹${item.unit_price.toFixed(2)}` : "N/A"}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-black">
                                  {item.total_price ? `₹${item.total_price.toFixed(2)}` : "N/A"}
                                </td>
                                <td className="py-3 px-4 text-right text-sm text-black">
                                  {item.total_weight ? `${item.total_weight.toFixed(2)} kg` : "N/A"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t">
                            <tr>
                              <td colSpan={4} className="py-3 px-4 text-right font-medium text-black">
                                Total Amount:
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-lg text-black">
                                ₹{selectedOrder.total_amount?.toLocaleString() || "0"}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-black">No items found for this order</p>
                      </div>
                    )}
                  </div>

                  {/* Approval Actions for submitted orders */}
                  {selectedOrder.status === "submitted" && (
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        onClick={() => {
                          handleApprove(selectedOrder.id);
                          setShowOrderDetails(false);
                        }}
                        disabled={loading}
                        className="flex-1"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approve Order
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const reason = prompt("Please provide reason for rejection:");
                          if (reason) {
                            handleReject(selectedOrder.id, reason);
                            setShowOrderDetails(false);
                          }
                        }}
                        disabled={loading}
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject Order
                      </Button>
                    </div>
                  )}

                  {/* Approval Status */}
                  {selectedOrder.approval_status === "approved" && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-800">
                        <strong>Approved</strong> on {new Date(selectedOrder.finance_approved_at || "").toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {selectedOrder.approval_status === "rejected" && (
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm text-red-800">
                        <strong>Rejected:</strong> {selectedOrder.approval_reason || "No reason provided"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
