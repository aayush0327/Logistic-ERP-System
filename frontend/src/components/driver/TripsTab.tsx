"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Package,
  User,
  Plus,
  X,
  CheckCircle,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Trip } from "@/types/common";

interface TripsTabProps {
  activeTrips: Trip[];
  statusFilter: string | null;
  onStatusFilterClear: () => void;
  getStatusVariant: (status: string) => string;
  isTripLocked: (status: string) => boolean;
  getNextStatusOptions: (currentStatus: string) => Array<{
    value: string;
    label: string;
    color: string;
  }>;
  handleStatusChange: (tripId: string, newStatus: string) => void;
  getCapacityPercentage: (used: number, total: number) => number;
  getCapacityColor: (percentage: number) => string;
  getPriorityVariant: (priority: string) => string;
  handleAddOrderClick: (trip: Trip) => void;
}

export default function TripsTab({
  activeTrips,
  statusFilter,
  onStatusFilterClear,
  getStatusVariant,
  isTripLocked,
  getNextStatusOptions,
  handleStatusChange,
  getCapacityPercentage,
  getCapacityColor,
  getPriorityVariant,
  handleAddOrderClick,
}: TripsTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-black">All Trips</CardTitle>
          {statusFilter && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Filter:{" "}
                <span className="font-medium text-blue-600">
                  {statusFilter.replace("-", " ").toUpperCase()}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={onStatusFilterClear}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {activeTrips.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {statusFilter
                  ? `No ${statusFilter.replace("-", " ")} trips`
                  : "No trips available"}
              </h3>
              <p className="text-gray-500">
                {statusFilter
                  ? `There are no trips with ${statusFilter.replace(
                      "-",
                      " "
                    )} status.`
                  : "Create your first trip to get started."}
              </p>
              {statusFilter && (
                <Button
                  onClick={onStatusFilterClear}
                  variant="outline"
                  className="mt-4"
                >
                  Clear Filter
                </Button>
              )}
            </div>
          ) : (
            activeTrips.map((trip) => (
              <div
                key={trip.id}
                className={`border border-gray-200 rounded-lg overflow-hidden ${
                  isTripLocked(trip.status) ? "bg-gray-50" : "bg-white"
                }`}
              >
                {/* Trip Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <h3 className="font-bold text-lg text-gray-900">
                        {trip.id}
                      </h3>
                      <Badge
                        variant={
                          getStatusVariant(trip.status) as
                            | "default"
                            | "success"
                            | "warning"
                            | "danger"
                            | "info"
                        }
                        className="mt-1"
                      >
                        {trip.status.toUpperCase().replace("-", " ")}
                      </Badge>
                      {isTripLocked(trip.status) && (
                        <Badge variant="warning" className="text-xs">
                          LOCKED
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{trip.date}</span>
                      {getNextStatusOptions(trip.status).length > 0 && (
                        <div className="flex gap-1">
                          {getNextStatusOptions(trip.status).map((option) => (
                            <Button
                              key={option.value}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleStatusChange(trip.id, option.value)
                              }
                              className={`text-xs ${
                                option.color === "red"
                                  ? "text-red-600 border-red-300 hover:bg-red-50"
                                  : option.color === "green"
                                  ? "text-green-600 border-green-300 hover:bg-green-50"
                                  : option.color === "blue"
                                  ? "text-blue-600 border-blue-300 hover:bg-blue-50"
                                  : option.color === "yellow"
                                  ? "text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                                  : "text-gray-600 border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {option.color === "red" && (
                                <XCircle className="w-3 h-3 mr-1" />
                              )}
                              {option.color === "green" && (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              )}
                              {option.color === "blue" && (
                                <Play className="w-3 h-3 mr-1" />
                              )}
                              {option.color === "yellow" && (
                                <Package className="w-3 h-3 mr-1" />
                              )}
                              {option.color === "gray" && (
                                <RotateCcw className="w-3 h-3 mr-1" />
                              )}
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 mb-1">Route</p>
                      <p className="font-medium text-gray-900">
                        {trip.origin} → {trip.destination}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Truck</p>
                      <p className="font-medium text-gray-900">
                        {trip.truck
                          ? `${trip.truck.plate} (${trip.truck.model})`
                          : "Not assigned"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Driver</p>
                      <p className="font-medium text-gray-900">
                        {trip.driver ? trip.driver.name : "Not assigned"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 mb-1">Capacity</p>
                      <div className="space-y-1">
                        <p className="font-medium text-gray-900">
                          {trip.capacityUsed}/{trip.capacityTotal} kg
                        </p>
                        {trip.capacityTotal && trip.capacityTotal > 0 && (
                          <div className="relative">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${getCapacityColor(
                                  getCapacityPercentage(
                                    trip.capacityUsed || 0,
                                    trip.capacityTotal
                                  )
                                )}`}
                                style={{
                                  width: `${Math.min(
                                    getCapacityPercentage(
                                      trip.capacityUsed || 0,
                                      trip.capacityTotal
                                    ),
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span
                              className={`text-xs font-medium ${
                                getCapacityPercentage(
                                  trip.capacityUsed || 0,
                                  trip.capacityTotal
                                ) >= 100
                                  ? "text-red-600"
                                  : getCapacityPercentage(
                                      trip.capacityUsed || 0,
                                      trip.capacityTotal
                                    ) >= 80
                                  ? "text-yellow-600"
                                  : "text-green-600"
                              }`}
                            >
                              {getCapacityPercentage(
                                trip.capacityUsed || 0,
                                trip.capacityTotal
                              )}
                              %
                            </span>
                            {getCapacityPercentage(
                              trip.capacityUsed || 0,
                              trip.capacityTotal
                            ) > 100 && (
                              <span className="text-xs text-red-600 ml-1">
                                ⚠️ Overloaded
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trip Details */}
                <div className="p-4 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Assignment Details */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Assignment Details
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Orders:</span>
                          <span className="font-medium text-gray-900">
                            {trip.orders.length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Weight:</span>
                          <span className="font-medium text-gray-900">
                            {trip.orders.reduce(
                              (sum, order) => sum + order.weight,
                              0
                            )}{" "}
                            kg
                          </span>
                        </div>
                        {trip.driver && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Driver Phone:</span>
                            <span className="font-medium text-gray-900">
                              {trip.driver.phone}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Orders Section */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Orders ({trip.orders.length})
                      </h4>
                      {trip.status === "planning" && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => handleAddOrderClick(trip)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Order
                        </Button>
                      )}
                    </div>
                    {trip.orders.length > 0 && (
                      <div className="space-y-2">
                        {trip.orders.map((order) => (
                          <div
                            key={order.id}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              isTripLocked(trip.status)
                                ? "bg-gray-100 border border-gray-300"
                                : "bg-gray-50 border border-gray-200"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-gray-900">
                                {order.id}
                              </span>
                              <span className="text-gray-900">
                                {order.customer}
                              </span>
                              <Badge
                                variant={
                                  getPriorityVariant(order.priority) as
                                    | "default"
                                    | "success"
                                    | "warning"
                                    | "danger"
                                    | "info"
                                }
                                className="text-xs"
                              >
                                {order.priority.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-gray-900">
                                {order.items} items
                              </span>
                              <span className="font-medium text-gray-900">
                                {order.weight}kg
                              </span>
                              {!isTripLocked(trip.status) && (
                                <Button size="sm" variant="outline">
                                  Edit
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {trip.orders.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No orders assigned to this trip yet</p>
                        {trip.status === "planning" ? (
                          <p className="text-sm mt-1">
                            Click &quot;Add Order&quot; to assign orders to this
                            trip
                          </p>
                        ) : (
                          <p className="text-sm mt-1 text-yellow-600">
                            Orders cannot be added to trips that are{" "}
                            {trip.status.replace("-", " ")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Lock Status Message */}
                  {isTripLocked(trip.status) && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Trip is locked:</strong> Order details cannot be
                        modified when trip is {trip.status.replace("-", " ")}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
