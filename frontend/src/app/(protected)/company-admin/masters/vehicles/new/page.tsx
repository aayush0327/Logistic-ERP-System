"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import {
  ArrowLeft,
  Save,
  X,
  Truck,
  Building,
  Calendar,
  Wrench,
} from "lucide-react";
import {
  useCreateVehicleMutation,
  useGetBranchesQuery,
  useGetAllVehicleTypesQuery,
} from "@/services/api/companyApi";
import { VehicleCreate } from "@/services/api/companyApi";
import { toast } from "react-hot-toast";

export default function NewVehiclePage() {
  const router = useRouter();
  const { data: branches } = useGetBranchesQuery({});
  const { data: vehicleTypes } = useGetAllVehicleTypesQuery({ is_active: true });
  const [createVehicle, { isLoading: isCreating }] = useCreateVehicleMutation();

  const [formData, setFormData] = useState<VehicleCreate>({
    branch_id: "",
    plate_number: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    vehicle_type: "",
    vehicle_type_id: "",
    capacity_weight: 0,
    capacity_volume: 0,
    status: "available",
    last_maintenance: "",
    next_maintenance: "",
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.plate_number?.trim()) {
      newErrors.plate_number = "Plate number is required";
    }
    if (!formData.make?.trim()) {
      newErrors.make = "Vehicle make is required";
    }
    if (!formData.model?.trim()) {
      newErrors.model = "Vehicle model is required";
    }
    if (!formData.vehicle_type_id) {
      newErrors.vehicle_type_id = "Vehicle type is required";
    }
    if (formData.capacity_weight && formData.capacity_weight < 0) {
      newErrors.capacity_weight = "Weight capacity must be positive";
    }
    if (formData.capacity_volume && formData.capacity_volume < 0) {
      newErrors.capacity_volume = "Volume capacity must be positive";
    }
    if (
      formData.year &&
      (formData.year < 1900 || formData.year > new Date().getFullYear() + 1)
    ) {
      newErrors.year = "Invalid year";
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
      const createData = {
        ...formData,
        last_maintenance: formData.last_maintenance || undefined,
        next_maintenance: formData.next_maintenance || undefined,
      };

      const newVehicle = await createVehicle(createData).unwrap();
      toast.success("Vehicle created successfully");
      router.push(`/company-admin/masters/vehicles/${newVehicle.id}`);
    } catch (error: any) {
      console.error("Vehicle creation error:", error);

      // Show the actual backend error message directly in toast
      const errorMessage =
        error?.data?.detail || error?.message || "Failed to create vehicle";

      // Show the exact error message from backend in toast
      toast.error(errorMessage);

      // Also set field-specific error for common cases
      if (typeof errorMessage === "string") {
        const lowerMessage = errorMessage.toLowerCase();

        if (
          lowerMessage.includes("plate number already exists") ||
          lowerMessage.includes("vehicle with this plate number already exists")
        ) {
          setErrors((prev) => ({
            ...prev,
            plate_number: "Vehicle with this plate number already exists",
          }));
        } else if (lowerMessage.includes("make")) {
          setErrors((prev) => ({
            ...prev,
            make: "Invalid format",
          }));
        } else if (lowerMessage.includes("model")) {
          setErrors((prev) => ({
            ...prev,
            model: "Invalid format",
          }));
        } else if (lowerMessage.includes("vehicle type")) {
          setErrors((prev) => ({
            ...prev,
            vehicle_type_id: "Invalid vehicle type",
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
    <div>
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
              <h1 className="text-3xl font-bold text-gray-900">New Vehicle</h1>
              <p className="text-gray-500">Add a new vehicle to your fleet</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="w-5 h-5 mr-2" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plate_number">Plate Number *</Label>
                  <Input
                    id="plate_number"
                    value={formData.plate_number}
                    onChange={(e) =>
                      handleInputChange(
                        "plate_number",
                        e.target.value.toUpperCase()
                      )
                    }
                    placeholder="e.g., MH-12-AB-1234"
                    className={errors.plate_number ? "border-red-500" : ""}
                  />
                  {errors.plate_number && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.plate_number}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="vehicle_type_id">Vehicle Type *</Label>
                  <select
                    id="vehicle_type_id"
                    value={formData.vehicle_type_id}
                    onChange={(e) =>
                      handleInputChange("vehicle_type_id", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Vehicle Type</option>
                    {vehicleTypes?.map((type) => (
                      <option className="text-black" key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  {errors.vehicle_type_id && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.vehicle_type_id}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="make">Make *</Label>
                  <Input
                    id="make"
                    value={formData.make}
                    onChange={(e) => handleInputChange("make", e.target.value)}
                    placeholder="e.g., Tata"
                    className={errors.make ? "border-red-500" : ""}
                  />
                  {errors.make && (
                    <p className="text-sm text-red-600 mt-1">{errors.make}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => handleInputChange("model", e.target.value)}
                    placeholder="e.g., Ace"
                    className={errors.model ? "border-red-500" : ""}
                  />
                  {errors.model && (
                    <p className="text-sm text-red-600 mt-1">{errors.model}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    value={formData.year}
                    onChange={(e) =>
                      handleInputChange("year", parseInt(e.target.value))
                    }
                    className={errors.year ? "border-red-500" : ""}
                  />
                  {errors.year && (
                    <p className="text-sm text-red-600 mt-1">{errors.year}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) =>
                      handleInputChange("status", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option className="text-black" value="available">
                      Available
                    </option>
                    <option className="text-black" value="on_trip">
                      On Trip
                    </option>
                    <option className="text-black" value="maintenance">
                      Maintenance
                    </option>
                    <option className="text-black" value="out_of_service">
                      Out of Service
                    </option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="branch_id">Assigned Branch</Label>
                  <select
                    id="branch_id"
                    value={formData.branch_id}
                    onChange={(e) =>
                      handleInputChange("branch_id", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Branch</option>
                    {branches?.items?.map((branch: any) => (
                      <option
                        className="text-black"
                        key={branch.id}
                        value={branch.id}
                      >
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Optional: Assign this vehicle to a branch
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    handleInputChange("is_active", checked)
                  }
                />
                <Label>Active Vehicle</Label>
              </div>
            </CardContent>
          </Card>

          {/* Capacity Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="w-5 h-5 mr-2" />
                Capacity Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="capacity_weight">Weight Capacity (kg)</Label>
                  <Input
                    id="capacity_weight"
                    type="number"
                    min="0"
                    step="10"
                    value={formData.capacity_weight}
                    onChange={(e) =>
                      handleInputChange(
                        "capacity_weight",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="e.g., 1000"
                    className={errors.capacity_weight ? "border-red-500" : ""}
                  />
                  {errors.capacity_weight && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.capacity_weight}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="capacity_volume">Volume Capacity (m³)</Label>
                  <Input
                    id="capacity_volume"
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.capacity_volume}
                    onChange={(e) =>
                      handleInputChange(
                        "capacity_volume",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="e.g., 5.5"
                    className={errors.capacity_volume ? "border-red-500" : ""}
                  />
                  {errors.capacity_volume && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.capacity_volume}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wrench className="w-5 h-5 mr-2" />
                Maintenance Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="last_maintenance">
                    Last Maintenance Date
                  </Label>
                  <Input
                    id="last_maintenance"
                    type="date"
                    value={formData.last_maintenance}
                    onChange={(e) =>
                      handleInputChange("last_maintenance", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="next_maintenance">
                    Next Maintenance Date
                  </Label>
                  <Input
                    id="next_maintenance"
                    type="date"
                    value={formData.next_maintenance}
                    onChange={(e) =>
                      handleInputChange("next_maintenance", e.target.value)
                    }
                  />
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
                  Add Vehicle
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
