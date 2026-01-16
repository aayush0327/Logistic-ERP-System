"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Clock,
  User,
  ArrowRight,
  X,
  Package,
  Truck,
  Calendar,
  Hourglass,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { analyticsAPI, StatusTimelineItem, OrderStatusTimelineResponse, TripStatusTimelineResponse } from "@/services/analytics";

interface StatusTimelineProps {
  entityType: "order" | "trip";
  entityId: string;
  onClose: () => void;
}

const entityTypeLabels: Record<string, string> = {
  order: "Order",
  trip: "Trip",
};

const entityTypeIcons: Record<string, React.ElementType> = {
  order: Package,
  trip: Truck,
};

// Status colors for badges
const statusColors: Record<string, string> = {
  // Order statuses
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

  // Trip statuses
  planning: "bg-blue-100 text-blue-700 border-blue-200",
  loading: "bg-yellow-100 text-yellow-700 border-yellow-200",
  "on-route": "bg-green-100 text-green-700 border-green-200",
  paused: "bg-orange-100 text-orange-700 border-orange-200",
  completed: "bg-gray-100 text-gray-700 border-gray-200",
  "truck-malfunction": "bg-red-100 text-red-700 border-red-200",
};

function formatStatus(status: string): string {
  if (!status) return "N/A";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(hours?: number): string {
  if (hours === undefined || hours === null) return "In progress";
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
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

export function StatusTimeline({ entityType, entityId, onClose }: StatusTimelineProps) {
  const [data, setData] = useState<OrderStatusTimelineResponse | TripStatusTimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      setLoading(true);
      setError(null);

      try {
        let result: OrderStatusTimelineResponse | TripStatusTimelineResponse;
        if (entityType === "order") {
          result = await analyticsAPI.getOrderStatusTimeline(entityId);
        } else {
          result = await analyticsAPI.getTripStatusTimeline(entityId);
        }
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load timeline");
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, [entityType, entityId]);

  const EntityTypeIcon = entityTypeIcons[entityType];
  const displayId = entityType === "order"
    ? (data as OrderStatusTimelineResponse)?.order_number || entityId
    : entityId;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <EntityTypeIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {entityTypeLabels[entityType]} Status Timeline
                </CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  {displayId}
                  {data && (
                    <span className="ml-2">
                      • Current:{" "}
                      <span className="font-semibold text-gray-700">
                        {formatStatus(data.current_status)}
                      </span>
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
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
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Hourglass className="w-4 h-4" />
                    Total Duration
                  </div>
                  <p className="font-semibold text-gray-900 text-lg">
                    {formatDuration(data.total_duration_hours)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Status Changes
                  </div>
                  <p className="font-semibold text-gray-900 text-lg">
                    {data.timeline.length}
                  </p>
                </div>
              </div>

              {/* Timeline */}
              {data.timeline.length > 0 ? (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                  {/* Timeline events */}
                  <div className="space-y-4">
                    {data.timeline.map((item, index) => (
                      <div key={item.sequence} className="relative flex gap-4">
                        {/* Timeline dot */}
                        <div className="relative z-10 flex-shrink-0">
                          <div
                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                              index === data.timeline.length - 1 && data.current_status !== "cancelled" && data.current_status !== "completed"
                                ? "bg-green-600 border-green-600"
                                : "bg-white border-gray-300"
                            }`}
                          >
                            {index === data.timeline.length - 1 && data.current_status !== "cancelled" && data.current_status !== "completed" ? (
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            ) : (
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            )}
                          </div>
                        </div>

                        {/* Event content */}
                        <div className="flex-1 bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.from_status && (
                                <>
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded border ${
                                      statusColors[item.from_status] || "bg-gray-100 text-gray-700 border-gray-200"
                                    }`}
                                  >
                                    {formatStatus(item.from_status)}
                                  </span>
                                  <ArrowRight className="w-4 h-4 text-gray-400" />
                                </>
                              )}
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded border ${
                                  statusColors[item.to_status] || "bg-gray-100 text-gray-700 border-gray-200"
                                }`}
                              >
                                {formatStatus(item.to_status)}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {formatTimestamp(item.timestamp)}
                            </span>
                          </div>

                          {item.description && (
                            <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {item.user_name && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>{item.user_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(item.duration_hours)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No status history available for this {entityTypeLabels[entityType].toLowerCase()}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Hook to use the status timeline modal
export function useStatusTimeline() {
  const [isOpen, setIsOpen] = useState(false);
  const [entityType, setEntityType] = useState<"order" | "trip">("order");
  const [entityId, setEntityId] = useState("");

  const open = (
    type: "order" | "trip",
    id: string
  ) => {
    setEntityType(type);
    setEntityId(id);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
  };

  const TimelineModal = () => {
    if (!isOpen) return null;
    return (
      <StatusTimeline
        entityType={entityType}
        entityId={entityId}
        onClose={close}
      />
    );
  };

  return {
    open,
    close,
    TimelineModal,
    isOpen,
  };
}
