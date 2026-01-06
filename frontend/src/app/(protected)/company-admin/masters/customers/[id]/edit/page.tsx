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
  MapPin,
  Phone,
  Mail,
  Building,
  CreditCard,
  User,
  GitBranch,
  Megaphone,
} from "lucide-react";
import {
  useGetCustomerQuery,
  useUpdateCustomerMutation,
  useGetBranchesQuery,
  useGetAllBusinessTypesQuery,
} from "@/services/api/companyApi";
import { CustomerCreate, BusinessTypeModel } from "@/services/api/companyApi";
import { toast } from "react-hot-toast";

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const { data: customer, isLoading, error } = useGetCustomerQuery(customerId);
  const { data: branchesData } = useGetBranchesQuery({});

  // Extract branches from paginated response
  const branches = branchesData?.items || [];
  const { data: businessTypesData } = useGetAllBusinessTypesQuery({ is_active: true });

  // Handle both array and paginated response formats
  const businessTypes: BusinessTypeModel[] = Array.isArray(businessTypesData)
    ? businessTypesData
    : businessTypesData?.items || [];
  const [updateCustomer, { isLoading: isUpdating }] =
    useUpdateCustomerMutation();

  const [formData, setFormData] = useState<Partial<CustomerCreate>>({
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
    business_type: "",  // Deprecated - old enum
    business_type_id: "",  // New - foreign key
    credit_limit: 0,
    pricing_tier: "",
    is_active: true,
    marketing_person_name: "",
    marketing_person_phone: "",
    marketing_person_email: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAvailableForAllBranches, setIsAvailableForAllBranches] = useState(true);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>([]);

  useEffect(() => {
    if (customer) {
      // Extract branch IDs from customer.branches relationship
      const branchIds = customer.branches?.map((cb: any) => cb.branch.id) || [];
      // Extract business type IDs from customer.business_types relationship
      const businessTypeIds = customer.business_types?.map((bt: any) => bt.id) || [];

      setFormData({
        branch_ids: branchIds,
        available_for_all_branches: customer.available_for_all_branches ?? true,
        code: customer.code || "",
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        postal_code: customer.postal_code || "",
        business_type: customer.business_type || "",
        business_type_id: customer.business_type_id || "",
        credit_limit: customer.credit_limit || 0,
        pricing_tier: customer.pricing_tier || "",
        is_active: customer.is_active,
        marketing_person_name: customer.marketing_person_name || "",
        marketing_person_phone: customer.marketing_person_phone || "",
        marketing_person_email: customer.marketing_person_email || "",
      });

      setIsAvailableForAllBranches(customer.available_for_all_branches ?? true);
      setSelectedBranches(branchIds);
      setSelectedBusinessTypes(businessTypeIds);
    }
  }, [customer]);

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

    // Validate business types
    if (businessTypes && businessTypes.length > 0 && selectedBusinessTypes.length === 0) {
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
      const submitData = {
        code: formData.code,
        name: formData.name,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        postal_code: formData.postal_code || undefined,
        // Use business_type_ids for multiple business types
        ...(selectedBusinessTypes.length > 0
          ? { business_type_ids: selectedBusinessTypes }
          : {}),
        credit_limit: formData.credit_limit || 0,
        pricing_tier: formData.pricing_tier || "standard",
        is_active: formData.is_active,
        // Branch availability
        available_for_all_branches: isAvailableForAllBranches,
        // Only include branch_ids if not available for all branches
        ...(!isAvailableForAllBranches &&
          selectedBranches.length > 0 && { branch_ids: selectedBranches }),
        // Marketing person contact details
        marketing_person_name: formData.marketing_person_name || undefined,
        marketing_person_phone: formData.marketing_person_phone || undefined,
        marketing_person_email: formData.marketing_person_email || undefined,
      };

      await updateCustomer({
        id: customerId,
        customer: submitData,
      }).unwrap();

      toast.success("Customer updated successfully");
      router.push(`/company-admin/masters/customers/${customerId}`);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to update customer");
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

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error loading customer</h3>
          <p className="text-red-600 text-sm mt-1">
            The customer may not exist or you don't have permission to edit it
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
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
    );
  }

  if (!customer) return null;

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
            <h1 className="text-3xl font-bold text-gray-900">Edit Customer</h1>
            <p className="text-gray-500">Update customer information</p>
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
                      <a href="/company-admin/masters/business-types" className="text-blue-600 hover:underline">
                        Create business types
                      </a>{" "}
                      to categorize your customers.
                    </p>
                  )}
                </div>
                {errors.business_type_ids && (
                  <p className="text-sm text-red-600 mt-1">{errors.business_type_ids}</p>
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
                  <option className="text-black" value="standard">
                    Standard
                  </option>
                  <option className="text-black" value="premium">
                    Premium
                  </option>
                  <option className="text-black" value="enterprise">
                    Enterprise
                  </option>
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
          </CardContent>
        </Card>

        {/* Branch Availability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <GitBranch className="w-5 h-5 mr-2" />
              Branch Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  {errors.branches && (
                    <p className="text-sm text-red-600 mt-2">
                      {errors.branches}
                    </p>
                  )}
                </div>
              )}
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
          <Button type="button" variant="outline" onClick={() => router.back()}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={isUpdating} className="min-w-[120px]">
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
  );
}
