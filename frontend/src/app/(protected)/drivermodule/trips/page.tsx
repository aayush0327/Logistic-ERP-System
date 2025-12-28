"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { driverAPI } from "@/lib/api";
import { Truck, AlertTriangle, RefreshCw } from "lucide-react";

// Type definitions
interface TripOrder {
  id: number;
  order_id: string;
  customer: string;
  customer_address?: string;
  delivery_status: string;
  total: number;
  weight: number;
  items: number;
  priority: string;
  sequence_number: number;
  address?: string;
  assigned_at: string;
}

interface Trip {
  id: string;
  status: string;
  origin?: string;
  destination?: string;
  truck_plate: string;
  truck_model: string;
  capacity_used: number;
  capacity_total: number;
  trip_date: string;
  order_count: number;
  completed_orders: number;
}

interface DriverTripDetail {
  trip: Trip;
  orders: TripOrder[];
}

export default function DriverDashboard() {
  // State management
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [tripDetails, setTripDetails] = useState<Map<string, DriverTripDetail>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data on component mount
  useEffect(() => {
    fetchDriverData();
  }, []);

  // Auto-fetch trip details for all trips
  useEffect(() => {
    if (allTrips.length > 0) {
      // Fetch details for all trips to show orders
      allTrips.forEach((trip) => {
        if (trip.id && trip.id !== "undefined") {
          fetchTripDetail(trip.id);
        }
      });
    }
  }, [allTrips]);

  const fetchDriverData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all trips
      const tripsData = await driverAPI.getDriverTrips({});
      setAllTrips(tripsData.trips);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load driver data"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTripDetail = async (tripId: string) => {
    try {
      // Validate trip ID before making API call
      if (!tripId || tripId === "undefined" || tripId.trim() === "") {
        console.warn("fetchTripDetail called with invalid trip ID:", tripId);
        setError("Invalid trip ID provided");
        return;
      }

      console.log("Fetching details for trip:", tripId);
      const tripDetail = await driverAPI.getTripDetail(tripId);
      setTripDetails((prev) => new Map(prev.set(tripId, tripDetail)));
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error("Error fetching trip details:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load trip details"
      );
    }
  };

  const markOrderDelivered = async (tripId: string, orderId: string) => {
    try {
      // Validate inputs before making API call
      if (!tripId || tripId === "undefined" || tripId.trim() === "") {
        console.error("Invalid trip ID:", tripId);
        setError("Invalid trip ID");
        return;
      }
      if (!orderId || orderId === "undefined" || orderId.trim() === "") {
        console.error("Invalid order ID:", orderId);
        setError("Invalid order ID");
        return;
      }

      console.log("Marking order as delivered:", { tripId, orderId });
      await driverAPI.markOrderDelivered(tripId, orderId);

      // Refresh trip details if exists
      if (tripDetails.has(tripId)) {
        await fetchTripDetail(tripId);
      }

      // Refresh all trips
      await fetchDriverData();
    } catch (err) {
      console.error("Error marking order as delivered:", err);
      setError(
        err instanceof Error ? err.message : "Failed to mark order as delivered"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-black">Driver Dashboard</h1>
          <p className="text-black mt-2">Manage your trips and deliveries</p>
        </div>
        <button
          onClick={fetchDriverData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-black">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Active Trip - Prominently Displayed */}
      {(() => {
        const activeTrip = allTrips.find(
          (trip) => trip.status === "on-route" || trip.status === "loading"
        );
        if (!activeTrip) return null;

        console.log("All trips data:", allTrips);
        console.log("Active trip found:", activeTrip);

        const tripDetail = tripDetails.get(activeTrip.id);
        const tripOrders = tripDetail?.orders || [];

        console.log("Trip detail for", activeTrip.id, ":", tripDetail);
        console.log("Trip orders:", tripOrders);

        return (
          <div className="border-2 border-blue-500 rounded-lg p-6 mb-8 bg-blue-50">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-black mb-2">
                Active Trip - {activeTrip.truck_plate}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-black">
                <div>
                  <span className="font-medium">Trip ID:</span> {activeTrip.id}
                </div>
                <div>
                  <span className="font-medium">Route:</span>{" "}
                  {activeTrip.origin || "N/A"} →{" "}
                  {activeTrip.destination || "N/A"}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  <span className="ml-1 px-2 py-1 bg-blue-600 text-white rounded text-xs">
                    OUT FOR DELIVERY
                  </span>
                </div>
                <div>
                  <span className="font-medium">Progress:</span>{" "}
                  {activeTrip.completed_orders}/{activeTrip.order_count} Orders
                </div>
                <div>
                  <span className="font-medium">Capacity:</span>{" "}
                  {activeTrip.capacity_used}/{activeTrip.capacity_total} kg
                </div>
                <div>
                  <span className="font-medium">Date:</span>{" "}
                  {new Date(activeTrip.trip_date).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Orders for Active Trip */}
            <div className="border-t border-blue-200 pt-4">
              <h3 className="text-xl font-semibold mb-4 text-black">
                Delivery Orders (Sequential)
              </h3>
              <div className="space-y-3">
                {tripOrders.map((order) => {
                  const isPreviousOrderDelivered = tripOrders
                    .filter((o) => o.sequence_number < order.sequence_number)
                    .every((o) => o.delivery_status === "delivered");
                  const canDeliver =
                    order.delivery_status !== "delivered" &&
                    isPreviousOrderDelivered;

                  return (
                    <div
                      key={order.id}
                      className={`border rounded-lg p-4 ${
                        order.delivery_status === "delivered"
                          ? "bg-green-50 border-green-200"
                          : canDeliver
                          ? "bg-yellow-50 border-yellow-300 border-2"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-black text-black">
                          Order #{order.sequence_number + 1} - {order.order_id}
                        </h4>
                        <span
                          className={`px-3 py-1 rounded text-sm font-medium ${
                            order.delivery_status === "delivered"
                              ? "bg-green-600 text-white"
                              : "bg-blue-600 text-white"
                          }`}
                        >
                          {order.delivery_status === "delivered"
                            ? "DELIVERED"
                            : "OUT FOR DELIVERY"}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-black mb-3">
                        <p>
                          <span className="font-medium">Customer:</span>{" "}
                          {order.customer}
                        </p>
                        <p>
                          <span className="font-medium">Items:</span>{" "}
                          {order.items || 0} items
                        </p>
                        <p>
                          <span className="font-medium">Weight:</span>{" "}
                          {order.weight || 0} kg
                        </p>
                        <p>
                          <span className="font-medium">Total:</span> ₹
                          {order.total?.toLocaleString() || "0"}
                        </p>
                      </div>
                      {order.address && (
                        <p className="text-black mb-3">
                          <span className="font-medium">Address:</span>{" "}
                          {order.address}
                        </p>
                      )}
                      <div className="flex justify-end">
                        {order.delivery_status === "delivered" ? (
                          <span className="text-green-700 font-medium">
                            ✓ Already Delivered
                          </span>
                        ) : canDeliver ? (
                          <button
                            onClick={() => {
                              console.log(
                                "Button clicked - Active Trip ID:",
                                activeTrip.id,
                                "Order ID:",
                                order.order_id,
                                "Order:",
                                order
                              );
                              console.log("Trip details:", activeTrip);
                              console.log("All trip orders:", tripOrders);
                              markOrderDelivered(activeTrip.id, order.order_id);
                            }}
                            className="px-6 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700"
                          >
                            Mark as Delivered
                          </button>
                        ) : (
                          <button
                            disabled
                            className="px-4 py-2 bg-gray-400 text-white rounded font-medium cursor-not-allowed"
                            title="Deliver previous orders first"
                          >
                            Deliver Previous Order First
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Other Trips */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-black">Other Trips</h2>
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-black">Loading trips...</span>
            </div>
          ) : allTrips.filter(
              (trip) => trip.status !== "on-route" && trip.status !== "loading"
            ).length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-black mb-2">
                No other trips found
              </h3>
              <p className="text-black">All your trips are currently active</p>
            </div>
          ) : (
            allTrips
              .filter(
                (trip) =>
                  trip.status !== "on-route" && trip.status !== "loading"
              )
              .map((trip) => {
                const tripDetail = tripDetails.get(trip.id);
                const tripOrders = tripDetail?.orders || [];

                return (
                  <div
                    key={trip.id}
                    className="border rounded-lg p-6 bg-gray-50"
                  >
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-black mb-2">
                        {trip.truck_plate} - {trip.origin || "N/A"} →{" "}
                        {trip.destination || "N/A"}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-black">
                        <div>
                          <span className="font-medium">Trip ID:</span>{" "}
                          {trip.id}
                        </div>
                        <div>
                          <span className="font-medium">Status:</span>{" "}
                          <span
                            className={`ml-1 px-2 py-1 rounded text-xs text-white ${
                              trip.status === "completed"
                                ? "bg-green-600"
                                : trip.status === "planning"
                                ? "bg-gray-600"
                                : "bg-gray-600"
                            }`}
                          >
                            {trip.status.toUpperCase().replace("-", " ")}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Progress:</span>{" "}
                          {trip.completed_orders}/{trip.order_count} Orders
                        </div>
                        <div>
                          <span className="font-medium">Date:</span>{" "}
                          {new Date(trip.trip_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Orders for Other Trips */}
                    {tripOrders.length > 0 && (
                      <div className="border-t border-gray-300 pt-4">
                        <h4 className="text-lg font-semibold mb-3 text-black">
                          Orders ({tripOrders.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {tripOrders.map((order) => (
                            <div
                              key={order.id}
                              className="border rounded p-3 bg-white"
                            >
                              <div className="flex justify-between items-center mb-2">
                                <h5 className="font-black text-black">
                                  Order #{order.sequence_number + 1} -{" "}
                                  {order.order_id}
                                </h5>
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium text-white ${
                                    order.delivery_status === "delivered"
                                      ? "bg-green-600"
                                      : "bg-gray-600"
                                  }`}
                                >
                                  {order.delivery_status === "delivered"
                                    ? "DELIVERED"
                                    : order.delivery_status
                                        .toUpperCase()
                                        .replace("-", " ")}
                                </span>
                              </div>
                              <p className="text-sm text-black mb-1">
                                <span className="font-medium">Customer:</span>{" "}
                                {order.customer}
                              </p>
                              <p className="text-sm text-black mb-1">
                                <span className="font-medium">Items:</span>{" "}
                                {order.items} items ({order.weight} kg)
                              </p>
                              {order.delivery_status === "delivered" && (
                                <p className="text-green-700 text-sm font-medium">
                                  ✓ Delivered
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
