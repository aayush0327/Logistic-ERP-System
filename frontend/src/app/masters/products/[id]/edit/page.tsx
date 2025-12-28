"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  ArrowLeft,
  Save,
  X,
  Package,
  DollarSign,
  Box,
  AlertTriangle,
} from "lucide-react";
import {
  useGetProductQuery,
  useUpdateProductMutation,
  useGetProductCategoriesQuery,
} from "@/services/api/companyApi";
import { ProductCreate } from "@/services/api/companyApi";
import { toast } from "react-hot-toast";

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const { data: product, isLoading, error } = useGetProductQuery(productId);
  const { data: categories } = useGetProductCategoriesQuery({});
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();

  const [formData, setFormData] = useState<Partial<ProductCreate>>({
    category_id: "",
    code: "",
    name: "",
    description: "",
    unit_price: 0,
    special_price: undefined,
    weight: undefined,
    length: undefined,
    width: undefined,
    height: undefined,
    volume: undefined,
    handling_requirements: [],
    min_stock_level: 0,
    max_stock_level: 0,
    current_stock: 0,
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (product) {
      setFormData({
        category_id: product.category_id || "",
        code: product.code || "",
        name: product.name || "",
        description: product.description || "",
        unit_price: product.unit_price || 0,
        special_price: product.special_price,
        weight: product.weight,
        length: product.length,
        width: product.width,
        height: product.height,
        volume: product.volume,
        handling_requirements: product.handling_requirements || [],
        min_stock_level: product.min_stock_level || 0,
        max_stock_level: product.max_stock_level || 0,
        current_stock: product.current_stock || 0,
        is_active: product.is_active,
      });
    }
  }, [product]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code?.trim()) {
      newErrors.code = "Product code is required";
    }
    if (!formData.name?.trim()) {
      newErrors.name = "Product name is required";
    }
    if (!formData.unit_price || formData.unit_price <= 0) {
      newErrors.unit_price = "Unit price must be positive";
    }
    if (formData.special_price && formData.special_price <= 0) {
      newErrors.special_price = "Special price must be positive";
    }
    if (formData.min_stock_level && formData.min_stock_level < 0) {
      newErrors.min_stock_level = "Min stock level must be non-negative";
    }
    if (formData.max_stock_level && formData.max_stock_level < 0) {
      newErrors.max_stock_level = "Max stock level must be positive";
    }
    if (
      formData.min_stock_level &&
      formData.max_stock_level &&
      formData.min_stock_level > formData.max_stock_level
    ) {
      newErrors.max_stock_level =
        "Max stock level must be greater than min stock level";
    }
    if (formData.current_stock && formData.current_stock < 0) {
      newErrors.current_stock = "Current stock must be non-negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    try {
      await updateProduct({
        id: productId,
        product: formData,
      }).unwrap();

      toast.success("Product updated successfully");
      router.push(`/masters/products/${productId}`);
    } catch (error: any) {
      console.error("Product update error:", error);

      // Show the actual backend error message directly in toast
      const errorMessage =
        error?.data?.detail || error?.message || "Failed to update product";

      // Show the exact error message from backend in toast
      toast.error(errorMessage);

      // Also set field-specific error for common cases
      if (typeof errorMessage === "string") {
        const lowerMessage = errorMessage.toLowerCase();

        if (
          lowerMessage.includes("product with this code already exists") ||
          lowerMessage.includes("code already exists")
        ) {
          setErrors((prev) => ({
            ...prev,
            code: "Product with this code already exists",
          }));
        } else if (lowerMessage.includes("name")) {
          setErrors((prev) => ({
            ...prev,
            name: "Invalid format",
          }));
        } else if (lowerMessage.includes("unit price")) {
          setErrors((prev) => ({
            ...prev,
            unit_price: "Invalid price format",
          }));
        } else if (lowerMessage.includes("category")) {
          setErrors((prev) => ({
            ...prev,
            category_id: "Invalid category",
          }));
        }
      }
    }
  };

  const handleInputChange = (
    field: string,
    value: string | boolean | number | string[]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleHandlingRequirementToggle = (requirement: string) => {
    const currentRequirements = formData.handling_requirements || [];
    const newRequirements = currentRequirements.includes(requirement)
      ? currentRequirements.filter((r) => r !== requirement)
      : [...currentRequirements, requirement];
    handleInputChange("handling_requirements", newRequirements);
  };

  if (error) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium">Error loading product</h3>
            <p className="text-red-600 text-sm mt-1">
              The product may not exist or you don't have permission to edit it
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!product) return null;

  const handlingOptions = [
    "fragile",
    "hazardous",
    "refrigerated",
    "perishable",
    "oversized",
    "heavy",
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto inline space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
              <p className="text-gray-500">Update product information</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Product Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      handleInputChange("code", e.target.value.toUpperCase())
                    }
                    placeholder="e.g., PRD001"
                    className={errors.code ? "border-red-500" : ""}
                  />
                  {errors.code && (
                    <p className="text-sm text-red-600 mt-1">{errors.code}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g., Premium Package"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name}</p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="category_id">Category</Label>
                <select
                  id="category_id"
                  value={formData.category_id}
                  onChange={(e) =>
                    handleInputChange("category_id", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  {categories?.items?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Enter product description"
                  rows={4}
                />
              </div>
              <div className="flex items-center space-x-3">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    handleInputChange("is_active", checked)
                  }
                />
                <Label>Active Product</Label>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Pricing Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unit_price">Unit Price ($) *</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      handleInputChange("unit_price", isNaN(value) ? 0 : value);
                    }}
                    placeholder="e.g., 99.99"
                    className={errors.unit_price ? "border-red-500" : ""}
                  />
                  {errors.unit_price && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.unit_price}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="special_price">Special Price ($)</Label>
                  <Input
                    id="special_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.special_price || ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("special_price", 0);
                      } else {
                        const value = parseFloat(e.target.value);
                        handleInputChange(
                          "special_price",
                          isNaN(value) ? 0 : value
                        );
                      }
                    }}
                    placeholder="e.g., 79.99"
                    className={errors.special_price ? "border-red-500" : ""}
                  />
                  {errors.special_price && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.special_price}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Optional: For promotions or specific customers
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Physical Properties */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Box className="w-5 h-5 mr-2" />
                Physical Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.weight || ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("weight", 0);
                      } else {
                        const value = parseFloat(e.target.value);
                        handleInputChange("weight", isNaN(value) ? 0 : value);
                      }
                    }}
                    placeholder="e.g., 5.5"
                  />
                </div>
                <div>
                  <Label htmlFor="volume">Volume (m³)</Label>
                  <Input
                    id="volume"
                    type="number"
                    min="0"
                    step="0.001"
                    value={formData.volume || ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("volume", 0);
                      } else {
                        const value = parseFloat(e.target.value);
                        handleInputChange("volume", isNaN(value) ? 0 : value);
                      }
                    }}
                    placeholder="e.g., 0.125"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="length">Length (cm)</Label>
                  <Input
                    id="length"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.length || ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("length", 0);
                      } else {
                        const value = parseFloat(e.target.value);
                        handleInputChange("length", isNaN(value) ? 0 : value);
                      }
                    }}
                    placeholder="e.g., 50"
                  />
                </div>
                <div>
                  <Label htmlFor="width">Width (cm)</Label>
                  <Input
                    id="width"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.width || ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("width", 0);
                      } else {
                        const value = parseFloat(e.target.value);
                        handleInputChange("width", isNaN(value) ? 0 : value);
                      }
                    }}
                    placeholder="e.g., 30"
                  />
                </div>
                <div>
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.height || ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("height", 0);
                      } else {
                        const value = parseFloat(e.target.value);
                        handleInputChange("height", isNaN(value) ? 0 : value);
                      }
                    }}
                    placeholder="e.g., 20"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Handling Requirements
                </Label>
                <div className="flex flex-wrap gap-2">
                  {handlingOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleHandlingRequirementToggle(option)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        formData.handling_requirements?.includes(option)
                          ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                          : "bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Box className="w-5 h-5 mr-2" />
                Inventory Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="current_stock">Current Stock *</Label>
                  <Input
                    id="current_stock"
                    type="number"
                    min="0"
                    value={formData.current_stock}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      handleInputChange(
                        "current_stock",
                        isNaN(value) ? 0 : value
                      );
                    }}
                    placeholder="e.g., 100"
                    className={errors.current_stock ? "border-red-500" : ""}
                  />
                  {errors.current_stock && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.current_stock}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="min_stock_level">Min Stock Level</Label>
                  <Input
                    id="min_stock_level"
                    type="number"
                    min="0"
                    value={formData.min_stock_level}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      handleInputChange(
                        "min_stock_level",
                        isNaN(value) ? 0 : value
                      );
                    }}
                    placeholder="e.g., 20"
                    className={errors.min_stock_level ? "border-red-500" : ""}
                  />
                  {errors.min_stock_level && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.min_stock_level}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="max_stock_level">Max Stock Level</Label>
                  <Input
                    id="max_stock_level"
                    type="number"
                    min="0"
                    value={formData.max_stock_level}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      handleInputChange(
                        "max_stock_level",
                        isNaN(value) ? 0 : value
                      );
                    }}
                    placeholder="e.g., 500"
                    className={errors.max_stock_level ? "border-red-500" : ""}
                  />
                  {errors.max_stock_level && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.max_stock_level}
                    </p>
                  )}
                </div>
              </div>
              {formData.current_stock &&
                formData.min_stock_level &&
                formData.current_stock <= formData.min_stock_level && (
                  <div className="flex items-center space-x-2 p-3 bg-yellow-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-yellow-700">
                      This product is currently below the minimum stock level
                    </span>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUpdating}
              className="min-w-[120px]"
            >
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
