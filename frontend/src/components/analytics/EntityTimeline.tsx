"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Clock,
  User,
  ArrowRight,
  X,
  FileText,
  Truck,
  Package,
  UserCircle,
  Wrench,
  Calendar,
  Hourglass,
} from "lucide-react";
import { useState, useEffect } from "react";
import { analyticsAPI, TimelineEvent, EntityTimelineResponse } from "@/services/analytics";

interface EntityTimelineProps {
  entityType: "order" | "trip" | "driver" | "truck";
  entityId: string;
  onClose: () => void;
}

const entityTypeLabels: Record<string, string> = {
  order: "Order",
  trip: "Trip",
  driver: "Driver",
  truck: "Truck",
};

const entityTypeIcons: Record<string, React.ElementType> = {
  order: Package,
  trip: Truck,
  driver: UserCircle,
  truck: Wrench,
};

const actionColors: Record<string, string> = {
  created: "bg-green-100 text-green-700 border-green-200",
  updated: "bg-blue-100 text-blue-700 border-blue-200",
  status_changed: "bg-purple-100 text-purple-700 border-purple-200",
  assigned: "bg-indigo-100 text-indigo-700 border-indigo-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-orange-100 text-orange-700 border-orange-200",
  resumed: "bg-yellow-100 text-yellow-700 border-yellow-200",
  picked_up: "bg-blue-100 text-blue-700 border-blue-200",
  delivered: "bg-green-100 text-green-700 border-green-200",
  default: "bg-gray-100 text-gray-700 border-gray-200",
};

function formatAction(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatStatus(status: string): string {
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

export function EntityTimeline({ entityType, entityId, onClose }: EntityTimelineProps) {
  const [timeline, setTimeline] = useState<EntityTimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      setLoading(true);
      setError(null);

      try {
        const data = await analyticsAPI.getEntityTimeline(entityType, entityId);
        setTimeline(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load timeline");
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, [entityType, entityId]);

  const EntityTypeIcon = entityTypeIcons[entityType];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <EntityTypeIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {entityTypeLabels[entityType]} Timeline
                </CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  ID: {entityId}
                  {timeline && (
                    <span className="ml-2">
                      • Current Status:{" "}
                      <span className="font-semibold text-gray-700">
                        {formatStatus(timeline.current_status)}
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
          ) : timeline ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    Created
                  </div>
                  <p className="font-semibold text-gray-900">
                    {formatTimestamp(timeline.created_at)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Hourglass className="w-4 h-4" />
                    Total Duration
                  </div>
                  <p className="font-semibold text-gray-900">
                    {formatDuration(timeline.total_duration_hours)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <FileText className="w-4 h-4" />
                    Events
                  </div>
                  <p className="font-semibold text-gray-900">
                    {timeline.timeline.length}
                  </p>
                </div>
              </div>

              {/* Timeline */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

                {/* Timeline events */}
                <div className="space-y-4">
                  {timeline.timeline.map((event, index) => (
                    <div key={index} className="relative flex gap-4">
                      {/* Timeline dot */}
                      <div className="relative z-10 flex-shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                            index === 0
                              ? "bg-blue-600 border-blue-600"
                              : "bg-white border-gray-300"
                          }`}
                        >
                          {index === 0 ? (
                            <Clock className="w-4 h-4 text-white" />
                          ) : (
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                      </div>

                      {/* Event content */}
                      <div className="flex-1 bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded border ${
                                actionColors[event.action] || actionColors.default
                              }`}
                            >
                              {formatAction(event.action)}
                            </span>
                            {event.from_status && (
                              <>
                                <span className="text-sm text-gray-600">
                                  {formatStatus(event.from_status)}
                                </span>
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {formatStatus(event.to_status)}
                                </span>
                              </>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>

                        {event.description && (
                          <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {event.user_name && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{event.user_name}</span>
                            </div>
                          )}
                          {event.duration_hours !== undefined && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(event.duration_hours)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <Button variant="outline" onClick={onClose} className="w-full">
            Close Timeline
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Hook to use the timeline modal
export function useEntityTimeline() {
  const [isOpen, setIsOpen] = useState(false);
  const [entityType, setEntityType] = useState<"order" | "trip" | "driver" | "truck">("order");
  const [entityId, setEntityId] = useState("");

  const open = (
    type: "order" | "trip" | "driver" | "truck",
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
      <EntityTimeline
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
