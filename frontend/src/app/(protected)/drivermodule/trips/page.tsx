"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { driverAPI } from "@/lib/api";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";
import { Truck, AlertTriangle, RefreshCw, Wrench, Play, AlertCircle } from "lucide-react";
import { DocumentUploadModal } from "@/components/driver";

// Type definitions
interface TripOrder {
  id: number;
  order_id: string;
  order_number?: string;
  customer: string;
  customer_address?: string;
  delivery_status: string;
  // total: number;
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
  paused_reason?: string;
  maintenance_note?: string;
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

  // Pause/Resume state
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseNote, setPauseNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Document upload state
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedOrderForDocument, setSelectedOrderForDocument] = useState<{
    tripId: string;
    orderId: string;
    orderNumber?: string;
  } | null>(null);

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

  const markOrderDelivered = async (tripId: string, orderId: string, orderNumber?: string) => {
    // Open document upload modal instead of directly marking as delivered
    console.log("markOrderDelivered called with:", { tripId, orderId, orderNumber });
    setSelectedOrderForDocument({
      tripId,
      orderId,
      orderNumber
    });
    setShowDocumentModal(true);
    console.log("showDocumentModal set to true");
  };

  const handleDocumentUploadComplete = async (documentData: any) => {
    const { tripId, orderId } = selectedOrderForDocument!;
    try {
      // Now mark the order as delivered after document upload
      console.log("Document uploaded, marking order as delivered:", { tripId, orderId });
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

  const handlePauseTrip = async () => {
    if (!selectedTrip || !pauseReason) return;

    setIsProcessing(true);
    try {
      await driverAPI.pauseTrip(selectedTrip.id, pauseReason, pauseNote);
      setShowPauseModal(false);
      setPauseReason("");
      setPauseNote("");
      setSelectedTrip(null);
      await fetchDriverData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to pause trip"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResumeTrip = async () => {
    if (!selectedTrip) return;

    setIsProcessing(true);
    try {
      await driverAPI.resumeTrip(selectedTrip.id, pauseNote);
      setShowResumeModal(false);
      setPauseNote("");
      setSelectedTrip(null);
      await fetchDriverData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resume trip"
      );
    } finally {
      setIsProcessing(false);
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

      {/* Paused Trip Section */}
      {(() => {
        const pausedTrip = allTrips.find((trip) => trip.status === "paused");
        if (!pausedTrip) return null;

        const tripDetail = tripDetails.get(pausedTrip.id);
        const tripOrders = tripDetail?.orders || [];

        return (
          <div className="bg-orange-100 border-2 border-orange-500 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-2 text-orange-800 mb-4">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Trip Paused - Under Maintenance</h2>
            </div>

            <div className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-black">
                <div>
                  <span className="font-medium">Trip ID:</span> {pausedTrip.id}
                </div>
                <div>
                  <span className="font-medium">Truck:</span> {pausedTrip.truck_plate}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  <span className="ml-1 px-2 py-1 bg-orange-600 text-white rounded text-xs">
                    PAUSED
                  </span>
                </div>
              </div>
            </div>

            {pausedTrip.paused_reason && (
              <div className="bg-orange-50 border border-orange-300 rounded p-3 mb-4">
                <p className="text-sm font-medium text-orange-900">Reason:</p>
                <p className="text-sm text-orange-800">{pausedTrip.paused_reason}</p>
              </div>
            )}

            {pausedTrip.maintenance_note && (
              <div className="bg-orange-50 border border-orange-300 rounded p-3 mb-4">
                <p className="text-sm font-medium text-orange-900">Notes:</p>
                <p className="text-sm text-orange-700 italic">{pausedTrip.maintenance_note}</p>
              </div>
            )}

            <button
              onClick={() => {
                setSelectedTrip(pausedTrip);
                setShowResumeModal(true);
              }}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Resume Trip
            </button>
          </div>
        );
      })()}

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

            {/* Pause Button - Only show for on-route trips */}
            {activeTrip.status === "on-route" && (
              <div className="mb-4">
                <button
                  onClick={() => {
                    setSelectedTrip(activeTrip);
                    setShowPauseModal(true);
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center gap-2"
                >
                  <Wrench className="w-4 h-4" />
                  Under Maintenance
                </button>
              </div>
            )}

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
                        {/* <p>
                          <span className="font-medium">Total:</span>{" "}
                          <CurrencyDisplay amount={order.total || 0} />
                        </p> */}
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
                              markOrderDelivered(activeTrip.id, order.order_id, order.order_number);
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

      {/* Pause Trip Modal */}
      {showPauseModal && selectedTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-black mb-2">Pause Trip - Under Maintenance</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to pause this trip? This will indicate the truck is under maintenance.
            </p>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Reason *</label>
                <select
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select reason</option>
                  <option value="breakdown">Vehicle Breakdown</option>
                  <option value="accident">Accident</option>
                  <option value="weather">Severe Weather</option>
                  <option value="traffic">Major Traffic/Delay</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">Additional Notes</label>
                <textarea
                  value={pauseNote}
                  onChange={(e) => setPauseNote(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPauseModal(false);
                  setPauseReason("");
                  setPauseNote("");
                  setSelectedTrip(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handlePauseTrip}
                disabled={!pauseReason || isProcessing}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isProcessing ? "Pausing..." : "Yes, Pause Trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Trip Modal */}
      {showResumeModal && selectedTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-black mb-2">Resume Trip</h3>
            <p className="text-gray-600 mb-4">
              Ready to continue deliveries? This will mark the trip as active again.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-1">Notes (optional)</label>
              <textarea
                value={pauseNote}
                onChange={(e) => setPauseNote(e.target.value)}
                placeholder="Any updates on the maintenance status..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResumeModal(false);
                  setPauseNote("");
                  setSelectedTrip(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleResumeTrip}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isProcessing ? "Resuming..." : "Resume Trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {selectedOrderForDocument && (
        <>
          {console.log("Rendering DocumentUploadModal with:", { showDocumentModal, selectedOrderForDocument })}
          <DocumentUploadModal
            isOpen={showDocumentModal}
            onClose={() => {
              console.log("Modal onClose called");
              setShowDocumentModal(false);
              setSelectedOrderForDocument(null);
            }}
            onUploadComplete={handleDocumentUploadComplete}
            tripId={selectedOrderForDocument.tripId}
            orderId={selectedOrderForDocument.orderId}
            orderNumber={selectedOrderForDocument.orderNumber}
          />
        </>
      )}
    </div>
  );
}
