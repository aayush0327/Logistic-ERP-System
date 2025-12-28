"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  Search,
  Plus,
  Edit,
  Eye,
  MapPin,
  Truck,
  Building,
  Filter,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Settings,
  Calendar,
  Wrench,
  ArrowLeft,
  Power,
  PowerOff,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useGetVehiclesQuery,
  useDeleteVehicleMutation,
  useUpdateVehicleMutation,
  useGetAllVehicleTypesQuery,
  useGetVehicleStatusOptionsQuery,
  useGetBranchesQuery,
} from "@/services/api/companyApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { toast } from "react-hot-toast";

export default function VehiclesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);

  const { data: vehicleTypes } = useGetAllVehicleTypesQuery({
    is_active: true,
  });
  const { data: statusOptions } = useGetVehicleStatusOptionsQuery();
  const { data: branches } = useGetBranchesQuery({});

  const {
    data: vehicles,
    isLoading,
    error,
  } = useGetVehiclesQuery({
    page,
    per_page: 20,
    search: searchQuery || undefined,
    vehicle_type_id: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    branch_id: branchFilter !== "all" ? branchFilter : undefined,
  });

  const [deleteVehicle, { isLoading: isDeleting }] = useDeleteVehicleMutation();
  const [updateVehicle, { isLoading: isUpdating }] = useUpdateVehicleMutation();

  const vehiclesList = vehicles?.items || [];
  const filteredVehicles = vehiclesList.filter((vehicle: any) => {
    const matchesSearch =
      !searchQuery ||
      vehicle.plate_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || vehicle.status === statusFilter;
    const matchesType =
      typeFilter === "all" || getVehicleTypeId(vehicle) === typeFilter;
    const matchesBranch =
      branchFilter === "all" || vehicle.branch_id === branchFilter;

    return matchesSearch && matchesStatus && matchesType && matchesBranch;
  });

  const handleEdit = (id: string) => {
    router.push(`/company-admin/masters/vehicles/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/company-admin/masters/vehicles/${id}`);
  };

  const handleDelete = async () => {
    if (!vehicleToDelete) return;

    // Find the vehicle to check its status
    const vehicle = vehiclesList.find((v: any) => v.id === vehicleToDelete);

    if (vehicle?.status === "on_trip") {
      toast.error(
        "Cannot delete a vehicle that is currently on a trip. Please complete the trip first."
      );
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
      return;
    }

    try {
      await deleteVehicle(vehicleToDelete).unwrap();
      toast.success("Vehicle deleted successfully");
      setDeleteDialogOpen(false);
      setVehicleToDelete(null);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to delete vehicle");
    }
  };

  const confirmDelete = (id: string) => {
    setVehicleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleToggleActive = async (vehicle: any) => {
    try {
      await updateVehicle({
        id: vehicle.id,
        vehicle: { is_active: !vehicle.is_active },
      }).unwrap();
      toast.success(
        vehicle.is_active
          ? "Vehicle deactivated successfully"
          : "Vehicle activated successfully"
      );
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to update vehicle status");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<
      string,
      "default" | "success" | "info" | "warning" | "danger"
    > = {
      available: "success",
      on_trip: "info",
      maintenance: "warning",
      out_of_service: "default",
    };
    return (
      <Badge variant={colors[status] || "default"}>
        {status?.replace("_", " ") || "N/A"}
      </Badge>
    );
  };

  const getTypeBadge = (vehicle: any) => {
    // Use the vehicle_type_relation if available, otherwise fall back to the old enum
    const typeName =
      vehicle.vehicle_type_relation?.name ||
      vehicle.vehicle_type?.replace("_", " ") ||
      "N/A";
    return <Badge variant="default">{typeName}</Badge>;
  };

  const getVehicleTypeId = (vehicle: any) => {
    // Return the vehicle_type_id for filtering
    return vehicle.vehicle_type_id || vehicle.vehicle_type;
  };

  const getVehicleTypeName = (vehicle: any) => {
    // Return the vehicle type name for display
    return (
      vehicle.vehicle_type_relation?.name ||
      vehicle.vehicle_type?.replace("_", " ") ||
      "N/A"
    );
  };

  if (error) {
    return (
      <div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium">Error loading vehicles</h3>
            <p className="text-red-600 text-sm mt-1">
              Please try refreshing the page
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
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
              <h1 className="text-3xl font-bold text-gray-900">
                Vehicle Management
              </h1>
              <p className="text-gray-500 mt-2">
                Manage your fleet of vehicles
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                router.push("/company-admin/masters/vehicle-types")
              }
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Manage Vehicle Types
            </Button>
            <Button
              onClick={() => router.push("/company-admin/masters/vehicles/new")}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Vehicle
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Vehicles</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {vehiclesList.length || 0}
                  </p>
                </div>
                <Truck className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available</p>
                  <p className="text-2xl font-bold text-green-600">
                    {vehiclesList.filter((v: any) => v.status === "available")
                      .length || 0}
                  </p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-green-600 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">On Trip</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {vehiclesList.filter((v: any) => v.status === "on_trip")
                      .length || 0}
                  </p>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-blue-600 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">In Maintenance</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {vehiclesList.filter((v: any) => v.status === "maintenance")
                      .length || 0}
                  </p>
                </div>
                <Wrench className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search vehicles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === "all" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </Button>
                {statusOptions?.map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status.replace("_", " ")}
                  </Button>
                ))}
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                {vehicleTypes?.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Branches</option>
                {branches?.items?.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Vehicles Table */}
        <Card>
          <CardHeader>
            <CardTitle>Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No vehicles found
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery ||
                  statusFilter !== "all" ||
                  typeFilter !== "all" ||
                  branchFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Get started by adding your first vehicle"}
                </p>
                {!searchQuery &&
                  statusFilter === "all" &&
                  typeFilter === "all" &&
                  branchFilter === "all" && (
                    <Button
                      onClick={() =>
                        router.push("/company-admin/masters/vehicles/new")
                      }
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Vehicle
                    </Button>
                  )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plate Number</TableHead>
                      <TableHead>Make/Model</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Maintenance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicles.map((vehicle: any) => (
                      <TableRow
                        key={vehicle.id}
                        className={`hover:bg-gray-50 ${
                          !vehicle.is_active ? "bg-gray-50 opacity-60" : ""
                        }`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {vehicle.plate_number}
                            {!vehicle.is_active && (
                              <Badge
                                variant="default"
                                className="text-xs bg-gray-400"
                              >
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">
                              {vehicle.make} {vehicle.model}
                            </p>
                            {vehicle.year && (
                              <p className="text-sm text-gray-500">
                                {vehicle.year}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(vehicle)}</TableCell>
                        <TableCell>
                          <div>
                            {vehicle.capacity_weight && (
                              <p className="text-sm">
                                {vehicle.capacity_weight} kg
                              </p>
                            )}
                            {vehicle.capacity_volume && (
                              <p className="text-sm text-gray-500">
                                {vehicle.capacity_volume} m³
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-gray-900">
                            <Building className="w-3 h-3 mr-1" />
                            {vehicle.branch?.name || "Not assigned"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(vehicle.status || "")}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {vehicle.last_maintenance ? (
                              <>
                                <p>
                                  {new Date(
                                    vehicle.last_maintenance
                                  ).toLocaleDateString()}
                                </p>
                                {vehicle.next_maintenance && (
                                  <p className="text-xs text-gray-500">
                                    Next:{" "}
                                    {new Date(
                                      vehicle.next_maintenance
                                    ).toLocaleDateString()}
                                  </p>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400">
                                Not scheduled
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(vehicle.id)}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(vehicle.id)}
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(vehicle)}
                              title={
                                vehicle.is_active
                                  ? "Deactivate Vehicle"
                                  : "Activate Vehicle"
                              }
                              className={
                                vehicle.is_active
                                  ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                  : "text-green-600 hover:text-green-700 hover:bg-green-50"
                              }
                              disabled={isUpdating}
                            >
                              {vehicle.is_active ? (
                                <PowerOff className="w-4 h-4" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmDelete(vehicle.id)}
                              title="Delete Vehicle"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={vehicle.status === "on_trip"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {filteredVehicles.length > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Showing {filteredVehicles.length} of{" "}
                      {vehiclesList.length || 0} vehicles
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600 px-2">
                        Page {page}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={filteredVehicles.length < 20}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {vehicleToDelete &&
                (() => {
                  const vehicle = vehiclesList.find(
                    (v: any) => v.id === vehicleToDelete
                  );
                  const isOnTrip = vehicle?.status === "on_trip";

                  return (
                    <>
                      {isOnTrip && (
                        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-red-800">
                              Cannot Delete Active Vehicle
                            </p>
                            <p className="text-sm text-red-600 mt-1">
                              This vehicle is currently on a trip. You must
                              complete the trip before deleting it.
                            </p>
                          </div>
                        </div>
                      )}
                      {!isOnTrip && (
                        <>
                          <p className="text-sm text-gray-600">
                            Are you sure you want to delete this vehicle? This
                            action cannot be undone.
                          </p>
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-900">
                              {vehicle?.plate_number}
                            </p>
                            <p className="text-sm text-gray-600">
                              {vehicle?.make} {vehicle?.model} ({vehicle?.year})
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Status: {vehicle?.status?.replace("_", " ")}
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setVehicleToDelete(null);
                }}
              >
                Cancel
              </Button>
              {vehicleToDelete &&
                (() => {
                  const vehicle = vehiclesList.find(
                    (v: any) => v.id === vehicleToDelete
                  );
                  return vehicle?.status !== "on_trip" ? (
                    <Button
                      variant="primary"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  ) : null;
                })()}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
