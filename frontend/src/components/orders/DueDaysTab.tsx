"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DateDisplay } from "@/components/DateDisplay";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";
import {
  useGetDueDaysOrdersQuery,
  useGetDueDaysStatisticsQuery,
  useMarkOrdersAsCreatedMutation,
  DueDaysData,
} from "@/services/api/ordersApi";
import {
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle,
  Filter,
  Package,
  User,
} from "lucide-react";
import { toast } from "react-hot-toast";

export function DueDaysTab() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "due_soon" | "overdue">("all");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Fetch due days statistics
  const { data: statistics } = useGetDueDaysStatisticsQuery();

  // Fetch due days orders
  const {
    data: dueDaysData,
    isLoading,
    refetch,
  } = useGetDueDaysOrdersQuery({
    days_threshold: 3,
    filter_date: selectedDate ? selectedDate.toISOString() : undefined,
    status_filter: statusFilter === "all" ? undefined : statusFilter,
  });

  // Mark as created mutation
  const [markAsCreated, { isLoading: isMarking }] = useMarkOrdersAsCreatedMutation();

  const orders = dueDaysData?.orders || [];
  const overdueCount = dueDaysData?.overdue_count || 0;
  const dueSoonCount = dueDaysData?.due_soon_count || 0;

  // Clear selected orders when data changes
  useEffect(() => {
    setSelectedOrders(new Set());
  }, [dueDaysData]);

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map((o) => o.id)));
    }
  };

  const handleMarkAsCreated = async () => {
    if (selectedOrders.size === 0) {
      toast.error("Please select at least one order");
      return;
    }

    try {
      await markAsCreated({ order_ids: Array.from(selectedOrders) }).unwrap();
      toast.success(`Marked ${selectedOrders.size} orders as created`);
      setSelectedOrders(new Set());
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to mark orders as created");
    }
  };

  const getDaysRemainingBadge = (daysRemaining: number) => {
    if (daysRemaining < 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 bg-red-600 text-white">
          <AlertTriangle className="w-3 h-3" />
          Overdue by {Math.abs(daysRemaining)} days
        </Badge>
      );
    }
    if (daysRemaining === 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 bg-red-600 text-white">
          <AlertTriangle className="w-3 h-3" />
          Due Today
        </Badge>
      );
    }
    if (daysRemaining === 1) {
      return (
        <Badge variant="warning" className="flex items-center gap-1 bg-yellow-500 text-white">
          <Clock className="w-3 h-3" />
          Due Tomorrow
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="flex items-center gap-1 bg-blue-500 text-white">
        <Clock className="w-3 h-3" />
        {daysRemaining} days remaining
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Overdue Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{overdueCount}</div>
            <p className="text-xs text-gray-600 mt-1 font-medium">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              Due Soon (Within 3 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{dueSoonCount}</div>
            <p className="text-xs text-gray-600 mt-1 font-medium">Action recommended</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Total Due Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{overdueCount + dueSoonCount}</div>
            <p className="text-xs text-gray-600 mt-1 font-medium">All pending orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900 font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
            {selectedOrders.size > 0 && (
              <Button
                onClick={handleMarkAsCreated}
                disabled={isMarking}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Selected as Created ({selectedOrders.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Date Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Filter by Date
              </label>
              <input
                type="date"
                value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
            </div>

            {/* Status Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="all">All Orders</option>
                <option value="due_soon">Due Soon</option>
                <option value="overdue">Overdue Only</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedDate(null);
                  setStatusFilter("all");
                }}
                className="text-gray-900 border-gray-300 hover:bg-gray-50"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900 font-semibold">
              Due Orders ({orders.length})
            </CardTitle>
            {orders.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleSelectAll} className="text-gray-900 border-gray-300 hover:bg-gray-50">
                {selectedOrders.size === orders.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-900 font-medium">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-gray-900 font-semibold">No orders due soon</p>
              <p className="text-sm text-gray-600">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className={`border rounded-lg p-4 transition-all cursor-pointer shadow-sm ${
                    selectedOrders.has(order.id)
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-50"
                      : order.due_status === "overdue"
                      ? "border-red-400 bg-red-50"
                      : "border-gray-200 hover:border-gray-300 hover:shadow"
                  }`}
                  onClick={() => handleSelectOrder(order.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => handleSelectOrder(order.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4"
                        />
                        <span className="font-bold text-lg text-gray-900">
                          {order.order_number}
                        </span>
                        {getDaysRemainingBadge(order.days_remaining)}
                        {order.due_status === "overdue" && (
                          <Badge variant="destructive" className="animate-pulse bg-red-600 text-white">
                            OVERDUE
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <span>Customer: <span className="font-medium text-gray-900">{order.customer_id}</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span>
                            Created: <span className="font-medium text-gray-900"><DateDisplay date={order.created_at} format="short" /></span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span>
                            Due: <span className="font-medium text-gray-900"><DateDisplay date={order.delivery_date} format="short" /></span>
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3 text-sm">
                        <Package className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-700">
                          Due days: <strong className="text-gray-900">{order.due_days}</strong>
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-700">
                          Days remaining: <strong className={order.days_remaining < 0 ? "text-red-600" : "text-gray-900"}>
                            {order.days_remaining}
                          </strong>
                        </span>
                      </div>
                    </div>

                    {order.total_amount > 0 && (
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Amount</div>
                        <div className="font-bold text-lg text-gray-900">
                          <CurrencyDisplay amount={order.total_amount} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
