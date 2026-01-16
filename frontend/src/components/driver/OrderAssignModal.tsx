"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { X, Package } from "lucide-react";
import { Trip, OrderAssignData } from "@/types/common";
import { tmsAPI } from "@/lib/api";
import { useOutsideClick } from "@/components/Hooks/useOutsideClick";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";

interface OrderAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  availableOrders: any[];
  allTrips: Trip[];
  getPriorityVariant: (priority: string) => string;
  getCapacityPercentage: (used: number, total: number) => number;
  getCapacityColor: (percentage: number) => string;
  onOrdersAssigned: () => void;
}

export default function OrderAssignModal({
  isOpen,
  onClose,
  trip,
  availableOrders,
  allTrips,
  getPriorityVariant,
  getCapacityPercentage,
  getCapacityColor,
  onOrdersAssigned,
}: OrderAssignModalProps) {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderPriorityFilter, setOrderPriorityFilter] = useState("all");
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [splitOrder, setSplitOrder] = useState<any | null>(null);
  const [splitItemsCount, setSplitItemsCount] = useState(0);
  const [splitWeight, setSplitWeight] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const splitModalRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close modal
  useOutsideClick(
    modalRef,
    () => {
      if (isOpen && !showSplitOptions) {
        handleClose();
      }
    },
    isOpen && !showSplitOptions
  );

  useOutsideClick(
    splitModalRef,
    () => {
      if (showSplitOptions) {
        handleCloseSplit();
      }
    },
    showSplitOptions
  );

  if (!isOpen || !trip) return null;

  // Check if order is already assigned to any trip
  const isOrderAssigned = (orderId: string) => {
    return allTrips.some((t) => t.orders.some((order) => order.id === orderId));
  };

  // Get available orders for assignment
  const getAvailableOrders = () => {
    return availableOrders.filter((order) => {
      const isApproved = order.status === "approved";
      const isNotAssigned = !isOrderAssigned(order.id);
      const matchesSearch =
        order.customer.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(orderSearchTerm.toLowerCase());
      const matchesPriority =
        orderPriorityFilter === "all" || order.priority === orderPriorityFilter;

      return isApproved && isNotAssigned && matchesSearch && matchesPriority;
    });
  };

  const calculateTotalWeight = (orderIds: string[]) => {
    return orderIds.reduce((total, orderId) => {
      const order = availableOrders.find((o) => o.id === orderId);
      return total + (order?.weight || 0);
    }, 0);
  };

  const handleOrderToggle = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleClose = () => {
    setSelectedOrders([]);
    setOrderSearchTerm("");
    setOrderPriorityFilter("all");
    onClose();
  };

  const handleCloseSplit = () => {
    setShowSplitOptions(false);
    setSplitOrder(null);
    setSplitItemsCount(0);
    setSplitWeight(0);
  };

  const handleSplitOrder = (order: any) => {
    if (!trip) return;

    const availableCapacity =
      (trip.capacityTotal || 0) - (trip.capacityUsed || 0);

    if (availableCapacity <= 0) {
      alert("No available capacity to split this order!");
      return;
    }

    // Set the order and initialize with maximum possible items
    const itemsPerWeight = order.weight / order.items;
    const maxItemsThatFit = Math.floor(availableCapacity / itemsPerWeight);
    const maxItems = Math.min(maxItemsThatFit, order.items);

    setSplitOrder(order);
    setSplitItemsCount(maxItems > 0 ? maxItems : 1);
    setSplitWeight(
      Math.round((order.weight / order.items) * (maxItems > 0 ? maxItems : 1))
    );
    setShowSplitOptions(true);
  };

  const handleConfirmSplit = async () => {
    if (!splitOrder || !trip) return;

    try {
      // Get items_data from the order - this contains order_item details with order_item_id
      // The order should have items_data (from TMS resources endpoint)
      const itemsData = splitOrder.items_data || splitOrder.items_json || splitOrder.items || [];
      const itemsArray = Array.isArray(itemsData) ? itemsData : [];

      // Calculate per-unit values
      const weightPerUnit = splitOrder.weight / splitOrder.items;
      const pricePerUnit = splitOrder.total / splitOrder.items;
      const volumePerUnit = (splitOrder.volume || 0) / splitOrder.items;

      // Build items_json with the partial assignment - CRITICAL for trip_item_assignments
      const itemsJson = itemsArray.map((item: any) => ({
        id: item.id,  // order_item_id - CRITICAL for trip_item_assignments
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: splitItemsCount,  // Partial quantity being assigned
        original_quantity: splitItemsCount,  // Original for THIS assignment
        weight: weightPerUnit,  // Per-unit weight
        total_weight: weightPerUnit * splitItemsCount,  // Total for this partial
        volume: volumePerUnit,
        total_volume: volumePerUnit * splitItemsCount,
        unit_price: pricePerUnit,
        total_price: pricePerUnit * splitItemsCount,
      }));

      // Build remaining_items_json with the unassigned portion
      const remainingItemsJson = itemsArray.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: splitOrder.items - splitItemsCount,  // Remaining quantity
        original_quantity: item.original_quantity || splitOrder.items,  // True original
        weight: weightPerUnit,
        total_weight: weightPerUnit * (splitOrder.items - splitItemsCount),
        volume: volumePerUnit,
        total_volume: volumePerUnit * (splitOrder.items - splitItemsCount),
      }));

      // Create split order data - use ORIGINAL order_id (not -SPLIT)
      const splitOrderData = {
        order_id: splitOrder.id,  // Use ORIGINAL order ID (not -SPLIT)
        customer: splitOrder.customer,
        customerAddress: splitOrder.customerAddress,
        total: Math.round(pricePerUnit * splitItemsCount),
        weight: splitWeight,
        volume: Math.round(volumePerUnit * splitItemsCount),
        items: splitItemsCount,
        priority: splitOrder.priority,
        address: splitOrder.address,
        original_order_id: splitOrder.id,
        original_items: splitOrder.items,
        original_weight: splitOrder.weight,
        items_json: itemsJson,  // CRITICAL: Send items_json with order_item_id
        remaining_items_json: remainingItemsJson,  // CRITICAL: Send remaining items
      };

      // Assign split order to trip
      await tmsAPI.assignOrdersToTrip(trip.id, [splitOrderData]);

      // Show success message
      const remainingItems = splitOrder.items - splitItemsCount;
      alert(
        `Successfully assigned ${splitItemsCount} items. ${remainingItems} items remaining.`
      );

      // Reset split state and close modals
      handleCloseSplit();
      handleClose();

      // Refresh trips
      onOrdersAssigned();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to split order");
    }
  };

  const handleAssignOrders = async () => {
    if (!trip || selectedOrders.length === 0) return;

    try {
      // Prepare orders data
      const ordersData: OrderAssignData[] = [];
      selectedOrders.forEach((orderId) => {
        const order = availableOrders.find((o) => o.id === orderId);
        if (order) {
          ordersData.push({
            order_id: order.id,
            customer: order.customer,
            customerAddress: order.customerAddress,
            total: order.total,
            weight: order.weight,
            volume: order.volume,
            items: order.items,
            priority: order.priority,
            address: order.address,
          });
        }
      });

      // Check capacity
      const newCapacityUsed =
        (trip.capacityUsed || 0) + calculateTotalWeight(selectedOrders);
      if (newCapacityUsed > (trip.capacityTotal || 0)) {
        if (
          !confirm(
            "Warning: Adding these orders will exceed the truck capacity. Do you want to continue?"
          )
        ) {
          return;
        }
      }

      // Assign orders via API
      await tmsAPI.assignOrdersToTrip(trip.id, ordersData);

      // Refresh trips
      onOrdersAssigned();

      // Close modal and reset
      handleClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign orders");
    }
  };

  return (
    <>
      {/* Order Assignment Modal */}
      <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
        <div
          ref={modalRef}
          className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-black">
                  Add Orders to Trip
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Trip: <span className="font-medium">{trip.id}</span> • Truck:{" "}
                  <span className="font-medium">{trip.truck?.plate}</span> •
                  Capacity:{" "}
                  <span className="font-medium">{trip.capacityTotal}kg</span>
                </p>
              </div>
              <Button
                onClick={handleClose}
                variant="outline"
                size="sm"
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="px-6 py-6">
            {/* Capacity Summary */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Current Capacity Used</p>
                  <p className="text-lg font-semibold text-black">
                    {trip.capacityUsed || 0}kg
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    Selected Orders Weight
                  </p>
                  <p className="text-lg font-semibold text-blue-600">
                    {calculateTotalWeight(selectedOrders)}kg
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    Total After Assignment
                  </p>
                  <p
                    className={`text-lg font-semibold ${
                      (trip.capacityUsed || 0) +
                        calculateTotalWeight(selectedOrders) >
                      (trip.capacityTotal || 0)
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {(trip.capacityUsed || 0) +
                      calculateTotalWeight(selectedOrders)}
                    kg
                  </p>
                </div>
              </div>
              {(trip.capacityTotal || 0) > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${getCapacityColor(
                        getCapacityPercentage(
                          (trip.capacityUsed || 0) +
                            calculateTotalWeight(selectedOrders),
                          trip.capacityTotal || 0
                        )
                      )}`}
                      style={{
                        width: `${Math.min(
                          getCapacityPercentage(
                            (trip.capacityUsed || 0) +
                              calculateTotalWeight(selectedOrders),
                            trip.capacityTotal || 0
                          ),
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {getCapacityPercentage(
                      (trip.capacityUsed || 0) +
                        calculateTotalWeight(selectedOrders),
                      trip.capacityTotal || 0
                    )}
                    % capacity used
                  </p>
                </div>
              )}
            </div>

            {/* Available Orders List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-black">
                  Available Orders
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                  />
                  <select
                    value={orderPriorityFilter}
                    onChange={(e) => setOrderPriorityFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Priority</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>
              {getAvailableOrders().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No available orders to assign</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getAvailableOrders().map((order) => {
                    const wouldExceedCapacity =
                      (trip.capacityUsed || 0) +
                        calculateTotalWeight([...selectedOrders, order.id]) >
                      (trip.capacityTotal || 0);
                    return (
                      <div
                        key={order.id}
                        onClick={(e) => {
                          // Don't toggle if clicking on the Split button or checkbox
                          const target = e.target as HTMLElement;
                          if (
                            target.closest("button") ||
                            target.closest('input[type="checkbox"]')
                          ) {
                            return;
                          }
                          // Only toggle if order doesn't exceed capacity
                          if (!wouldExceedCapacity) {
                            handleOrderToggle(order.id);
                          }
                        }}
                        className={`p-4 border rounded-lg transition-all ${
                          selectedOrders.includes(order.id)
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        } ${
                          wouldExceedCapacity
                            ? "border-orange-400"
                            : "cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              checked={selectedOrders.includes(order.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                if (!wouldExceedCapacity) {
                                  handleOrderToggle(order.id);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              disabled={wouldExceedCapacity}
                              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                            />
                            <div>
                              <p className="font-medium text-black">
                                {order.id}
                              </p>
                              <p className="text-sm text-gray-600">
                                {order.customer}
                              </p>
                              <p className="text-xs text-gray-500">
                                {order.address}
                              </p>
                              {wouldExceedCapacity && (
                                <span className="text-xs text-orange-600 font-medium">
                                  ⚠️ Exceeds capacity!
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
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
                            <div className="text-right text-sm">
                              <p className="font-medium text-black">
                                {order.weight}kg
                              </p>
                              <p className="text-gray-600">
                                {order.items} items
                              </p>
                            </div>
                            {wouldExceedCapacity && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSplitOrder(order);
                                }}
                                className="text-xs"
                              >
                                Split
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex justify-between">
              <Button
                onClick={handleClose}
                variant="outline"
                className="text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignOrders}
                disabled={selectedOrders.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Assign {selectedOrders.length} Order
                {selectedOrders.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Split Order Confirmation Modal */}
      {showSplitOptions && splitOrder && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            ref={splitModalRef}
            className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto"
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-black">Split Order</h2>
                <Button
                  onClick={handleCloseSplit}
                  variant="outline"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-orange-800 mb-2">
                  Order Too Large for Trip
                </h3>
                <p className="text-sm text-orange-700">
                  This order exceeds the remaining capacity of the trip. Select
                  how many items to assign to this trip.
                </p>
              </div>

              {/* Original Order Details */}
              <div className="mb-6">
                <h4 className="font-semibold text-black mb-3">
                  Original Order Details
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order ID:</span>
                    <span className="font-medium text-black">
                      {splitOrder.id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium text-black">
                      {splitOrder.customer}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Items:</span>
                    <span className="font-medium text-black">
                      {splitOrder.items} items
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Weight:</span>
                    <span className="font-medium text-black">
                      {splitOrder.weight} kg
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Value:</span>
                    <span className="font-medium text-black">
                      <CurrencyDisplay amount={splitOrder.total} />
                    </span>
                  </div>
                </div>
              </div>

              {/* Split Selection */}
              <div className="mb-6">
                <h4 className="font-semibold text-black mb-3">
                  Select Split Amount
                </h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  {(() => {
                    const availableCapacity =
                      (trip.capacityTotal || 0) - (trip.capacityUsed || 0);
                    const maxItemsThatFit = Math.floor(
                      availableCapacity / (splitOrder.weight / splitOrder.items)
                    );
                    const maxPossibleItems = Math.min(
                      maxItemsThatFit,
                      splitOrder.items
                    );
                    const itemsPerKg = splitOrder.weight / splitOrder.items;
                    const remainingItems = splitOrder.items - splitItemsCount;
                    const remainingWeight = splitOrder.weight - splitWeight;
                    const splitValue = Math.round(
                      (splitOrder.total / splitOrder.items) * splitItemsCount
                    );

                    return (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Items to Assign (Max: {maxPossibleItems})
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={maxPossibleItems}
                            value={splitItemsCount}
                            onChange={(e) => {
                              const items = Math.min(
                                Math.max(1, parseInt(e.target.value) || 1),
                                maxPossibleItems
                              );
                              setSplitItemsCount(items);
                              setSplitWeight(Math.round(items * itemsPerKg));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-white p-3 rounded border">
                            <p className="text-gray-600 mb-1">This Trip</p>
                            <p className="font-medium text-black">
                              {splitItemsCount} items
                            </p>
                            <p className="font-medium text-black">
                              {splitWeight} kg
                            </p>
                            <p className="font-medium text-black">
                              <CurrencyDisplay amount={splitValue} />
                            </p>
                          </div>
                          <div className="bg-orange-50 p-3 rounded border border-orange-200">
                            <p className="text-gray-600 mb-1">Remaining</p>
                            <p className="font-medium text-orange-600">
                              {remainingItems} items
                            </p>
                            <p className="font-medium text-orange-600">
                              {remainingWeight} kg
                            </p>
                            <p className="font-medium text-orange-600">
                              <CurrencyDisplay amount={splitOrder.total - splitValue} />
                            </p>
                          </div>
                        </div>

                        {maxPossibleItems >= splitOrder.items && (
                          <div className="text-sm text-green-600 font-medium">
                            ✓ Full order can fit in this trip
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Trip Capacity After Assignment */}
              <div className="mb-6">
                <h4 className="font-semibold text-black mb-3">
                  Trip Capacity After Assignment
                </h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  {(() => {
                    const newCapacityUsed =
                      (trip.capacityUsed || 0) + splitWeight;
                    const capacityPercentage = trip.capacityTotal
                      ? Math.round((newCapacityUsed / trip.capacityTotal) * 100)
                      : 0;

                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            New Capacity Used:
                          </span>
                          <span className="font-medium text-green-600">
                            {newCapacityUsed} kg
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Utilization:</span>
                          <span className="font-medium text-green-600">
                            {capacityPercentage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                          <div
                            className={`h-2 rounded-full ${
                              capacityPercentage >= 100
                                ? "bg-red-500"
                                : capacityPercentage >= 80
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            }`}
                            style={{
                              width: `${Math.min(capacityPercentage, 100)}%`,
                            }}
                          />
                        </div>
                        {capacityPercentage > 100 && (
                          <p className="text-xs text-red-600 mt-1">
                            ⚠️ Over capacity!
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {splitItemsCount < splitOrder.items && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> {splitOrder.items - splitItemsCount}{" "}
                    items will remain for assignment to another trip.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl">
              <div className="flex justify-between">
                <Button
                  onClick={handleCloseSplit}
                  variant="outline"
                  className="text-gray-700 border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmSplit}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Split and Assign {splitItemsCount} Items
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
