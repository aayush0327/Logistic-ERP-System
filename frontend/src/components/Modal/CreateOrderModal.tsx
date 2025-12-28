"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { v4 as uuidv4 } from "uuid";
import { ModalLayout } from "./ModalLayout";
import { Button } from "@/components/ui/Button";
import { toast } from "react-hot-toast";
import {
  useCreateOrderMutation,
  useGetBranchesQuery,
  useGetCustomersQuery,
  useGetProductsQuery,
} from "@/services/api/ordersApi";
import { Package, Plus, X, Info, User, Weight, Clock } from "lucide-react";
import { skipToken } from "@reduxjs/toolkit/query";

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
  onSuccess?: (order: any) => void;
}

export function CreateOrderModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateOrderModalProps) {
  const [showBranchNote, setShowBranchNote] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isValid },
    reset,
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    mode: "onChange", // Enable validation on change
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

  // Check if form has all required fields filled
  const isFormValid = () => {
    return selectedBranch &&
           watch("customer") &&
           watch("orderNumber") &&
           orderItems.length > 0 &&
           orderItems.every(item => item.productName && item.weight > 0 && item.quantity > 0);
  };

  // Fetch real data from APIs
  const { data: branchesData, isLoading: branchesLoading } =
    useGetBranchesQuery();
  const { data: customersData, isLoading: customersLoading } =
    useGetCustomersQuery(selectedBranch ? { branch_id: selectedBranch } : {});

  const { data: productsData, isLoading: productsLoading } =
    useGetProductsQuery(
      selectedBranch ? { branch_id: selectedBranch } : skipToken
    );
  const [createOrder, { isLoading: isCreating }] = useCreateOrderMutation();

  const branches = branchesData || [];
  const customers = customersData || [];
  const products = productsData || [];

  // Generate order number on mount
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const uniqueNumber = uuidv4().slice(0, 8).toUpperCase();
      const orderNumber = `ORD-${today}-${uniqueNumber}`;
      setValue("orderNumber", orderNumber);
    }
  }, [isOpen]);

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
    // Reset customer selection when branch changes
    if (selectedBranch && selectedBranch !== branchId) {
      setValue("customer", "");
      // Reset all order items
      setValue("orderItems", [
        {
          id: "1",
          productName: "",
          weight: 0,
          quantity: 1,
        },
      ]);
    }
    setShowBranchNote(true);
    setTimeout(() => setShowBranchNote(false), 3000); // Hide note after 3 seconds
  };

  const addOrderItem = () => {
    const newItem = {
      id: uuidv4(),
      productName: "",
      weight: 0,
      quantity: 1,
    };
    setValue("orderItems", [...orderItems, newItem], {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setValue(
        "orderItems",
        orderItems.filter((item) => item.id !== id),
        {
          shouldValidate: true,
          shouldDirty: true,
        }
      );
    }
  };

  const updateOrderItem = (id: string, field: string, value: any) => {
    const updatedItems = orderItems.map((item) => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };

        // Auto-fill weight when product is selected (only for fixed weight products)
        if (field === "productName" && value) {
          const product = products.find((p) => p.name === value);
          if (product && product.weight_type === 'fixed' && product.weight) {
            updatedItem.weight = product.weight; // Auto-fill only for fixed weight products
          }
          // For variable weight products, leave weight empty so user can enter it
        }

        return updatedItem;
      }
      return item;
    });
    setValue("orderItems", updatedItems);
  };

  const onSubmit = async (data: OrderFormData) => {
    try {
      // Calculate totals
      const totalWeight = data.orderItems.reduce(
        (sum, item) => sum + item.weight * item.quantity,
        0
      );
      const packageCount = data.orderItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      // Prepare order items with product IDs
      const items = data.orderItems.map((item) => {
        const product = products.find(
          (p) => p.name === item.productName || p.code === item.productName
        );
        // Use user-entered weight if provided (for variable weight products),
        // otherwise fall back to product weight (for fixed weight products)
        const itemWeight = item.weight !== undefined && item.weight > 0
          ? item.weight
          : (product?.weight || 0);

        return {
          product_id: product?.id || item.productName,
          quantity: item.quantity,
          unit_price: product?.unit_price || 0,
          weight: itemWeight,
        };
      });

      // Create order data
      const orderData = {
        order_number: data.orderNumber,
        tenant_id: "default-tenant",
        customer_id: data.customer,
        branch_id: data.branch,
        order_type: "delivery" as const,
        priority: "normal" as const,
        total_weight: totalWeight,
        total_volume: totalWeight / 1000, // rough estimate
        package_count: packageCount,
        total_amount: 0, // Will be calculated based on items
        payment_type: "cod" as const,
        pickup_date: new Date().toISOString(),
        delivery_date: new Date(
          Date.now() + data.dueDays * 24 * 60 * 60 * 1000
        ).toISOString(),
        items: items,
        special_instructions: data.notes,
      };

      const createdOrder = await createOrder(orderData).unwrap();
      toast.success("Order created successfully");

      // Reset form and close modal
      reset();
      onClose();

      // Call success callback with the created order
      if (onSuccess) {
        onSuccess(createdOrder);
      }
    } catch (error: any) {
      console.error("Failed to create order:", error);
      toast.error(error.message || "Failed to create order");
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  // Reset branch note when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setShowBranchNote(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ModalLayout
      isOpen={isOpen}
      onClose={handleCancel}
      title="Create New Order"
      size="xl"
      className="max-h-[85vh] overflow-y-auto m-2 sm:m-4 w-full max-w-4xl min-h-[600px]"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Order Information */}
        <div className="space-y-4 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 pb-2 border-b">
            <Package className="w-5 h-5 text-blue-600" />
            Order Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
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
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
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
                      {customersLoading ? (
                        <option disabled>Loading customers...</option>
                      ) : customers.length === 0 ? (
                        <option disabled>
                          No customers available for this branch
                        </option>
                      ) : (
                        customers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))
                      )}
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
              {selectedBranch && (
                <p className="text-xs text-gray-500 mt-1">
                  Showing customers for{" "}
                  {branches.find((b) => b.id === selectedBranch)?.name}
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
        <div
          className={`transition-all duration-300 ease-in-out ${
            showBranchNote
              ? "opacity-100 max-h-24 mb-6"
              : "opacity-0 max-h-0 overflow-hidden"
          }`}
        >
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Order status is automatically managed. New
              orders start as Pending and will automatically update to Loading
              when assigned to a trip, On Route when dispatched, and Delivered
              when complete.
            </p>
          </div>
        </div>

        {/* Order Items */}
        <div className="space-y-4 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Order Items
            </h3>
            {selectedBranch && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOrderItem}
                className="cursor-pointer w-full sm:w-auto"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Product Name */}
                <div className="sm:col-span-2">
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
                    {productsLoading ? (
                      <option disabled>Loading products...</option>
                    ) : products.length === 0 ? (
                      <option disabled>
                        No products available for this branch
                      </option>
                    ) : (
                      products.map((product) => (
                        <option key={product.id} value={product.name}>
                          {product.name} ({product.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Weight - read-only for fixed weight products */}
                <div>
                  <label
                    className={`text-sm font-medium mb-1 flex items-center gap-1 ${
                      selectedBranch ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    <Weight className="w-4 h-4" />
                    Weight (kg) *
                  </label>
                  {(() => {
                    const selectedProduct = products.find((p) => p.name === item.productName);
                    const isFixedWeight = selectedProduct?.weight_type === 'fixed';
                    return (
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={item.weight || ""}
                        onChange={(e) =>
                          updateOrderItem(item.id, "weight", Number(e.target.value))
                        }
                        disabled={!selectedBranch || isFixedWeight}
                        readOnly={isFixedWeight}
                        className={`w-full px-3 py-2 rounded-lg border text-black placeholder-gray-400 transition-all duration-200 ease-in-out ${
                          selectedBranch
                            ? isFixedWeight
                              ? "border-gray-200 bg-gray-100 text-gray-600 cursor-not-allowed"
                              : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 cursor-text"
                            : "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500"
                        }`}
                        placeholder={selectedBranch ? "0.0" : "Select branch first"}
                      />
                    );
                  })()}
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

                {/* Total Weight (read-only display) */}
                <div>
                  <label
                    className={`block text-sm font-medium mb-1 ${
                      selectedBranch ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    Total (kg)
                  </label>
                  <input
                    type="text"
                    value={calculateItemTotalWeight(item.weight || 0, item.quantity || 0).toFixed(1)}
                    readOnly
                    disabled={!selectedBranch}
                    className={`w-full px-3 py-2 rounded-lg border text-black placeholder-gray-400 transition-all duration-200 ease-in-out ${
                      selectedBranch
                        ? "border-gray-200 bg-gray-50 text-gray-900 cursor-not-allowed font-semibold"
                        : "border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                    }`}
                    placeholder="0.0"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Summary Section */}
          {selectedBranch && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">Order Summary</span>
                </div>
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Total Units:</span>
                    <span className="text-base font-bold text-blue-600">
                      {calculateTotalUnits()} Packages
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Total Weight:</span>
                    <span className="text-base font-bold text-green-600">
                      {calculateTotalWeight().toFixed(1)} kg
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 border-t bg-gray-50 rounded-lg p-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="cursor-pointer w-full sm:w-auto order-2 sm:order-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              !isFormValid() ||
              isCreating ||
              productsLoading ||
              customersLoading
            }
            className="cursor-pointer w-full sm:w-auto order-1 sm:order-2 bg-[#1ab052] hover:bg-[#158842] disabled:opacity-50"
          >
            {isCreating
              ? "Creating..."
              : productsLoading || customersLoading
              ? "Loading..."
              : "Create Order"}
          </Button>
        </div>
      </form>
    </ModalLayout>
  );
}
