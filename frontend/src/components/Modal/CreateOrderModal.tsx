"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { v4 as uuidv4 } from "uuid";
import { ModalLayout } from "./ModalLayout";
import { Button } from "@/components/ui/Button";
import { toast } from "react-hot-toast";
import {
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useGetBranchesQuery,
  useGetCustomersQuery,
  useGetProductsQuery,
  Branch,
  Customer,
  Product,
  Order,
} from "@/services/api/ordersApi";
import { Package, Plus, X, Info, User, Weight, Clock, Building2, FileText, Box, TrendingUp, ChevronDown, Search } from "lucide-react";
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
  order?: Order;  // Add this for edit mode
}

// Searchable Select Component
interface SearchableSelectProps<T> {
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: T[];
  getOptionId: (item: T) => string;
  getOptionLabel: (item: T) => string;
  getOptionSearchText?: (item: T) => string;
  disabled?: boolean;
  borderColor?: string;
  focusColor?: string;
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
}

function SearchableSelect<T>({
  label,
  icon,
  iconColor,
  placeholder,
  value,
  onChange,
  options,
  getOptionId,
  getOptionLabel,
  getOptionSearchText = getOptionLabel,
  disabled = false,
  borderColor = "gray",
  focusColor = "green",
  loading = false,
  loadingText = "Loading...",
  emptyText = "No options available",
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => getOptionId(opt) === value);
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : "";

  // Filter options based on search query
  const filteredOptions = options.filter((option) =>
    getOptionSearchText(option).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: T) => {
    onChange(getOptionId(option));
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
        {icon}
        {label} *
      </label>
      <div className="relative">
        {/* Search Icon - always visible */}
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${disabled ? 'text-gray-300' : `${iconColor}`}`} />

        {/* Input/Button */}
        <input
          type="text"
          value={isOpen ? searchQuery : displayValue}
          onChange={(e) => {
            if (!isOpen) setIsOpen(true);
            setSearchQuery(e.target.value);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-10 pr-20 py-3 border-2 text-gray-900 rounded-xl transition-all duration-200 font-semibold focus:outline-none ${
            disabled
              ? "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500"
              : `border-${borderColor}-300 focus:border-${focusColor}-500 focus:ring-4 focus:ring-${focusColor}-500/10 bg-white hover:border-${focusColor}-400 cursor-pointer`
          }`}
        />

        {/* Action Icons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && isOpen && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-gray-100 transition-colors"
              disabled={disabled}
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            disabled={disabled}
          >
            <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''} ${disabled ? 'text-gray-300' : `${iconColor}`}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500 text-sm font-medium">
              {loadingText}
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm font-medium">
              {emptyText}
            </div>
          ) : (
            <div className="py-1">
              {filteredOptions.map((option) => (
                <button
                  type="button"
                  key={getOptionId(option)}
                  onClick={() => handleSelect(option)}
                  className={`w-full px-4 py-3 text-left font-semibold transition-colors ${
                    getOptionId(option) === value
                      ? `bg-${focusColor}-50 text-${focusColor}-700`
                      : "text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {getOptionLabel(option)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CreateOrderModal({
  isOpen,
  onClose,
  onSuccess,
  order,
}: CreateOrderModalProps) {
  const [showBranchNote, setShowBranchNote] = useState(false);
  const lastItemRef = useRef<HTMLDivElement>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    mode: "onChange",
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

  const isFormValid = () => {
    return selectedBranch &&
           watch("customer") &&
           watch("orderNumber") &&
           orderItems.length > 0 &&
           orderItems.every(item => item.productName && item.weight > 0 && item.quantity > 0);
  };

  // Fetch real data from APIs
  const { data: branchesData, isLoading: branchesLoading } = useGetBranchesQuery();
  const { data: customersData, isLoading: customersLoading } = useGetCustomersQuery(
    selectedBranch ? { branch_id: selectedBranch } : {}
  );
  const { data: productsData, isLoading: productsLoading } = useGetProductsQuery(
    selectedBranch ? { branch_id: selectedBranch } : skipToken
  );
  const [createOrder, { isLoading: isCreating }] = useCreateOrderMutation();
  const [updateOrder, { isLoading: isUpdating }] = useUpdateOrderMutation();

  // Determine if we're in edit mode
  const isEditMode = !!order;
  const isLoading = isCreating || isUpdating;

  const branches = branchesData || [];
  const customers = customersData || [];
  const products = productsData || [];

  // Populate form with existing order data when editing
  useEffect(() => {
    if (isEditMode && order) {
      // Populate basic fields
      setValue("orderNumber", order.order_number);
      setValue("branch", order.branch_id);
      setValue("customer", order.customer_id);
      setValue("notes", order.special_instructions || "");

      // Calculate due days from delivery_date
      if (order.delivery_date) {
        const deliveryDate = new Date(order.delivery_date);
        const today = new Date();
        const diffTime = deliveryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setValue("dueDays", diffDays > 0 ? diffDays : 7);
      }

      // Populate order items
      if (order.items && order.items.length > 0) {
        const orderItems = order.items.map((item) => ({
          id: uuidv4(),
          productName: item.product_name || "",
          weight: item.weight || 0,
          quantity: item.quantity || 1,
        }));
        setValue("orderItems", orderItems);
      }
    } else if (isOpen && !isEditMode) {
      // Reset form for create mode
      reset({
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
      });

      // Generate order number after reset
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const uniqueNumber = uuidv4().slice(0, 8).toUpperCase();
      const orderNumber = `ORD-${today}-${uniqueNumber}`;
      setValue("orderNumber", orderNumber);
    }
  }, [isEditMode, order, isOpen, setValue, reset]);

  const calculateItemTotalWeight = (weight: number, quantity: number) => {
    return weight * quantity;
  };

  const calculateTotalUnits = () => {
    return orderItems.reduce((total, item) => total + (item.quantity || 0), 0);
  };

  const calculateTotalWeight = () => {
    return orderItems.reduce(
      (total, item) =>
        total + calculateItemTotalWeight(item.weight || 0, item.quantity || 0),
      0
    );
  };

  const handleBranchSelect = (branchId: string) => {
    if (selectedBranch && selectedBranch !== branchId) {
      setValue("customer", "");
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
    setTimeout(() => setShowBranchNote(false), 3000);
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

    // Scroll to the new item after a short delay to ensure it's rendered
    setTimeout(() => {
      lastItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
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

  const updateOrderItem = (id: string, field: string, value: string | number) => {
    const updatedItems = orderItems.map((item) => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };

        if (field === "productName" && value) {
          const product = products.find((p) => p.name === value);
          if (product && product.weight_type === 'fixed') {
            // Use fixed_weight if available, otherwise fall back to weight (legacy)
            updatedItem.weight = product.fixed_weight || product.weight || 0;
          } else if (product && product.weight_type === 'variable') {
            // Clear weight for variable weight products so user can enter it
            updatedItem.weight = 0;
          }
        }

        return updatedItem;
      }
      return item;
    });
    setValue("orderItems", updatedItems);
  };

  const onSubmit = async (data: OrderFormData) => {
    try {
      const totalWeight = data.orderItems.reduce(
        (sum, item) => sum + item.weight * item.quantity,
        0
      );
      const packageCount = data.orderItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      const items = data.orderItems.map((item) => {
        const product = products.find(
          (p) => p.name === item.productName || p.code === item.productName
        );
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

      const orderData = {
        order_number: data.orderNumber,
        tenant_id: "default-tenant",
        customer_id: data.customer,
        branch_id: data.branch,
        order_type: "delivery" as const,
        priority: "normal" as const,
        total_weight: totalWeight,
        total_volume: totalWeight / 1000,
        package_count: packageCount,
        total_amount: 0,
        payment_type: "cod" as const,
        pickup_date: new Date().toISOString(),
        delivery_date: new Date(
          Date.now() + data.dueDays * 24 * 60 * 60 * 1000
        ).toISOString(),
        due_days: data.dueDays,
        items: items,
        special_instructions: data.notes,
      };

      let result;
      if (isEditMode && order) {
        // Update existing order
        result = await updateOrder({ id: order.id, data: orderData }).unwrap();
        toast.success("Order updated successfully");
      } else {
        // Create new order
        result = await createOrder(orderData).unwrap();
        toast.success("Order created successfully");
      }

      reset();
      onClose();

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error: unknown) {
      console.error(`Failed to ${isEditMode ? "update" : "create"} order:`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to ${isEditMode ? "update" : "create"} order`;
      toast.error(errorMessage);
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

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
      title={isEditMode ? "Edit Order" : "Create New Order"}
      size="xl"
      className="max-h-[90vh] overflow-y-auto m-2 sm:m-4 w-full max-w-6xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Order Information */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3 pb-4 mb-6 border-b-2 border-blue-200">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            Order Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Order Number */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
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
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-100 text-gray-600 font-semibold"
                    placeholder="Auto-generated"
                  />
                )}
              />
            </div>

            {/* Due Days */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
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
                      className="w-full px-4 py-3 pr-12 border-2 text-gray-900 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all duration-200 font-semibold"
                      placeholder="7"
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
                  </div>
                )}
              />
              {errors.dueDays && (
                <p className="text-red-600 text-xs mt-2 font-semibold flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {errors.dueDays.message}
                </p>
              )}
            </div>

            {/* Branch - Searchable Dropdown */}
            <div>
              <Controller
                name="branch"
                control={control}
                render={({ field }) => (
                  <SearchableSelect<Branch>
                    label="Branch"
                    icon={<Building2 className="w-4 h-4 text-green-600" />}
                    iconColor="text-green-400"
                    placeholder="Search branches..."
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      handleBranchSelect(value);
                    }}
                    options={branches}
                    getOptionId={(branch) => branch.id}
                    getOptionLabel={(branch) => branch.name}
                    getOptionSearchText={(branch) => `${branch.name} ${branch.code || ''}`.toLowerCase()}
                    loading={branchesLoading}
                    loadingText="Loading branches..."
                    emptyText="No branches available"
                    borderColor="gray"
                    focusColor="green"
                  />
                )}
              />
              {errors.branch && (
                <p className="text-red-600 text-xs mt-2 font-semibold flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {errors.branch.message}
                </p>
              )}
            </div>

            {/* Customer - Searchable Dropdown */}
            <div>
              <Controller
                name="customer"
                control={control}
                render={({ field }) => (
                  <SearchableSelect<Customer>
                    label="Customer"
                    icon={<User className="w-4 h-4 text-orange-600" />}
                    iconColor="text-orange-400"
                    placeholder="Search customers..."
                    value={field.value}
                    onChange={field.onChange}
                    options={customers}
                    getOptionId={(customer) => customer.id}
                    getOptionLabel={(customer) => customer.name}
                    getOptionSearchText={(customer) => `${customer.name} ${customer.phone || ''}`.toLowerCase()}
                    disabled={!selectedBranch}
                    loading={customersLoading}
                    loadingText="Loading customers..."
                    emptyText="No customers available for this branch"
                    borderColor="gray"
                    focusColor="orange"
                  />
                )}
              />
              {errors.customer && (
                <p className="text-red-600 text-xs mt-2 font-semibold flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {errors.customer.message}
                </p>
              )}
              {selectedBranch && (
                <p className="text-xs text-gray-600 mt-2 font-medium flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Showing customers for{" "}
                  {branches.find((b) => b.id === selectedBranch)?.name}
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-600" />
              Notes (Optional)
            </label>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={3}
                  className="w-full text-gray-900 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                  placeholder="Add any additional notes or special instructions..."
                />
              )}
            />
          </div>
        </div>

        {/* Branch Note */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            showBranchNote
              ? "opacity-100 max-h-32"
              : "opacity-0 max-h-0 overflow-hidden"
          }`}
        >
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-2xl p-5 flex items-start gap-4 shadow-lg">
            <div className="bg-blue-600 p-2 rounded-lg flex-shrink-0">
              <Info className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm text-blue-900 font-medium">
              <strong>Note:</strong> Order status is automatically managed. New
              orders start as Draft and will update to Pending when submitted for approval.
            </p>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              <div className="bg-green-600 p-2 rounded-lg">
                <Box className="w-6 h-6 text-white" />
              </div>
              Order Items
            </h3>
          </div>

          {!selectedBranch && (
            <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl p-5 flex items-center gap-3">
              <Info className="w-6 h-6 text-yellow-700 flex-shrink-0" />
              <p className="text-sm text-yellow-800 font-semibold">
                Please select a branch first to add order items
              </p>
            </div>
          )}

          {orderItems.map((item, index) => (
            <div
              key={item.id}
              ref={index === orderItems.length - 1 ? lastItemRef : null}
              className={`border-2 rounded-xl p-5 space-y-4 mb-4 transition-all duration-200 ${
                selectedBranch
                  ? "border-green-200 bg-white shadow-md hover:shadow-lg"
                  : "border-gray-200 bg-gray-50 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-green-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <span className={`text-sm font-bold ${selectedBranch ? "text-gray-800" : "text-gray-400"}`}>
                    Item {index + 1}
                  </span>
                </div>
                {orderItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOrderItem(item.id)}
                    disabled={!selectedBranch}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      selectedBranch
                        ? "bg-red-100 text-red-600 hover:bg-red-600 hover:text-white cursor-pointer"
                        : "text-gray-300 cursor-not-allowed"
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Product Name - Searchable Dropdown */}
                <div className="sm:col-span-2">
                  <SearchableSelect<Product>
                    label="Product Name"
                    icon={<Package className="w-4 h-4 text-blue-600" />}
                    iconColor="text-blue-400"
                    placeholder="Search products..."
                    value={item.productName}
                    onChange={(value) => updateOrderItem(item.id, "productName", value)}
                    options={products}
                    getOptionId={(product) => product.name}
                    getOptionLabel={(product) => `${product.name} (${product.code})`}
                    getOptionSearchText={(product) => `${product.name} ${product.code || ''}`.toLowerCase()}
                    disabled={!selectedBranch}
                    loading={productsLoading}
                    loadingText="Loading products..."
                    emptyText="No products available for this branch"
                    borderColor="gray"
                    focusColor="blue"
                  />
                </div>

                {/* Weight */}
                <div>
                  <label className={`text-sm font-bold mb-2 flex items-center gap-2 ${selectedBranch ? "text-gray-700" : "text-gray-400"}`}>
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
                        className={`w-full px-4 py-3 rounded-xl border-2 text-gray-900 transition-all duration-200 font-semibold ${
                          selectedBranch
                            ? isFixedWeight
                              ? "border-gray-200 bg-gray-100 text-gray-600 cursor-not-allowed"
                              : "border-gray-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 cursor-text"
                            : "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500"
                        }`}
                        placeholder={selectedBranch ? "0.0" : "Select branch first"}
                      />
                    );
                  })()}
                </div>

                {/* Quantity */}
                <div>
                  <label className={`block text-sm font-bold mb-2 ${selectedBranch ? "text-gray-700" : "text-gray-400"}`}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity || ""}
                    onChange={(e) =>
                      updateOrderItem(item.id, "quantity", Number(e.target.value))
                    }
                    disabled={!selectedBranch}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-gray-900 transition-all duration-200 font-semibold ${
                      selectedBranch
                        ? "border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 cursor-text"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500"
                    }`}
                    placeholder={selectedBranch ? "1" : "Select branch first"}
                  />
                </div>

                {/* Total Weight */}
                <div>
                  <label className={`block text-sm font-bold mb-2 ${selectedBranch ? "text-gray-700" : "text-gray-400"}`}>
                    Total (kg)
                  </label>
                  <input
                    type="text"
                    value={calculateItemTotalWeight(item.weight || 0, item.quantity || 0).toFixed(1)}
                    readOnly
                    disabled={!selectedBranch}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-gray-900 transition-all duration-200 ${
                      selectedBranch
                        ? "border-green-200 bg-green-50 text-green-900 cursor-not-allowed font-bold"
                        : "border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                    }`}
                    placeholder="0.0"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add Item Button - Below items list, aligned right */}
          {selectedBranch && (
            <div className="flex justify-end mb-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOrderItem}
                className="cursor-pointer bg-white border-2 border-green-600 text-green-700 hover:bg-green-600 hover:text-white font-bold transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Item
              </Button>
            </div>
          )}

          {/* Summary Section */}
          {selectedBranch && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-white" />
                  <span className="text-lg font-bold text-white">Order Summary</span>
                </div>
                <div className="flex items-center gap-8 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-blue-200" />
                    <div>
                      <p className="text-xs text-blue-200 font-medium">Total Units</p>
                      <p className="text-2xl font-bold text-white">
                        {calculateTotalUnits()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Weight className="w-5 h-5 text-green-200" />
                    <div>
                      <p className="text-xs text-green-200 font-medium">Total Weight</p>
                      <p className="text-2xl font-bold text-white">
                        {calculateTotalWeight().toFixed(1)} kg
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-4 pt-6 border-t-2 border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="cursor-pointer w-full sm:w-auto order-2 sm:order-1 border-2 border-gray-400 text-gray-700 hover:bg-gray-100 font-bold py-3 px-6 rounded-xl transition-all duration-200"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              !isFormValid() ||
              isLoading ||
              productsLoading ||
              customersLoading
            }
            className="cursor-pointer w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? (isEditMode ? "Updating Order..." : "Creating Order...")
              : productsLoading || customersLoading
              ? "Loading Data..."
              : (isEditMode ? "Update Order" : "Create Order")}
          </Button>
        </div>
      </form>
    </ModalLayout>
  );
}
