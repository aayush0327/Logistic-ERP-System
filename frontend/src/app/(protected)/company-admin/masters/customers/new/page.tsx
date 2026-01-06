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
  Megaphone,
} from "lucide-react";
import {
  useCreateCustomerMutation,
  useGetBranchesQuery,
  useGetAllBusinessTypesQuery,
} from "@/services/api/companyApi";
import { CustomerCreate, BusinessTypeModel } from "@/services/api/companyApi";
import { toast } from "react-hot-toast";

export default function NewCustomerPage() {
  const router = useRouter();
  const { data: branchesData } = useGetBranchesQuery({});

  // Extract branches from paginated response
  const branches = branchesData?.items || [];
  const { data: businessTypesData } = useGetAllBusinessTypesQuery({
    is_active: true,
  });

  // Handle both array and paginated response formats
  const businessTypes: BusinessTypeModel[] = Array.isArray(businessTypesData)
    ? businessTypesData
    : businessTypesData?.items || [];

  const [createCustomer, { isLoading: isCreating }] =
    useCreateCustomerMutation();

  const [formData, setFormData] = useState<CustomerCreate>({
    branch_ids: [],
    available_for_all_branches: true,
    code: "",
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    business_type: "", // Deprecated - old enum
    business_type_id: "", // Deprecated - single business type
    business_type_ids: [], // New - multiple business types
    credit_limit: 0,
    pricing_tier: "standard",
    is_active: true,
    marketing_person_name: "",
    marketing_person_phone: "",
    marketing_person_email: "",
  } as CustomerCreate);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAvailableForAllBranches, setIsAvailableForAllBranches] =
    useState(true);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>([]);

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
    if (
      formData.marketing_person_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.marketing_person_email)
    ) {
      newErrors.marketing_person_email = "Invalid email address";
    }
    if (
      formData.marketing_person_phone &&
      !/^[+]?[\d\s-()]+$/.test(formData.marketing_person_phone)
    ) {
      newErrors.marketing_person_phone = "Invalid phone number";
    }

    // Validate branches if not available for all
    if (!isAvailableForAllBranches && selectedBranches.length === 0) {
      newErrors.branches = "Please select at least one branch";
    }

    // Validate business_type_ids if business types are loaded
    if (
      businessTypes &&
      businessTypes.length > 0 &&
      selectedBusinessTypes.length === 0
    ) {
      newErrors.business_type_ids = "Please select at least one business type";
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
        // Use business_type_ids instead of business_type_id
        ...(selectedBusinessTypes.length > 0
          ? { business_type_ids: selectedBusinessTypes }
          : {}),
        credit_limit: formData.credit_limit || 0,
        pricing_tier: formData.pricing_tier || "standard",
        // Branch availability
        available_for_all_branches: isAvailableForAllBranches,
        // Only include branch_ids if not available for all branches
        ...(!isAvailableForAllBranches &&
          selectedBranches.length > 0 && { branch_ids: selectedBranches }),
      };

      // Remove deprecated business_type_id from payload if it's null/empty
      if (
        submitData.business_type_id === null ||
        submitData.business_type_id === undefined ||
        submitData.business_type_id === ""
      ) {
        delete submitData.business_type_id;
      }

      console.log("Submitting customer data:", submitData);
      const newCustomer = await createCustomer(submitData).unwrap();
      toast.success("Customer created successfully");
      router.push(`/company-admin/masters/customers/${newCustomer.id}`);
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
                <Label>Business Types</Label>
                {/* Selected Business Types - shown as chips with remove button */}
                {selectedBusinessTypes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedBusinessTypes.map((btId) => {
                      const bt = businessTypes.find((t) => t.id === btId);
                      if (!bt) return null;
                      return (
                        <span
                          key={bt.id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                        >
                          {bt.name}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedBusinessTypes(
                                selectedBusinessTypes.filter((id) => id !== bt.id)
                              )
                            }
                            className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* Dropdown to add business types */}
                <div className="mt-2">
                  <select
                    value=""
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value && !selectedBusinessTypes.includes(value)) {
                        setSelectedBusinessTypes([...selectedBusinessTypes, value]);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={selectedBusinessTypes.length === businessTypes.length}
                  >
                    <option value="" disabled>
                      {businessTypes.length === 0
                        ? "No business types available"
                        : selectedBusinessTypes.length === businessTypes.length
                        ? "All business types selected"
                        : "Select a business type"}
                    </option>
                    {businessTypes
                      .filter((bt) => !selectedBusinessTypes.includes(bt.id))
                      .map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                  </select>
                  {businessTypes.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      <a
                        href="/company-admin/masters/business-types"
                        className="text-blue-600 hover:underline"
                      >
                        Create business types
                      </a>{" "}
                      to categorize your customers.
                    </p>
                  )}
                </div>
                {errors.business_type_ids && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.business_type_ids}
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
                  className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            {/* Branch Availability - Same pattern as products */}
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
                      {branches?.map((branch: any) => (
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

        {/* Marketing Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Megaphone className="w-5 h-5 mr-2" />
              Marketing Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="marketing_person_name">Marketing Person Name</Label>
                <Input
                  id="marketing_person_name"
                  type="text"
                  value={formData.marketing_person_name}
                  onChange={(e) => handleInputChange("marketing_person_name", e.target.value)}
                  placeholder="e.g., John Smith"
                />
              </div>
              <div>
                <Label htmlFor="marketing_person_phone">Marketing Person Phone</Label>
                <Input
                  id="marketing_person_phone"
                  type="tel"
                  value={formData.marketing_person_phone}
                  onChange={(e) => handleInputChange("marketing_person_phone", e.target.value)}
                  placeholder="e.g., +91 98765 43210"
                  className={errors.marketing_person_phone ? "border-red-500" : ""}
                />
                {errors.marketing_person_phone && (
                  <p className="text-sm text-red-600 mt-1">{errors.marketing_person_phone}</p>
                )}
              </div>
              <div>
                <Label htmlFor="marketing_person_email">Marketing Person Email</Label>
                <Input
                  id="marketing_person_email"
                  type="email"
                  value={formData.marketing_person_email}
                  onChange={(e) => handleInputChange("marketing_person_email", e.target.value)}
                  placeholder="e.g., marketing@company.com"
                  className={errors.marketing_person_email ? "border-red-500" : ""}
                />
                {errors.marketing_person_email && (
                  <p className="text-sm text-red-600 mt-1">{errors.marketing_person_email}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Optional: Contact details of the marketing person handling this customer
            </p>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3">
          <Button
            className="bg-gray-100
  hover:bg-gray-200
  active:bg-gray-300
  text-gray-700
  px-4 py-2
  rounded-lg
  font-medium
"
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
            className="min-w-[120px]   bg-[#1F40AE]
  hover:bg-[#203BA0]
  active:bg-[#192F80]
  text-white
  px-4 py-2
  rounded-lg
  font-medium
"
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
  );
}
