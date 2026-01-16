"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Package,
  Eye,
  Calendar,
  Activity,
} from "lucide-react";
import { useState, useEffect } from "react";
import { analyticsAPI, OrderTimelineSummary, OrdersListResponse } from "@/services/analytics";
import { useStatusTimeline } from "./StatusTimeline";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  submitted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  finance_approved: "bg-blue-100 text-blue-700 border-blue-200",
  logistics_approved: "bg-blue-100 text-blue-700 border-blue-200",
  assigned: "bg-purple-100 text-purple-700 border-purple-200",
  picked_up: "bg-indigo-100 text-indigo-700 border-indigo-200",
  in_transit: "bg-indigo-100 text-indigo-700 border-indigo-200",
  partial_in_transit: "bg-indigo-100 text-indigo-700 border-indigo-200",
  partial_delivered: "bg-green-100 text-green-700 border-green-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

function formatStatus(status: string): string {
  if (!status) return "N/A";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  } else if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } else {
    const days = Math.floor(hours / 24);
    const h = Math.round(hours % 24);
    return h > 0 ? `${days}d ${h}h` : `${days}d`;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface OrdersListProps {
  onClose: () => void;
}

export function OrdersList({ onClose }: OrdersListProps) {
  const [data, setData] = useState<OrdersListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { open: openTimeline, TimelineModal: StatusTimelineModal } = useStatusTimeline();

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      setError(null);

      try {
        const result = await analyticsAPI.getOrdersList(currentPage, 10);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [currentPage]);

  const handlePreviousPage = () => {
    if (data && data.has_previous) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (data && data.has_next) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  // Calculate overall totals
  const overallTotalDuration = data?.orders.reduce(
    (sum, order) => sum + order.total_duration_hours,
    0
  ) || 0;
  const avgDuration = data?.orders.length
    ? overallTotalDuration / data.orders.length
    : 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    All Orders
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {data ? `${data.total_count} orders total` : "Loading..."}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                ×
              </Button>
            </div>
          </CardHeader>

          {/* Content */}
          <CardContent className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">{error}</p>
              </div>
            ) : data ? (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Activity className="w-4 h-4" />
                      Total Orders
                    </div>
                    <p className="font-semibold text-gray-900 text-lg">
                      {data.total_count}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Clock className="w-4 h-4" />
                      Avg Duration
                    </div>
                    <p className="font-semibold text-gray-900 text-lg">
                      {formatDuration(avgDuration)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Clock className="w-4 h-4" />
                      Total Duration
                    </div>
                    <p className="font-semibold text-gray-900 text-lg">
                      {formatDuration(overallTotalDuration)}
                    </p>
                  </div>
                </div>

                {/* Orders Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Order Number
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Duration
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Changes
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Created
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.orders.map((order) => (
                        <tr key={order.order_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {order.order_number}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded border ${
                                statusColors[order.current_status] ||
                                "bg-gray-100 text-gray-700 border-gray-200"
                              }`}
                            >
                              {formatStatus(order.current_status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDuration(order.total_duration_hours)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {order.status_changes_count}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(order.created_at)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTimeline("order", order.order_number)}
                              className="h-8 px-2"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {data.orders.length} of {data.total_count} orders
                    (Page {data.page} of {data.total_pages})
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={!data.has_previous}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!data.has_next}
                      className="flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <StatusTimelineModal />
    </>
  );
}

export function useOrdersList() {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => {
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  const OrdersListModal = () => {
    if (!isOpen) return null;
    return <OrdersList onClose={close} />;
  };

  return {
    open,
    close,
    OrdersListModal,
    isOpen,
  };
}
