"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  GitBranch,
} from "lucide-react";
import {
  useGetVehicleQuery,
  useUpdateVehicleMutation,
  useGetBranchesQuery,
  useGetAllVehicleTypesQuery,
} from "@/services/api/companyApi";
import { VehicleCreate } from "@/services/api/companyApi";
import { toast } from "react-hot-toast";

export default function EditVehiclePage() {
  const params = useParams();
  const router = useRouter();
  const vehicleId = params.id as string;

  const { data: vehicle, isLoading, error } = useGetVehicleQuery(vehicleId);
  const { data: branches } = useGetBranchesQuery({});
  const { data: vehicleTypes } = useGetAllVehicleTypesQuery({ is_active: true });
  const [updateVehicle, { isLoading: isUpdating }] = useUpdateVehicleMutation();

  const [formData, setFormData] = useState<Partial<VehicleCreate>>({
    branch_ids: [],
    available_for_all_branches: true,
    plate_number: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    vehicle_type_id: "",
    capacity_weight: 0,
    capacity_volume: 0,
    status: "available",
    last_maintenance: "",
    next_maintenance: "",
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAvailableForAllBranches, setIsAvailableForAllBranches] = useState(true);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

  useEffect(() => {
    if (vehicle) {
      // Extract branch IDs from vehicle.branches relationship
      const branchIds = vehicle.branches?.map((vb: any) => vb.branch.id) || [];

      setFormData({
        branch_ids: branchIds,
        available_for_all_branches: vehicle.available_for_all_branches ?? true,
        plate_number: vehicle.plate_number || "",
        make: vehicle.make || "",
        model: vehicle.model || "",
        year: vehicle.year || new Date().getFullYear(),
        vehicle_type_id: vehicle.vehicle_type_id || "",
        capacity_weight: vehicle.capacity_weight || 0,
        capacity_volume: vehicle.capacity_volume || 0,
        status: vehicle.status || "available",
        last_maintenance: vehicle.last_maintenance
          ? new Date(vehicle.last_maintenance).toISOString().split("T")[0]
          : "",
        next_maintenance: vehicle.next_maintenance
          ? new Date(vehicle.next_maintenance).toISOString().split("T")[0]
          : "",
        is_active: vehicle.is_active,
      });

      setIsAvailableForAllBranches(vehicle.available_for_all_branches ?? true);
      setSelectedBranches(branchIds);
    }
  }, [vehicle]);

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

    // Validate branches if not available for all
    if (!isAvailableForAllBranches && selectedBranches.length === 0) {
      newErrors.branches = "Please select at least one branch";
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
      const updateData = {
        ...formData,
        last_maintenance: formData.last_maintenance || undefined,
        next_maintenance: formData.next_maintenance || undefined,
        available_for_all_branches: isAvailableForAllBranches,
        branch_ids: isAvailableForAllBranches ? [] : selectedBranches,
      };

      await updateVehicle({
        id: vehicleId,
        vehicle: updateData,
      }).unwrap();

      toast.success("Vehicle updated successfully");
      router.push(`/company-admin/masters/vehicles/${vehicleId}`);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to update vehicle");
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
      <div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium">Error loading vehicle</h3>
            <p className="text-red-600 text-sm mt-1">
              The vehicle may not exist or you don't have permission to edit it
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
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
      </div>
    );
  }

  if (!vehicle) return null;

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
              <h1 className="text-3xl font-bold text-gray-900">Edit Vehicle</h1>
              <p className="text-gray-500">Update vehicle information</p>
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
              </div>

              {/* Branch Availability - Same pattern as customers */}
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
                      {errors.branches && (
                        <p className="text-sm text-red-600 mt-2">
                          {errors.branches}
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
    </div>
  );
}
