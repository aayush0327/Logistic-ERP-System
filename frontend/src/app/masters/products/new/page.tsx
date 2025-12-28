"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Tag,
  DollarSign,
  Box,
  Building,
} from "lucide-react";
import {
  useCreateProductMutation,
  useGetProductCategoriesQuery,
  useGetBranchesQuery,
} from "@/services/api/companyApi";
import { ProductCreate, ProductCategory } from "@/services/api/companyApi";
import { toast } from "react-hot-toast";

export default function NewProductPage() {
  const router = useRouter();
  const { data: categoriesData } = useGetProductCategoriesQuery({});
  const categories = Array.isArray(categoriesData)
    ? categoriesData
    : categoriesData?.items || [];
  const { data: branches } = useGetBranchesQuery({});
  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();

  const [formData, setFormData] = useState<ProductCreate>({
    branch_ids: [],
    available_for_all_branches: true,
    category_id: undefined,
    code: "",
    name: "",
    description: "",
    unit_price: 1, // Default positive value
    special_price: 0,
    weight: 0,
    length: 0,
    width: 0,
    height: 0,
    volume: 0,
    handling_requirements: [],
    min_stock_level: 0,
    max_stock_level: 0,
    current_stock: 0,
    is_active: true,
  } as ProductCreate);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAvailableForAllBranches, setIsAvailableForAllBranches] =
    useState(true);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

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
    if (
      formData.special_price &&
      formData.special_price > 0 &&
      formData.special_price <= 0
    ) {
      newErrors.special_price = "Special price must be positive";
    }
    if (
      formData.min_stock_level !== undefined &&
      formData.min_stock_level < 0
    ) {
      newErrors.min_stock_level = "Min stock level must be non-negative";
    }
    if (
      formData.max_stock_level &&
      formData.max_stock_level > 0 &&
      formData.max_stock_level < 0
    ) {
      newErrors.max_stock_level = "Max stock level must be positive";
    }
    if (
      formData.max_stock_level &&
      formData.min_stock_level !== undefined &&
      formData.min_stock_level > formData.max_stock_level
    ) {
      newErrors.max_stock_level =
        "Max stock level must be greater than min stock level";
    }
    if (formData.current_stock !== undefined && formData.current_stock < 0) {
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
      // Prepare data for API - clean up empty values
      const submitData: Partial<ProductCreate> = {
        code: formData.code,
        name: formData.name,
        unit_price: formData.unit_price,
        min_stock_level: formData.min_stock_level,
        current_stock: formData.current_stock,
        is_active: formData.is_active,
        available_for_all_branches: isAvailableForAllBranches,
        // Only include optional fields if they have meaningful values
        ...(!isAvailableForAllBranches &&
          selectedBranches.length > 0 && { branch_ids: selectedBranches }),
        ...(formData.category_id && { category_id: formData.category_id }),
        ...(formData.description && { description: formData.description }),
        ...(formData.special_price &&
          formData.special_price > 0 && {
            special_price: formData.special_price,
          }),
        ...(formData.weight &&
          formData.weight > 0 && { weight: formData.weight }),
        ...(formData.length &&
          formData.length > 0 && { length: formData.length }),
        ...(formData.width && formData.width > 0 && { width: formData.width }),
        ...(formData.height &&
          formData.height > 0 && { height: formData.height }),
        ...(formData.volume &&
          formData.volume > 0 && { volume: formData.volume }),
        ...(formData.max_stock_level &&
          formData.max_stock_level > 0 && {
            max_stock_level: formData.max_stock_level,
          }),
        ...(formData.handling_requirements &&
          formData.handling_requirements.length > 0 && {
            handling_requirements: formData.handling_requirements,
          }),
      };

      console.log("Submitting product data:", submitData);

      const newProduct = await createProduct(
        submitData as ProductCreate
      ).unwrap();
      toast.success("Product created successfully");
      router.push(`/masters/products/${newProduct.id}`);
    } catch (error: any) {
      console.error("Product creation error:", error);

      // Show the actual backend error message directly in toast
      const errorMessage =
        error?.data?.detail || error?.message || "Failed to create product";

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
              <h1 className="text-3xl font-bold text-gray-900">New Product</h1>
              <p className="text-gray-500">Add a new product to your catalog</p>
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
                  {categories?.map((category: ProductCategory) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  Branch Availability
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="available_for_all_branches"
                      checked={isAvailableForAllBranches}
                      onChange={(e) =>
                        setIsAvailableForAllBranches(e.target.checked)
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label
                      htmlFor="available_for_all_branches"
                      className="text-sm font-medium text-gray-900"
                    >
                      Available for all branches
                    </Label>
                  </div>

                  {!isAvailableForAllBranches && (
                    <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">
                        Select specific branches:
                      </Label>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {branches?.items?.map((branch: any) => (
                          <div
                            key={branch.id}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              id={`branch_${branch.id}`}
                              checked={selectedBranches.includes(branch.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBranches([
                                    ...selectedBranches,
                                    branch.id,
                                  ]);
                                } else {
                                  setSelectedBranches(
                                    selectedBranches.filter(
                                      (id) => id !== branch.id
                                    )
                                  );
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <Label
                              htmlFor={`branch_${branch.id}`}
                              className="text-sm text-gray-900"
                            >
                              {branch.name} ({branch.code})
                            </Label>
                          </div>
                        ))}
                      </div>
                      {selectedBranches.length === 0 && (
                        <p className="text-xs text-amber-600 mt-2">
                          Please select at least one branch
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
                    value={formData.special_price ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("special_price", undefined as any);
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
                    value={formData.weight ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("weight", undefined as any);
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
                    value={formData.volume ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("volume", undefined as any);
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
                    value={formData.length ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("length", undefined as any);
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
                    value={formData.width ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("width", undefined as any);
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
                    value={formData.height ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        handleInputChange("height", undefined as any);
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
              disabled={isCreating}
              className="min-w-[120px]"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Product
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
