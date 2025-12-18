"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { v4 as uuidv4 } from "uuid";
import { ModalLayout } from "./ModalLayout";
import { Button } from "@/components/ui/Button";
import { mockCustomers, mockBranches } from "@/data/mockData";
import {
  Calendar,
  Package,
  Plus,
  X,
  Info,
  User,
  Weight,
  Clock,
} from "lucide-react";

// Mock products for dropdown
const mockProducts = [
  { id: "1", name: "Animal Feed Premium" },
  { id: "2", name: "Animal Feed Standard" },
  { id: "3", name: "Vitamin Supplement" },
  { id: "4", name: "Mineral Mix" },
  { id: "5", name: "Specialized Feed" },
];

// Form validation schema
const orderFormSchema = z.object({
  orderNumber: z.string().min(1, "Order number is required"),
  dueDays: z.number().min(1, "Due days must be at least 1"),
  branch: z.string().min(1, "Branch is required"),
  customer: z.string().min(1, "Customer is required"),
  notes: z.string().optional(),
  orderItems: z
    .array(
      z.object({
        id: z.string(),
        productName: z.string().min(1, "Product name is required"),
        weight: z.number().min(0.1, "Weight must be greater than 0"),
        quantity: z.number().min(1, "Quantity must be at least 1"),
      })
    )
    .min(1, "At least one order item is required"),
});

type OrderFormData = z.infer<typeof orderFormSchema>;

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateOrder: (data: OrderFormData) => void;
}

export function CreateOrderModal({
  isOpen,
  onClose,
  onCreateOrder,
}: CreateOrderModalProps) {
  const [showBranchNote, setShowBranchNote] = useState(false);

  // Generate order number on mount
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const uniqueNumber = uuidv4().slice(0, 8).toUpperCase();
      const orderNumber = `ORD-${today}-${uniqueNumber}`;
      setValue("orderNumber", orderNumber);
    }
  }, [isOpen]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      orderNumber: "",
      dueDays: 7,
      branch: "",
      customer: "",
      notes: "",
      orderItems: [
        {
          id: "1",
          productName: "",
          weight: 0,
          quantity: 1,
        },
      ],
    },
  });

  const selectedBranch = watch("branch");
  const orderItems = watch("orderItems");

  // Calculate total weight for an item
  const calculateItemTotalWeight = (weight: number, quantity: number) => {
    return weight * quantity;
  };

  // Calculate total units across all items
  const calculateTotalUnits = () => {
    return orderItems.reduce((total, item) => total + (item.quantity || 0), 0);
  };

  // Calculate total weight across all items
  const calculateTotalWeight = () => {
    return orderItems.reduce(
      (total, item) =>
        total + calculateItemTotalWeight(item.weight || 0, item.quantity || 0),
      0
    );
  };

  const handleBranchSelect = (branchId: string) => {
    setShowBranchNote(true);
    setTimeout(() => setShowBranchNote(false), 5000); // Hide note after 5 seconds
  };

  const addOrderItem = () => {
    const newItem = {
      id: uuidv4(),
      productName: "",
      weight: 0,
      quantity: 1,
    };
    setValue("orderItems", [...orderItems, newItem]);
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setValue(
        "orderItems",
        orderItems.filter((item) => item.id !== id)
      );
    }
  };

  const updateOrderItem = (id: string, field: string, value: any) => {
    const updatedItems = orderItems.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    setValue("orderItems", updatedItems);
  };

  const onSubmit = (data: OrderFormData) => {
    onCreateOrder(data);
    reset();
    onClose();
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={handleCancel}
      title="Create New Order"
      size="xl"
      className="max-h-[90vh] overflow-y-auto m-4 w-[800px] max-w-[90vw]"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Order Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Order Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Order Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Number *
              </label>
              <Controller
                name="orderNumber"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    placeholder="Auto-generated"
                  />
                )}
              />
            </div>

            {/* Due Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Days *
              </label>
              <Controller
                name="dueDays"
                control={control}
                render={({ field }) => (
                  <div className="relative">
                    <input
                      {...field}
                      type="number"
                      min="1"
                      className="w-full px-3 py-2 pr-10 border text-black border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
                      placeholder="7"
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                )}
              />
              {errors.dueDays && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.dueDays.message}
                </p>
              )}
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch *
              </label>
              <Controller
                name="branch"
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full px-3 py-2 border text-black border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 cursor-pointer"
                    onChange={(e) => {
                      field.onChange(e);
                      handleBranchSelect(e.target.value);
                    }}
                  >
                    <option value="">Select Branch</option>
                    {mockBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.branch && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.branch.message}
                </p>
              )}
            </div>

            {/* Customer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer *
              </label>
              <Controller
                name="customer"
                control={control}
                render={({ field }) => (
                  <div className="relative">
                    <select
                      {...field}
                      className="w-full px-3 text-black py-2 pr-10 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 cursor-pointer appearance-none"
                      disabled={!selectedBranch}
                    >
                      <option value="">Select Customer</option>
                      {mockCustomers.map((customer) => (
                        <option key={customer.id} value={customer.name}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                )}
              />
              {errors.customer && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.customer.message}
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={3}
                  className="w-full text-black px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
                  placeholder="Add any additional notes..."
                />
              )}
            />
          </div>
        </div>

        {/* Branch Note */}
        {showBranchNote && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Order status is automatically managed. New
              orders start as Pending and will automatically update to Loading
              when assigned to a trip, On Route when dispatched, and Delivered
              when complete.
            </p>
          </div>
        )}

        {/* Order Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Items
            </h3>
            {selectedBranch && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOrderItem}
                className="cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
            )}
          </div>

          {!selectedBranch && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Please select a branch first to add order items
              </p>
            </div>
          )}

          {orderItems.map((item, index) => (
            <div
              key={item.id}
              className={`border rounded-lg p-4 space-y-4 transition-all duration-200 ${
                selectedBranch
                  ? "border-gray-200 bg-white"
                  : "border-gray-100 bg-gray-50 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-sm font-medium ${
                    selectedBranch ? "text-gray-700" : "text-gray-400"
                  }`}
                >
                  Item {index + 1}
                </span>
                {orderItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOrderItem(item.id)}
                    disabled={!selectedBranch}
                    className={`transition-colors ${
                      selectedBranch
                        ? "text-red-500 hover:text-red-700 cursor-pointer"
                        : "text-gray-300 cursor-not-allowed"
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Product Name */}
                <div>
                  <label
                    className={`mb-1 flex items-center gap-1 text-sm font-medium ${
                      selectedBranch ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    Product Name *
                  </label>
                  <select
                    value={item.productName}
                    onChange={(e) =>
                      updateOrderItem(item.id, "productName", e.target.value)
                    }
                    disabled={!selectedBranch}
                    className={`w-full px-3 py-2 rounded-lg border text-black placeholder-gray-400 transition-all duration-200 ease-in-out ${
                      selectedBranch
                        ? "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 cursor-pointer"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500"
                    }`}
                  >
                    <option value="">
                      {selectedBranch
                        ? "Select Product"
                        : "Select branch first"}
                    </option>
                    {mockProducts.map((product) => (
                      <option key={product.id} value={product.name}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Weight */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 flex items-center gap-1 ${
                      selectedBranch ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    <Weight className="w-4 h-4" />
                    Weight (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={item.weight || ""}
                    onChange={(e) =>
                      updateOrderItem(item.id, "weight", Number(e.target.value))
                    }
                    disabled={!selectedBranch}
                    className={`w-full px-3 py-2 rounded-lg border text-black placeholder-gray-400 transition-all duration-200 ease-in-out ${
                      selectedBranch
                        ? "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 cursor-text"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500"
                    }`}
                    placeholder={selectedBranch ? "0.0" : "Select branch first"}
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      selectedBranch ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity || ""}
                    onChange={(e) =>
                      updateOrderItem(
                        item.id,
                        "quantity",
                        Number(e.target.value)
                      )
                    }
                    disabled={!selectedBranch}
                    className={`w-full px-3 py-2 rounded-lg border text-black placeholder-gray-400 transition-all duration-200 ease-in-out ${
                      selectedBranch
                        ? "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 cursor-text"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500"
                    }`}
                    placeholder={selectedBranch ? "1" : "Select branch first"}
                  />
                </div>

                {/* Total Weight (calculated) */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      selectedBranch ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    Total Weight (kg)
                  </label>
                  <div
                    className={`w-full px-3 py-2 rounded-lg border transition-all duration-200 ease-in-out ${
                      selectedBranch
                        ? "border-gray-300 bg-gray-50 text-gray-900"
                        : "border-gray-200 bg-gray-100 text-gray-500"
                    }`}
                  >
                    {calculateItemTotalWeight(
                      item.weight || 0,
                      item.quantity || 0
                    ).toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Summary Section */}
          {selectedBranch && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Order Summary
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Units:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {calculateTotalUnits()} units
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Weight:</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {calculateTotalWeight().toFixed(1)} kg
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isValid || !selectedBranch}
            className="cursor-pointer bg-[#1ab052] hover:bg-[#158842]"
          >
            Create Order
          </Button>
        </div>
      </form>
    </ModalLayout>
  );
}
