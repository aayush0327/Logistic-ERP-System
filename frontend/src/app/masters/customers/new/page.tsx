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
  MapPin,
  Phone,
  Mail,
  Building,
  CreditCard,
  User,
} from "lucide-react";
import {
  useCreateCustomerMutation,
  useGetBranchesQuery,
  useGetBusinessTypesQuery,
} from "@/services/api/companyApi";
import { CustomerCreate } from "@/services/api/companyApi";
import { toast } from "react-hot-toast";

export default function NewCustomerPage() {
  const router = useRouter();
  const { data: branchesData } = useGetBranchesQuery({});

  // Extract branches from paginated response
  const branches = branchesData?.items || [];
  const { data: businessTypes } = useGetBusinessTypesQuery();
  const [createCustomer, { isLoading: isCreating }] =
    useCreateCustomerMutation();

  const [formData, setFormData] = useState<CustomerCreate>({
    home_branch_id: "",
    code: "",
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    business_type: "",
    credit_limit: 0,
    pricing_tier: "standard",
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code?.trim()) {
      newErrors.code = "Customer code is required";
    }
    if (!formData.name?.trim()) {
      newErrors.name = "Customer name is required";
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email address";
    }
    if (formData.phone && !/^[+]?[\d\s-()]+$/.test(formData.phone)) {
      newErrors.phone = "Invalid phone number";
    }
    if (
      formData.postal_code &&
      !/^[a-zA-Z0-9\s-]+$/.test(formData.postal_code)
    ) {
      newErrors.postal_code = "Invalid postal code";
    }
    if (formData.credit_limit && formData.credit_limit < 0) {
      newErrors.credit_limit = "Credit limit must be positive";
    }

    // Only validate business_type if business types are loaded
    if (businessTypes && businessTypes.length > 0 && !formData.business_type) {
      newErrors.business_type = "Please select a business type";
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
      // Clean up the data before sending
      const submitData = {
        ...formData,
        // Ensure empty strings are converted to undefined for optional fields
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        postal_code: formData.postal_code || undefined,
        // For business_type, don't send undefined - let backend handle default or omit entirely
        ...(formData.business_type
          ? { business_type: formData.business_type }
          : {}),
        credit_limit: formData.credit_limit || 0,
        pricing_tier: formData.pricing_tier || "standard",
      };

      // Remove business_type from payload if it's null/empty to avoid enum casting issues
      if (!submitData.business_type) {
        delete submitData.business_type;
      }

      console.log("Submitting customer data:", submitData);
      const newCustomer = await createCustomer(submitData).unwrap();
      toast.success("Customer created successfully");
      router.push(`/masters/customers/${newCustomer.id}`);
    } catch (error: any) {
      console.error("Customer creation error:", error);

      // Show the actual backend error message directly in toast
      const errorMessage =
        error?.data?.detail || error?.message || "Failed to create customer";

      // Show the exact error message from backend in toast
      toast.error(errorMessage);

      // Also set field-specific error for common cases
      if (typeof errorMessage === "string") {
        const lowerMessage = errorMessage.toLowerCase();

        if (
          lowerMessage.includes("customer with this code already exists") ||
          lowerMessage.includes("code already exists")
        ) {
          setErrors((prev) => ({
            ...prev,
            code: "Customer with this code already exists",
          }));
        } else if (lowerMessage.includes("email")) {
          setErrors((prev) => ({
            ...prev,
            email: "Invalid format",
          }));
        } else if (lowerMessage.includes("phone")) {
          setErrors((prev) => ({
            ...prev,
            phone: "Invalid format",
          }));
        }
      }
    }
  };

  const handleInputChange = (
    field: string,
    value: string | boolean | number
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
              <h1 className="text-3xl font-bold text-gray-900">New Customer</h1>
              <p className="text-gray-500">Create a new customer</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Customer Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      handleInputChange("code", e.target.value.toUpperCase())
                    }
                    placeholder="e.g., CUST001"
                    className={errors.code ? "border-red-500" : ""}
                  />
                  {errors.code && (
                    <p className="text-sm text-red-600 mt-1">{errors.code}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="e.g., ABC Corporation"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business_type">Business Type</Label>
                  <select
                    id="business_type"
                    value={formData.business_type}
                    onChange={(e) =>
                      handleInputChange("business_type", e.target.value)
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.business_type
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Business Type</option>
                    {businessTypes?.map((type) => (
                      <option key={type} value={type}>
                        {type.replace("_", " ")}
                      </option>
                    ))}
                    {!businessTypes && (
                      <option value="" disabled>
                        Loading business types...
                      </option>
                    )}
                    {businessTypes && businessTypes.length === 0 && (
                      <option value="" disabled>
                        No business types available
                      </option>
                    )}
                  </select>
                  {errors.business_type && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.business_type}
                    </p>
                  )}
                  {businessTypes && businessTypes.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Business types could not be loaded. You can proceed
                      without selecting one.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="pricing_tier">Pricing Tier</Label>
                  <select
                    id="pricing_tier"
                    value={formData.pricing_tier}
                    onChange={(e) =>
                      handleInputChange("pricing_tier", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    handleInputChange("is_active", checked)
                  }
                />
                <Label>Active Customer</Label>
              </div>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Address Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="Enter complete address"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="e.g., Mumbai"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                    placeholder="e.g., Maharashtra"
                  />
                </div>
                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) =>
                      handleInputChange("postal_code", e.target.value)
                    }
                    placeholder="e.g., 400001"
                    className={errors.postal_code ? "border-red-500" : ""}
                  />
                  {errors.postal_code && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.postal_code}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="home_branch_id">Home Branch</Label>
                <select
                  id="home_branch_id"
                  value={formData.home_branch_id}
                  onChange={(e) =>
                    handleInputChange("home_branch_id", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Home Branch</option>
                  {branches?.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Assign a home branch for this customer
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="w-5 h-5 mr-2" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="e.g., +91 22 1234 5678"
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-600 mt-1">{errors.phone}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="e.g., contact@company.com"
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credit Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Credit Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="credit_limit">Credit Limit ($)</Label>
                <Input
                  id="credit_limit"
                  type="number"
                  min="0"
                  step="100"
                  value={formData.credit_limit}
                  onChange={(e) =>
                    handleInputChange(
                      "credit_limit",
                      parseFloat(e.target.value) || 0
                    )
                  }
                  placeholder="e.g., 10000"
                  className={errors.credit_limit ? "border-red-500" : ""}
                />
                {errors.credit_limit && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.credit_limit}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Set 0 for no credit limit
                </p>
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
                  Create Customer
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
