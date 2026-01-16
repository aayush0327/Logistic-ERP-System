"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  BarChart3,
  Package,
  Truck,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  RefreshCw,
  XCircle,
  Eye,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAnalyticsDashboard } from "@/hooks/useAnalytics";
import { DateRangePreset, DateRange } from "@/services/analytics";
import { useStatusTimeline } from "@/components/analytics/StatusTimeline";
import { useOrdersList } from "@/components/analytics/OrdersList";
import { useTripsList } from "@/components/analytics/TripsList";

// Status color mapping for orders
const orderStatusColors: Record<string, string> = {
  draft: "bg-gray-500",
  submitted: "bg-yellow-500",
  finance_approved: "bg-blue-400",
  logistics_approved: "bg-blue-500",
  assigned: "bg-purple-500",
  picked_up: "bg-indigo-400",
  in_transit: "bg-indigo-500",
  partial_in_transit: "bg-indigo-400",
  partial_delivered: "bg-green-400",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
  finance_rejected: "bg-red-400",
  logistics_rejected: "bg-red-400",
};

// Status color mapping for trips
const tripStatusColors: Record<string, string> = {
  planning: "bg-blue-400",
  loading: "bg-yellow-400",
  "on-route": "bg-green-500",
  paused: "bg-orange-500",
  completed: "bg-gray-500",
  cancelled: "bg-red-500",
  "truck-malfunction": "bg-red-400",
};

// Format status for display
function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("last_7_days");
  const { open: openTimeline, TimelineModal: StatusTimelineModal } = useStatusTimeline();
  const { open: openOrdersList, OrdersListModal: OrdersListModalComponent } = useOrdersList();
  const { open: openTripsList, TripsListModal: TripsListModalComponent } = useTripsList();

  // Build date range object from preset
  const buildDateRange = (preset: DateRangePreset): DateRange => {
    const now = new Date();
    let start_date: string;

    switch (preset) {
      case "today":
        start_date = now.toISOString().split("T")[0];
        break;
      case "last_7_days":
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        start_date = sevenDaysAgo.toISOString().split("T")[0];
        break;
      case "last_30_days":
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        start_date = thirtyDaysAgo.toISOString().split("T")[0];
        break;
      case "custom":
        start_date = now.toISOString().split("T")[0];
        break;
    }

    return {
      preset,
      start_date,
      end_date: now.toISOString().split("T")[0],
    };
  };

  const dateRange = buildDateRange(dateRangePreset);

  // Fetch all dashboard data
  const { summary, orderStatuses, tripStatuses, orderBottlenecks, driverUtilization, truckUtilization, loading, error, refetch } =
    useAnalyticsDashboard(dateRange);

  const dateRangeOptions = [
    { value: "today" as const, label: "Today" },
    { value: "last_7_days" as const, label: "Last 7 Days" },
    { value: "last_30_days" as const, label: "Last 30 Days" },
  ];

  // Helper to format numbers
  const formatNumber = (num: number | undefined): string => {
    if (num === undefined || num === null) return "0";
    return num.toLocaleString();
  };

  // Helper to format decimals
  const formatDecimal = (num: number | undefined, decimals: number = 1): string => {
    if (num === undefined || num === null) return "0";
    return num.toFixed(decimals);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Operational analytics and performance metrics
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Date Range:</span>
          <div className="inline-flex rounded-md shadow-sm" role="group">
            {dateRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setDateRangePreset(option.value)}
                className={`px-4 py-2 text-sm font-medium border ${
                  dateRangePreset === option.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                } ${
                  option.value !== dateRangeOptions[0].value
                    ? "border-l-0 rounded-none"
                    : "rounded-l-md"
                } ${
                  option.value === dateRangeOptions[dateRangeOptions.length - 1].value
                    ? "rounded-r-md"
                    : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Error Loading Analytics</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <p className="text-sm text-red-600 mt-2">
                  Make sure the analytics service is running on port 8008.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && !summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-12"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard
            title="Total Orders"
            value={summary.total_orders.value}
            unit={summary.total_orders.unit}
            trend={summary.total_orders.trend}
            icon={Package}
            color="blue"
          />
          <KPICard
            title="Delivered Today"
            value={summary.orders_delivered_today.value}
            unit={summary.orders_delivered_today.unit}
            trend={summary.orders_delivered_today.trend}
            icon={TrendingUp}
            color="green"
          />
          <KPICard
            title="Avg Fulfillment"
            value={summary.avg_fulfillment_time.value}
            unit={summary.avg_fulfillment_time.unit}
            trend={summary.avg_fulfillment_time.trend}
            icon={Clock}
            color="purple"
          />
          <KPICard
            title="Active Trips"
            value={summary.active_trips.value}
            unit={summary.active_trips.unit}
            trend={summary.active_trips.trend}
            icon={Truck}
            color="indigo"
          />
          <KPICard
            title="Available Drivers"
            value={summary.available_drivers.value}
            unit={summary.available_drivers.unit}
            trend={summary.available_drivers.trend}
            icon={Users}
            color="cyan"
          />
          <KPICard
            title="Available Trucks"
            value={summary.available_trucks.value}
            unit={summary.available_trucks.unit}
            trend={summary.available_trucks.trend}
            icon={Truck}
            color="orange"
          />
        </div>
      )}

      {/* Status Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order Status Distribution
              </div>
              {orderStatuses && (
                <span className="text-sm font-normal text-gray-500">
                  Total: {formatNumber(orderStatuses.total_orders)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !orderStatuses ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : orderStatuses && orderStatuses.status_counts.length > 0 ? (
              <div className="space-y-3">
                {orderStatuses.status_counts.map((item) => (
                  <div key={item.status} className="flex items-center">
                    <div className="w-36 text-sm text-gray-600 truncate">
                      {formatStatus(item.status)}
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded-full h-6">
                        <div
                          className={`${
                            orderStatusColors[item.status] || "bg-gray-500"
                          } h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-300`}
                          style={{
                            width: `${Math.min(
                              (item.count / orderStatuses.total_orders) * 100,
                              100
                            )}%`,
                          }}
                        >
                          <span className="text-xs text-white font-medium">
                            {formatNumber(item.count)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-16 text-sm text-gray-500 text-right">
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No order data available</p>
            )}
          </CardContent>
        </Card>

        {/* Trip Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Trip Status Distribution
              </div>
              {tripStatuses && (
                <span className="text-sm font-normal text-gray-500">
                  Total: {formatNumber(tripStatuses.total_trips)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !tripStatuses ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : tripStatuses && tripStatuses.status_counts.length > 0 ? (
              <div className="space-y-3">
                {tripStatuses.status_counts.map((item) => (
                  <div key={item.status} className="flex items-center">
                    <div className="w-36 text-sm text-gray-600 truncate">
                      {formatStatus(item.status)}
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded-full h-6">
                        <div
                          className={`${
                            tripStatusColors[item.status] || "bg-gray-500"
                          } h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-300`}
                          style={{
                            width: `${Math.min(
                              (item.count / tripStatuses.total_trips) * 100,
                              100
                            )}%`,
                          }}
                        >
                          <span className="text-xs text-white font-medium">
                            {formatNumber(item.count)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-16 text-sm text-gray-500 text-right">
                      {item.percentage.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No trip data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sample Orders & Trips with Timeline View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sample Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Recent Orders
              <span className="text-xs font-normal text-gray-500 ml-2">
                Click to view timeline
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                   onClick={() => openTimeline("order", "ORD-20260112-2F91EEBE")}>
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">ORD-20260112-2F91EEBE</p>
                    <p className="text-xs text-gray-500">Finance Approved • 0.1h total</p>
                  </div>
                </div>
                <Eye className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                   onClick={() => openTimeline("order", "ORD-20260112-55DD9FA3")}>
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-indigo-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">ORD-20260112-55DD9FA3</p>
                    <p className="text-xs text-gray-500">Finance Approved • 0.1h total</p>
                  </div>
                </div>
                <Eye className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-center pt-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => openOrdersList()}>
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View All Orders
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sample Trips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Recent Trips
              <span className="text-xs font-normal text-gray-500 ml-2">
                Click to view timeline
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                   onClick={() => openTimeline("trip", "TRIP-01CFE183")}>
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">TRIP-01CFE183</p>
                    <p className="text-xs text-gray-500">Completed • 0.5h total</p>
                  </div>
                </div>
                <Eye className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                   onClick={() => openTimeline("trip", "TRIP-71EB2FB0")}>
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">TRIP-71EB2FB0</p>
                    <p className="text-xs text-gray-500">Completed • 0.3h total</p>
                  </div>
                </div>
                <Eye className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-center pt-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => openTripsList()}>
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View All Trips
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottlenecks & Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Bottlenecks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Order Bottlenecks
            </CardTitle>
            <p className="text-sm text-gray-500">
              Orders stuck more than {orderBottlenecks?.threshold_hours || 4} hours
            </p>
          </CardHeader>
          <CardContent>
            {loading && !orderBottlenecks ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : orderBottlenecks && orderBottlenecks.bottlenecks.length > 0 ? (
              <div className="space-y-2">
                {orderBottlenecks.bottlenecks.map((bottleneck, index) => (
                  <div
                    key={bottleneck.current_status}
                    className={`flex items-center justify-between py-2 ${
                      index < orderBottlenecks.bottlenecks.length - 1 ? "border-b" : ""
                    }`}
                  >
                    <span className="text-sm font-medium">
                      {formatStatus(bottleneck.current_status)}
                    </span>
                    <span className="text-sm text-orange-600 font-semibold">
                      {formatNumber(bottleneck.stuck_count)}
                      <span className="text-xs text-gray-500 ml-1">
                        ({formatDecimal(bottleneck.avg_hours_stuck)}h avg)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No bottleneck orders detected
              </p>
            )}
          </CardContent>
        </Card>

        {/* Driver & Truck Utilization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Resource Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Driver Utilization */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Driver Utilization</span>
                  {loading && !driverUtilization ? (
                    <div className="h-4 w-12 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    <span className="text-sm text-gray-600">
                      {driverUtilization
                        ? formatDecimal(driverUtilization.avg_utilization_percent)
                        : "0"}%
                    </span>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        driverUtilization?.avg_utilization_percent || 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Truck Utilization */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Truck Utilization</span>
                  {loading && !truckUtilization ? (
                    <div className="h-4 w-12 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    <span className="text-sm text-gray-600">
                      {truckUtilization
                        ? formatDecimal(truckUtilization.avg_utilization_percent)
                        : "0"}%
                    </span>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        truckUtilization?.avg_utilization_percent || 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner - only show if no data */}
      {!summary && !loading && !error && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">
                  Analytics Dashboard
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  The analytics service provides real-time operational metrics and
                  performance analytics.
                </p>
                <ul className="text-sm text-blue-700 mt-2 list-disc list-inside">
                  <li>Order analytics: status counts, durations, lifecycle times, bottlenecks</li>
                  <li>Trip analytics: status tracking, pause accumulation, inefficiency detection</li>
                  <li>Driver analytics: utilization metrics, availability impact</li>
                  <li>Truck analytics: utilization, maintenance downtime</li>
                  <li>Configurable date ranges and entity timeline drill-down</li>
                </ul>
                <p className="text-sm text-blue-600 mt-3">
                  Select a date range above to load the analytics data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Timeline Modal */}
      <StatusTimelineModal />
      {/* Orders List Modal */}
      <OrdersListModalComponent />
      {/* Trips List Modal */}
      <TripsListModalComponent />
    </div>
  );
}

// KPI Card Component
interface KPICardProps {
  title: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "neutral";
  icon: React.ElementType;
  color: "blue" | "green" | "purple" | "indigo" | "cyan" | "orange";
}

const colorClasses = {
  blue: { bg: "bg-blue-500", text: "text-blue-600", light: "bg-blue-50" },
  green: { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50" },
  purple: { bg: "bg-purple-500", text: "text-purple-600", light: "bg-purple-50" },
  indigo: { bg: "bg-indigo-500", text: "text-indigo-600", light: "bg-indigo-50" },
  cyan: { bg: "bg-cyan-500", text: "text-cyan-600", light: "bg-cyan-50" },
  orange: { bg: "bg-orange-500", text: "text-orange-600", light: "bg-orange-50" },
};

function KPICard({ title, value, unit, trend, icon: Icon, color }: KPICardProps) {
  const colors = colorClasses[color];

  return (
    <Card className={colors.light}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase">{title}</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">
                {value.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500">{unit}</span>
            </div>
          </div>
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
