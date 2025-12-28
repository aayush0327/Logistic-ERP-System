"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import {
  X,
  Truck,
  MapPin,
  CheckCircle,
  Phone,
  Award,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Driver } from "@/types/common";
import { tmsAPI, TripCreateData } from "@/lib/api";
import { useOutsideClick } from "@/components/Hooks/useOutsideClick";

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: any[];
  availableTrucks: any[];
  availableDrivers: Driver[];
  onTripCreated: () => void;
}

export default function CreateTripModal({
  isOpen,
  onClose,
  branches,
  availableTrucks,
  availableDrivers,
  onTripCreated,
}: CreateTripModalProps) {
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedTruck, setSelectedTruck] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle outside click to close modal
  useOutsideClick(
    modalRef,
    () => {
      if (isOpen) {
        handleClose();
      }
    },
    isOpen
  );

  const getTrucksAvailable = () =>
    availableTrucks.filter((truck) => truck.status === "available");

  const getDriversAvailable = () =>
    availableDrivers.filter(
      (driver) => driver.status === "active" && !driver.currentTruck
    );

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleBranchSelect = (branch: string) => {
    setSelectedBranch(branch);
    setSelectedTruck("");
    setSelectedDriver(null);
  };

  const handleClose = () => {
    setSelectedBranch("");
    setSelectedTruck("");
    setSelectedDriver(null);
    setCurrentStep(1);
    onClose();
  };

  const handleCreateTrip = async () => {
    try {
      // Find selected truck and driver details
      const selectedTruckDetails = availableTrucks.find(
        (t) => t.id === selectedTruck
      );

      if (!selectedTruckDetails || !selectedDriver || !selectedBranch) {
        alert("Please select branch, truck, and driver");
        return;
      }

      // Create trip via API
      const tripData: TripCreateData = {
        branch: selectedBranch,
        truck_plate: selectedTruckDetails.plate,
        truck_model: selectedTruckDetails.model,
        truck_capacity: selectedTruckDetails.capacity,
        driver_id: selectedDriver.id,
        driver_name: selectedDriver.name,
        driver_phone: selectedDriver.phone,
        capacity_total: selectedTruckDetails.capacity,
        trip_date: new Date().toISOString().split("T")[0],
        origin: selectedBranch,
        destination: null, // Will be determined later
      };

      await tmsAPI.createTrip(tripData);

      // Notify parent to refresh trips
      onTripCreated();

      // Reset form and close
      handleClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create trip");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-black">Create New Trip</h2>
            <Button
              onClick={handleClose}
              variant="outline"
              size="sm"
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 1
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                1
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  currentStep >= 1 ? "text-green-600" : "text-gray-500"
                }`}
              >
                Select Branch
              </span>
            </div>
            <div
              className={`flex-1 h-1 mx-4 ${
                currentStep >= 2 ? "bg-green-600" : "bg-gray-200"
              }`}
            ></div>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 2
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                2
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  currentStep >= 2 ? "text-green-600" : "text-gray-500"
                }`}
              >
                Select Truck
              </span>
            </div>
            <div
              className={`flex-1 h-1 mx-4 ${
                currentStep >= 3 ? "bg-green-600" : "bg-gray-200"
              }`}
            ></div>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 3
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                3
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  currentStep >= 3 ? "text-green-600" : "text-gray-500"
                }`}
              >
                Select Driver
              </span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="px-6 py-6">
          {/* Step 1: Select Branch */}
          {currentStep === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-black mb-4">
                Select Branch
              </h3>
              <p className="text-gray-600 mb-6">
                Choose the branch for this trip
              </p>
              <div className="space-y-3">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    onClick={() => handleBranchSelect(branch.name)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedBranch === branch.name
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-black">
                          {branch.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {branch.location}
                        </p>
                        <p className="text-sm text-gray-600">
                          Manager: {branch.manager}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedBranch === branch.name
                            ? "border-green-500 bg-green-500"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {selectedBranch === branch.name && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Truck */}
          {currentStep === 2 && (
            <div>
              <h3 className="text-lg font-semibold text-black mb-4">
                Select Truck
              </h3>
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Selected Branch:</p>
                    <p className="font-medium text-black">
                      {selectedBranch || "Not selected"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Available Trucks:</p>
                    <p className="text-sm text-gray-500">
                      {getTrucksAvailable().length} trucks available
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {getTrucksAvailable().map((truck) => (
                  <div
                    key={truck.id}
                    onClick={() => setSelectedTruck(truck.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedTruck === truck.id
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Truck className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-black">
                            {truck.plate}
                          </h4>
                          <p className="text-sm text-gray-600">{truck.model}</p>
                          <p className="text-sm text-gray-600">
                            Capacity: {truck.capacity}kg
                          </p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedTruck === truck.id
                            ? "border-green-500 bg-green-500"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {selectedTruck === truck.id && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Select Driver */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-black mb-2">
                  Select Driver
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose a driver for the trip
                </p>
              </div>

              {/* Previous Selections Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-black mb-2">
                  Trip Configuration:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">Selected Branch:</span>
                    <span className="font-medium text-black">
                      {selectedBranch}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">Selected Truck:</span>
                    <span className="font-medium text-black">
                      {selectedTruck
                        ? availableTrucks.find((t) => t.id === selectedTruck)
                            ?.plate
                        : "Not selected"}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-600 border-t pt-2">
                  Available Drivers:{" "}
                  <span className="font-medium text-black">
                    {getDriversAvailable().length} drivers available
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {getDriversAvailable().map((driver) => (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedDriver(driver)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedDriver?.id === driver.id
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-black">
                        {driver.name}
                      </span>
                      {selectedDriver?.id === driver.id && (
                        <CheckCircle className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {driver.phone}
                      </div>
                      <div className="flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        {driver.experience}
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {driver.license}
                      </div>
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          driver.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {driver.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex justify-between">
            <Button
              onClick={handlePrevStep}
              variant="outline"
              disabled={currentStep === 1}
              className="text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            {currentStep < 3 ? (
              <Button
                onClick={handleNextStep}
                disabled={
                  (currentStep === 1 && !selectedBranch) ||
                  (currentStep === 2 && !selectedTruck)
                }
                className="text-white disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                style={{
                  backgroundColor:
                    (currentStep === 1 && !selectedBranch) ||
                    (currentStep === 2 && !selectedTruck)
                      ? undefined
                      : "#00a63e",
                }}
                onMouseEnter={(e) => {
                  if (
                    !(
                      (currentStep === 1 && !selectedBranch) ||
                      (currentStep === 2 && !selectedTruck)
                    )
                  ) {
                    e.currentTarget.style.backgroundColor = "#008a32";
                  }
                }}
                onMouseLeave={(e) => {
                  if (
                    !(
                      (currentStep === 1 && !selectedBranch) ||
                      (currentStep === 2 && !selectedTruck)
                    )
                  ) {
                    e.currentTarget.style.backgroundColor = "#00a63e";
                  }
                }}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleCreateTrip}
                disabled={!selectedDriver}
                className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Create Trip
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
