'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { driverAPI } from '@/lib/api';
import { CurrencyDisplay } from '@/components/CurrencyDisplay';
import {
  Truck, AlertTriangle, RefreshCw
} from 'lucide-react';

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
  driver_id: string;
  status: string;
  origin?: string;
  destination?: string;
  truck_plate: string;
  truck_model?: string;
  capacity_used: number;
  capacity_total: number;
  trip_date: string;
  total_orders: number;
  completed_orders: number;
}

interface DriverTripDetail {
  trip: Trip;
  orders: TripOrder[];
}

export default function DriverDashboard() {
  // State management - Only for active trip
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [tripDetail, setTripDetail] = useState<DriverTripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveringOrderId, setDeliveringOrderId] = useState<string | null>(null);

  // Load data on component mount
  useEffect(() => {
    fetchActiveTrip();
  }, []);

  const fetchActiveTrip = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch only the current active trip
      const tripData = await driverAPI.getCurrentTrip();
      if (tripData) {
        setActiveTrip(tripData);
        // Fetch trip details (orders)
        await fetchTripDetail(tripData.id);
      } else {
        setActiveTrip(null);
        setTripDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load active trip');
    } finally {
      setLoading(false);
    }
  };

  const fetchTripDetail = async (tripId: string) => {
    try {
      // Validate trip ID before making API call
      if (!tripId || tripId === 'undefined' || tripId.trim() === '') {
        console.warn('fetchTripDetail called with invalid trip ID:', tripId);
        setError('Invalid trip ID provided');
        return;
      }

      console.log('Fetching details for trip:', tripId);
      const tripDetail = await driverAPI.getTripDetail(tripId);
      setTripDetail(tripDetail);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching trip details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trip details');
    }
  };

  const markOrderDelivered = async (tripId: string, orderId: string) => {
    try {
      // Validate inputs before making API call
      if (!tripId || tripId === 'undefined' || tripId.trim() === '') {
        console.error('Invalid trip ID:', tripId);
        setError('Invalid trip ID');
        return;
      }
      if (!orderId || orderId === 'undefined' || orderId.trim() === '') {
        console.error('Invalid order ID:', orderId);
        setError('Invalid order ID');
        return;
      }

      // Set loading state for this specific order
      setDeliveringOrderId(orderId);
      setError(null);

      console.log('Marking order as delivered:', { tripId, orderId });
      await driverAPI.markOrderDelivered(tripId, orderId);

      // Refresh active trip and its details
      await fetchActiveTrip();
    } catch (err) {
      console.error('Error marking order as delivered:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark order as delivered');
    } finally {
      // Clear loading state
      setDeliveringOrderId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-black">Driver Dashboard</h1>
            <p className="text-black mt-2">Manage your active trip and deliveries</p>
          </div>
          <button
            onClick={fetchActiveTrip}
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

        {/* Main Content - Active Trip Only */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-black">Loading active trip...</span>
          </div>
        ) : activeTrip ? (
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
                  <span className="font-medium">Route:</span> {activeTrip.origin || 'N/A'} → {activeTrip.destination || 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  <span className="ml-1 px-2 py-1 bg-blue-600 text-white rounded text-xs">
                    OUT FOR DELIVERY
                  </span>
                </div>
                <div>
                  <span className="font-medium">Progress:</span> {activeTrip.completed_orders}/{activeTrip.total_orders} Orders
                </div>
                <div>
                  <span className="font-medium">Capacity:</span> {activeTrip.capacity_used}/{activeTrip.capacity_total} kg
                </div>
                <div>
                  <span className="font-medium">Date:</span> {new Date(activeTrip.trip_date).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Orders for Active Trip */}
            {tripDetail && (
              <div className="border-t border-blue-200 pt-4">
                <h3 className="text-xl font-semibold mb-4 text-black">Delivery Orders (Sequential)</h3>
                <div className="space-y-3">
                  {tripDetail.orders.map((order) => {
                    const isPreviousOrderDelivered = tripDetail.orders
                      .filter(o => o.sequence_number < order.sequence_number)
                      .every(o => o.delivery_status === 'delivered');
                    const canDeliver = order.delivery_status !== 'delivered' && isPreviousOrderDelivered;

                    return (
                      <div key={order.id} className={`border rounded-lg p-4 ${
                        order.delivery_status === 'delivered' ? 'bg-green-50 border-green-200' :
                        canDeliver ? 'bg-yellow-50 border-yellow-300 border-2' :
                        'bg-white border-gray-200'
                      }`}>
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-black text-black">Order #{order.sequence_number + 1} - {order.order_id}</h4>
                          <span className={`px-3 py-1 rounded text-sm font-medium ${
                            order.delivery_status === 'delivered' ? 'bg-green-600 text-white' :
                            'bg-blue-600 text-white'
                          }`}>
                            {order.delivery_status === 'delivered' ? 'DELIVERED' : 'OUT FOR DELIVERY'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-black mb-3">
                          <p>
                            <span className="font-medium">Customer:</span> {order.customer}
                          </p>
                          <p>
                            <span className="font-medium">Items:</span> {order.items || 0} items
                          </p>
                          <p>
                            <span className="font-medium">Weight:</span> {order.weight || 0} kg
                          </p>
                          <p>
                            <span className="font-medium">Total:</span> <CurrencyDisplay amount={order.total || 0} />
                          </p>
                        </div>
                        {order.address && (
                          <p className="text-black mb-3">
                            <span className="font-medium">Address:</span> {order.address}
                          </p>
                        )}
                        <div className="flex justify-end">
                          {order.delivery_status === 'delivered' ? (
                            <span className="text-green-700 font-medium">✓ Already Delivered</span>
                          ) : canDeliver ? (
                            <button
                              onClick={() => {
                                console.log('Button clicked - Active Trip ID:', activeTrip.id, 'Order ID:', order.order_id, 'Order:', order);
                                console.log('Trip details:', activeTrip);
                                console.log('All trip orders:', tripDetail.orders);
                                markOrderDelivered(activeTrip.id, order.order_id);
                              }}
                              disabled={deliveringOrderId === order.order_id}
                              className="px-6 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {deliveringOrderId === order.order_id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  Delivering...
                                </>
                              ) : (
                                'Mark as Delivered'
                              )}
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
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Truck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-black mb-2">No active trip found</h3>
            <p className="text-black">
              You don't have any active trips at the moment. Please check back later.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}