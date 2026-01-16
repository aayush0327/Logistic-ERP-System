"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import {
  tmsAPI,
  tmsResourcesAPI,
  OrderAssignData,
  TripCreateData,
} from "@/lib/api";
import { Driver, Trip, LoadingModalData } from "@/types";
import { DurationDisplay } from "@/components/DurationDisplay";
import {
  Truck,
  MapPin,
  User,
  Package,
  Plus,
  Weight,
  CheckCircle,
  XCircle,
  X,
  Phone,
  Play,
  RotateCcw,
  ChevronDown,
  GripVertical,
  Search,
  Award,
  CreditCard,
  Scissors,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Clock,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Trips() {
  // Utility function to format date in UK timezone
  const formatUKDateTime = (dateString?: string) => {
    if (!dateString) return "N/A";

    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/London",
      }).format(date);
    } catch (error) {
      return "Invalid date";
    }
  };

  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedTruck, setSelectedTruck] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedTripForOrders, setSelectedTripForOrders] =
    useState<Trip | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderPriorityFilter, setOrderPriorityFilter] = useState("all");
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [tmsOrderStatusFilter, setTmsOrderStatusFilter] = useState<"all" | "available" | "partial" | "fully_assigned">("all");

  // Reassignment modal state for paused trips
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedTripForReassign, setSelectedTripForReassign] = useState<Trip | null>(null);
  const [reassignTruck, setReassignTruck] = useState("");
  const [reassignDriver, setReassignDriver] = useState<Driver | null>(null);
  const [isReassigning, setIsReassigning] = useState(false);

  // Dropdown states for reassignment modal
  const [reassignTruckDropdownOpen, setReassignTruckDropdownOpen] = useState(false);
  const [reassignDriverDropdownOpen, setReassignDriverDropdownOpen] = useState(false);
  const [reassignTruckSearchQuery, setReassignTruckSearchQuery] = useState("");
  const [reassignDriverSearchQuery, setReassignDriverSearchQuery] = useState("");

  // Loading stage modal state
  const [loadingModal, setLoadingModal] = useState<LoadingModalData | null>(null);
  const [editableQuantities, setEditableQuantities] = useState<Record<string, number>>({});

  // Search states for trip creation
  const [branchSearchTerm, setBranchSearchTerm] = useState("");
  const [truckSearchTerm, setTruckSearchTerm] = useState("");
  const [driverSearchTerm, setDriverSearchTerm] = useState("");
  const [branchSearchQuery, setBranchSearchQuery] = useState("");
  const [truckSearchQuery, setTruckSearchQuery] = useState("");
  const [driverSearchQuery, setDriverSearchQuery] = useState("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [truckDropdownOpen, setTruckDropdownOpen] = useState(false);
  const [driverDropdownOpen, setDriverDropdownOpen] = useState(false);
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [splitOrder, setSplitOrder] = useState<any | null>(null);
  const [selectedSplitItems, setSelectedSplitItems] = useState<string[]>([]);
  const [splitItemQuantities, setSplitItemQuantities] = useState<Record<string, number>>({});

  // Resource data from API
  const [availableTrucks, setAvailableTrucks] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drag and drop states
  const [draggedOrder, setDraggedOrder] = useState<any>(null);
  const [dragOverOrderIndex, setDragOverOrderIndex] = useState<number | null>(null);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // Fetch data on component mount
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await fetchAllTrips();
        await fetchResources();
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch all trips (for statistics)
  const fetchAllTrips = async () => {
    try {
      setLoading(true);
      const data = await tmsAPI.getAllTrips();

      // Debug: Log first trip to check time_in_status fields
      if (data && data.length > 0) {
        console.log('First trip data:', {
          id: data[0].id,
          status: data[0].status,
          time_in_current_status_minutes: data[0].time_in_current_status_minutes,
          current_status_since: data[0].current_status_since,
          from_status: data[0].from_status,
          to_status: data[0].to_status,
          createdAt: data[0].createdAt
        });
      }

      // Deduplicate trips by ID in case of duplicates
      const uniqueTrips = Array.from(
        new Map(data.map((trip: Trip) => [trip.id, trip])).values()
      );
      setAllTrips(uniqueTrips);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch trips");
    } finally {
      setLoading(false);
    }
  };

  // Fetch trips with filters (for display) - now just refreshes all trips
  const fetchTrips = async (filters?: { status?: string; branch?: string }) => {
    // We'll just refresh all trips since filtering is now done on frontend
    await fetchAllTrips();
  };

  // Fetch all resources
  const fetchResources = async () => {
    try {
      // Use default tenant for now - in production, this would come from auth context
      const tenantId = "default-tenant";

      const [trucksData, driversData, ordersData, branchesData] =
        await Promise.all([
          tmsResourcesAPI.getTrucks(tenantId),
          tmsResourcesAPI.getDrivers(),
          tmsResourcesAPI.getOrders(),
          tmsResourcesAPI.getBranches(tenantId),
        ]);

      console.log("fetchResources - driversData:", driversData);
      console.log("fetchResources - branchesData:", branchesData);
      setAvailableTrucks(trucksData);
      setAvailableDrivers(driversData);
      setAvailableOrders(ordersData);
      setBranches(branchesData);
    } catch (err) {
      console.error("fetchResources error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch resources"
      );
    }
  };

  // Update filtered trips when status filter changes
  useEffect(() => {
    fetchTrips(statusFilter ? { status: statusFilter } : undefined);
  }, [statusFilter]);

  // Auto-refresh trips every hour (3600000 ms) to update time-in-status
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTrips(statusFilter ? { status: statusFilter } : undefined);
    }, 3600000); // 1 hour

    return () => clearInterval(interval);
  }, [statusFilter]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Close dropdowns if clicking outside of input or dropdown
      if (!target.closest('.dropdown-container')) {
        setBranchDropdownOpen(false);
        setTruckDropdownOpen(false);
        setDriverDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "on-route":
        return "info";
      case "loading":
        return "warning";
      case "planning":
        return "default";
      case "cancelled":
        return "danger";
      case "truck-malfunction":
        return "danger";
      default:
        return "default";
    }
  };

  const isTripLocked = (status: string) => {
    return ["on-route", "loading", "completed", "truck-malfunction"].includes(
      status
    );
  };

  const getNextStatusOptions = (currentStatus: string) => {
    switch (currentStatus) {
      case "planning":
        return [{ value: "loading", label: "Start Loading", color: "yellow" }];
      case "loading":
        return [
          { value: "on-route", label: "Start Delivery", color: "blue" },
          { value: "planning", label: "Back to Planning", color: "gray" },
        ];
      case "on-route":
        return [
          { value: "completed", label: "Complete Trip", color: "green" },
          {
            value: "truck-malfunction",
            label: "Report Truck Malfunction",
            color: "red",
          },
        ];
      case "paused":
        return [
          { value: "reassign-resume", label: "Reassign & Resume", color: "purple" },
        ];
      case "truck-malfunction":
        return [
          { value: "loading", label: "Resume Loading", color: "yellow" },
          { value: "on-route", label: "Resume Delivery", color: "blue" },
        ];
      case "completed":
      case "cancelled":
        return [];
      default:
        return [];
    }
  };

  const handleStatusChange = async (tripId: string, newStatus: string) => {
    try {
      // Handle reassign-resume action specially
      if (newStatus === "reassign-resume") {
        const trip = allTrips.find((t) => t.id === tripId);
        if (trip) {
          setSelectedTripForReassign(trip);
          // Pre-select current truck and driver
          setReassignTruck(trip.truck?.plate || "");
          setReassignDriver(trip.driver ? {
            user_id: trip.driver_id || "",
            name: trip.driver_name || "",
            phone: trip.driver_phone || "",
            license: "",
            status: "available",
            branch_id: ""
          } : null);
          setShowReassignModal(true);
        }
        return;
      }

      // Refresh orders data to ensure we have the latest status
      await fetchResources();

      // Get the trip details
      const trip = allTrips.find((t) => t.id === tripId);

      // Prevent changing to loading status if trip has no orders
      if (newStatus === "loading" && (!trip?.orders || trip.orders.length === 0)) {
        alert("Cannot change trip status to loading. Trip must have at least one order.");
        return;
      }

      // Check if trip has orders and validate their ORIGINAL statuses from Orders service
      // (not the TripOrder status which is for delivery progress)
      if (trip && trip.orders && trip.orders.length > 0) {
        // Check each order's original status from availableOrders
        // Valid statuses for changing trip status: finance_approved, logistics_approved, assigned, partial_in_transit, partial_delivered, in_transit
        const validOrderStatuses = ["finance_approved", "logistics_approved", "assigned", "partial_in_transit", "partial_delivered", "in_transit"];
        const hasInvalidOrderStatus = trip.orders.some(
          (tripOrder) => {
            // Find the original order in availableOrders to check its finance status
            const originalOrder = availableOrders.find(o => o.order_number === tripOrder.order_id);
            const orderStatus = originalOrder?.status;
            const isValid = orderStatus && validOrderStatuses.includes(orderStatus);
            console.log(`Validating order ${tripOrder.order_id}: originalOrder=`, originalOrder, `status=`, orderStatus, `isValid=`, isValid);
            return !isValid;
          }
        );

        if (hasInvalidOrderStatus) {
          // Find the first invalid order to show in the error message
          const invalidOrder = trip.orders.find(
            (tripOrder) => {
              const originalOrder = availableOrders.find(o => o.order_number === tripOrder.order_id);
              const orderStatus = originalOrder?.status;
              return !orderStatus || !validOrderStatuses.includes(orderStatus);
            }
          );

          const originalOrderForMsg = availableOrders.find(o => o.order_number === invalidOrder?.order_id);
          alert(
            `Cannot change trip status. Order "${invalidOrder?.order_id || "N/A"}" has status "${originalOrderForMsg?.status || "unknown"}". Orders must be in one of these statuses: ${validOrderStatuses.join(", ")}.`
          );
          return;
        }

        // Special handling for loading status - mandatory item assignment
        if (newStatus === "loading") {
          // Call prepare-loading endpoint to get pending items
          try {
            const prepareResponse = await tmsAPI.prepareTripForLoading(tripId);

            // Initialize editable quantities from pending items
            const initialQuantities: Record<string, number> = {};
            prepareResponse.pending_items.forEach((item: any) => {
              initialQuantities[item.order_item_id] = item.assigned_quantity;
            });
            setEditableQuantities(initialQuantities);

            // Show loading assignment modal (MANDATORY - blocks status change)
            setLoadingModal({
              tripId,
              pendingItems: prepareResponse.pending_items,
              totalWeight: prepareResponse.total_weight,
              capacityTotal: prepareResponse.capacity_total,
              isOverCapacity: prepareResponse.is_over_capacity,
              capacityShortage: prepareResponse.capacity_shortage
            });

            return; // Don't proceed with status change yet - modal will handle it
          } catch (error) {
            alert(`Failed to prepare loading: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
          }
        }
      }

      await tmsAPI.updateTrip(tripId, { status: newStatus });

      // Refresh trips to show updated status
      fetchTrips();

      // Show success message
      const statusMessages = {
        loading: "Trip is now in loading status",
        "on-route": "Trip is now on route",
        completed: "Trip has been completed",
        cancelled: "Trip has been cancelled",
        "truck-malfunction": "Truck malfunction has been reported",
        planning: "Trip is back to planning status",
      };

      alert(
        statusMessages[newStatus as keyof typeof statusMessages] ||
        "Trip status updated"
      );
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to update trip status"
      );
    }
  };

  const handleCreateTrip = async () => {
    try {
      // Find selected truck and driver details
      const selectedTruckDetails = availableTrucks.find(
        (t) => t.id === selectedTruck
      );

      // Find selected branch details to get the branch name and ID
      const selectedBranchDetails = branches.find(
        (b) => b.id === selectedBranch
      );

      if (!selectedTruckDetails || !selectedDriver || !selectedBranch || !selectedBranchDetails) {
        alert("Please select branch, truck, and driver");
        return;
      }

      // Create trip via API
      const tripData: TripCreateData = {
        branch: selectedBranch, // Send branch UUID directly (branch field contains UUID)
        truck_plate: selectedTruckDetails.plate,
        truck_model: selectedTruckDetails.model,
        truck_capacity: selectedTruckDetails.capacity,
        driver_id: selectedDriver.user_id, // Store the driver's user_id from auth service
        driver_name: selectedDriver.name,
        driver_phone: selectedDriver.phone,
        capacity_total: selectedTruckDetails.capacity,
        trip_date: new Date().toISOString().split("T")[0],
        origin: selectedBranchDetails.name, // Send branch name for origin (display)
        destination: null, // Will be determined later
      };

      await tmsAPI.createTrip(tripData);

      // Refresh trips
      fetchTrips();

      // Reset form
      setSelectedBranch("");
      setSelectedTruck("");
      setSelectedDriver(null);
      setCurrentStep(1);
      setShowCreateTrip(false);
      setBranchSearchTerm("");
      setTruckSearchTerm("");
      setDriverSearchTerm("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create trip");
    }
  };

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

  const handleBranchSelect = async (branchId: string) => {
    setSelectedBranch(branchId);
    setSelectedTruck("");
    setSelectedDriver(null);
    setBranchSearchTerm("");
    setTruckSearchTerm("");
    setDriverSearchTerm("");
    setBranchSearchQuery("");
    setBranchDropdownOpen(false);

    // Find the branch object to get its ID
    const selectedBranchObj = branches.find((b) => b.id === branchId);

    if (selectedBranchObj) {
      try {
        // Check if this is a fallback branch (from company service being down)
        if (selectedBranchObj.id === "default-branch") {
          // If it's a fallback branch, just use the general trucks list
          const tenantId = "default-tenant";
          const allTrucks = await tmsResourcesAPI.getTrucks(tenantId);
          setAvailableTrucks(allTrucks);
        } else {
          // Fetch trucks for the selected branch
          const tenantId = "default-tenant";
          const branchTrucks = await tmsResourcesAPI.getTrucksByBranch(
            selectedBranchObj.id,
            tenantId
          );
          setAvailableTrucks(branchTrucks);
        }
      } catch (err) {
        console.error("Failed to fetch trucks for branch:", err);
        // Fallback to general trucks list if branch-specific fetch fails
        try {
          const tenantId = "default-tenant";
          const allTrucks = await tmsResourcesAPI.getTrucks(tenantId);
          setAvailableTrucks(allTrucks);
        } catch (fallbackErr) {
          console.error("Failed to fetch fallback trucks:", fallbackErr);
          // Keep existing trucks if all fetches fail
        }
      }
    }
  };

  const handleCloseModal = async () => {
    setSelectedBranch("");
    setSelectedTruck("");
    setSelectedDriver(null);
    setCurrentStep(1);
    setShowCreateTrip(false);
    setBranchSearchTerm("");
    setTruckSearchTerm("");
    setDriverSearchTerm("");

    // Reset to fetch all trucks again
    await fetchResources();
  };

  const handleReassignResources = async () => {
    if (!selectedTripForReassign || !reassignTruck || !reassignDriver) {
      alert("Please select both a truck and a driver for reassignment");
      return;
    }

    try {
      setIsReassigning(true);

      // Get truck and driver details
      const truckDetails = availableTrucks.find((t) => t.id === reassignTruck);
      if (!truckDetails) {
        alert("Truck not found");
        return;
      }

      // Check if resources changed
      const resourcesChanged =
        truckDetails.plate !== selectedTripForReassign.truck?.plate ||
        reassignDriver.user_id !== selectedTripForReassign.driver_id;

      // Call the reassign API if resources changed
      if (resourcesChanged) {
        await tmsAPI.reassignTripResources(selectedTripForReassign.id, {
          truck_plate: truckDetails.plate,
          truck_model: truckDetails.model,
          truck_capacity: truckDetails.capacity,
          driver_id: reassignDriver.user_id,
          driver_name: reassignDriver.name,
          driver_phone: reassignDriver.phone,
        });
      }

      // Resume the trip after reassignment
      await tmsAPI.updateTrip(selectedTripForReassign.id, { status: "on-route" });

      // Close modal and refresh trips
      setShowReassignModal(false);
      setSelectedTripForReassign(null);
      setReassignTruck("");
      setReassignDriver(null);

      await fetchTrips();
      await fetchResources();

      alert(resourcesChanged
        ? "Trip resources reassigned and resumed successfully!"
        : "Trip resumed successfully!");
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to reassign and resume trip"
      );
    } finally {
      setIsReassigning(false);
    }
  };

  const handleCloseReassignModal = () => {
    setShowReassignModal(false);
    setSelectedTripForReassign(null);
    setReassignTruck("");
    setReassignDriver(null);
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "danger";
      case "medium":
        return "warning";
      case "low":
        return "default";
      default:
        return "default";
    }
  };

  const getTmsStatusVariant = (tmsStatus: string) => {
    switch (tmsStatus) {
      case "available":
        return "success"; // Green - fully available
      case "partial":
        return "warning"; // Yellow/orange - partially assigned
      case "fully_assigned":
        return "default"; // Gray - fully assigned
      default:
        return "success"; // Default to available (green)
    }
  };

  const getTmsStatusDisplay = (tmsStatus: string) => {
    switch (tmsStatus) {
      case "available":
        return "Available";
      case "partial":
        return "Partial";
      case "fully_assigned":
        return "Fully Assigned";
      default:
        return "Available";
    }
  };

  const getDeliveryStatusVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "out-for-delivery":
        return "default";
      case "delivered":
        return "success";
      case "failed":
        return "danger";
      case "returned":
        return "danger";
      default:
        return "default";
    }
  };

  const getOrderStatusVariant = (status: string) => {
    switch (status) {
      case "submitted":
        return "default";
      case "finance_approved":
        return "success";
      case "logistics_approved":
        return "success";
      case "assigned":
        return "info";
      case "partial_in_transit":
        return "warning";
      case "in_transit":
        return "info";
      case "partial_delivered":
        return "warning";
      default:
        return "default";
    }
  };

  const getOrderStatusDisplay = (status: string) => {
    switch (status) {
      case "submitted":
        return "Submitted";
      case "finance_approved":
        return "Finance Approved";
      case "logistics_approved":
        return "Logistics Approved";
      case "logistics_rejected":
        return "Logistics Rejected";
      case "finance_rejected":
        return "Finance Rejected";
      case "assigned":
        return "Assigned";
      case "partial_in_transit":
        return "Partial In Transit";
      case "in_transit":
        return "In Transit";
      case "partial_delivered":
        return "Partial Delivered";
      default:
        return (
          status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")
        );
    }
  };

  const getApprovedOrders = () => {
    const filtered = availableOrders.filter(
      (order) =>
        (order.status === "submitted" ||
         order.status === "finance_approved" ||
         order.status === "logistics_approved" ||
         order.status === "assigned" ||
         order.status === "partial_in_transit" ||
         order.status === "in_transit" ||
         order.status === "partial_delivered") &&
        order.tms_order_status !== "fully_assigned" // Exclude fully_assigned orders (undefined/null means available)
    );
    console.log("getApprovedOrders - total orders:", availableOrders.length);
    console.log("getApprovedOrders - filtered orders:", filtered.length);
    console.log("getApprovedOrders - sample tms statuses:", availableOrders.slice(0, 10).map(o => ({ id: o.id, status: o.status, tms_status: o.tms_order_status })));
    return filtered;
  };

  // Helper function to get truck status badge variant
  const getTruckStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "available":
        return "success";
      case "in_use":
      case "on-trip":
        return "warning";
      case "maintenance":
      case "out-of-service":
        return "danger";
      default:
        return "default";
    }
  };

  // Helper function to get driver status badge variant
  const getDriverStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "available":
        return "success";
      case "on_trip":
      case "on-trip":
        return "warning";
      case "on_leave":
      case "on-leave":
        return "info";
      case "unavailable":
        return "danger";
      default:
        return "default";
    }
  };

  // Helper functions for trip creation - only return available resources
  const getTrucksAvailable = () =>
    availableTrucks.filter((truck) => truck.status === "available");

  const getDriversAvailable = () => {
    console.log("getDriversAvailable - availableDrivers:", availableDrivers);
    console.log("getDriversAvailable - selectedBranch:", selectedBranch);
    const filtered = availableDrivers.filter(
      (driver) => {
        const statusMatch = driver.status === "available";
        console.log(`Driver ${driver.name}: status=${driver.status}, branch_id=${driver.branch_id}, statusMatch=${statusMatch}`);
        return statusMatch;
      }
    );
    console.log("getDriversAvailable - filtered:", filtered);
    return filtered;
  };

  // Check if order is already assigned to any trip
  const isOrderAssigned = (orderId: string) => {
    return allTrips.some((trip) =>
      trip.orders.some((order) => order.id === orderId)
    );
  };

  // Filter functions for trip creation
  const getFilteredBranches = () => {
    return branches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
        branch.location.toLowerCase().includes(branchSearchTerm.toLowerCase())
    );
  };

  const getFilteredTrucks = () => {
    const available = getTrucksAvailable();
    return available.filter(
      (truck) =>
        truck.plate.toLowerCase().includes(truckSearchTerm.toLowerCase()) ||
        truck.model.toLowerCase().includes(truckSearchTerm.toLowerCase()) ||
        truck.capacity.toString().includes(truckSearchTerm)
    );
  };

  const getFilteredDrivers = () => {
    const available = getDriversAvailable();
    return available.filter(
      (driver) =>
        driver.name.toLowerCase().includes(driverSearchTerm.toLowerCase()) ||
        driver.phone.includes(driverSearchTerm) ||
        driver.license.toLowerCase().includes(driverSearchTerm.toLowerCase())
    );
  };

  // Filtered arrays for searchable dropdowns
  const filteredBranches = branches.filter(
    (branch) =>
      branch.name.toLowerCase().includes(branchSearchQuery.toLowerCase()) ||
      (branch.location && branch.location.toLowerCase().includes(branchSearchQuery.toLowerCase())) ||
      (branch.code && branch.code.toLowerCase().includes(branchSearchQuery.toLowerCase()))
  );

  const filteredTrucks = getTrucksAvailable().filter(
    (truck) =>
      truck.plate.toLowerCase().includes(truckSearchQuery.toLowerCase()) ||
      truck.model.toLowerCase().includes(truckSearchQuery.toLowerCase()) ||
      truck.capacity.toString().includes(truckSearchQuery)
  );

  const filteredDrivers = getDriversAvailable().filter(
    (driver) =>
      driver.name.toLowerCase().includes(driverSearchQuery.toLowerCase()) ||
      (driver.phone && driver.phone.includes(driverSearchQuery)) ||
      (driver.license && driver.license.toLowerCase().includes(driverSearchQuery.toLowerCase()))
  );

  // Order assignment helper functions
  const getAvailableOrders = () => {
    return availableOrders.filter((order) => {
      const isApprovedStatus =
        order.status === "submitted" ||
        order.status === "finance_approved" ||
        order.status === "logistics_approved" ||
        order.status === "assigned" ||
        order.status === "partial_in_transit" ||
        order.status === "in_transit" ||
        order.status === "partial_delivered";
      const isNotAssigned = !isOrderAssigned(order.id);
      const isNotFullyAssigned = order.tms_order_status !== "fully_assigned"; // Exclude fully assigned orders
      const matchesSearch =
        order.customer.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(orderSearchTerm.toLowerCase());
      const matchesPriority =
        orderPriorityFilter === "all" || order.priority === orderPriorityFilter;
      const matchesTmsStatus =
        tmsOrderStatusFilter === "all" ||
        (order.tms_order_status || "available") === tmsOrderStatusFilter;

      return (
        isApprovedStatus && isNotAssigned && isNotFullyAssigned && matchesSearch && matchesPriority && matchesTmsStatus
      );
    });
  };

  // Toggle trip expansion
  const toggleTripExpansion = (tripId: string) => {
    const newExpanded = new Set(expandedTrips);
    if (newExpanded.has(tripId)) {
      newExpanded.delete(tripId);
    } else {
      newExpanded.add(tripId);
    }
    setExpandedTrips(newExpanded);
  };

  // Drag and drop handlers for reordering orders within a trip
  const handleOrderDragStart = (
    e: React.DragEvent,
    order: any,
    tripId: string,
    orderIndex: number
  ) => {
    // Only allow dragging if trip is in planning status
    const trip = allTrips.find((t) => t.id === tripId);
    if (trip?.status !== "planning") {
      e.preventDefault();
      return;
    }

    setDraggedOrder({ ...order, sourceTripId: tripId, sourceIndex: orderIndex });
    e.dataTransfer.effectAllowed = "move";
    // Set a custom drag image if needed
    e.dataTransfer.setData("text/plain", order.id);
  };

  const handleOrderDragOver = (
    e: React.DragEvent,
    tripId: string,
    targetIndex: number
  ) => {
    e.preventDefault();
    // Only allow dropping if it's the same trip
    if (draggedOrder && draggedOrder.sourceTripId === tripId) {
      e.dataTransfer.dropEffect = "move";
      setDragOverOrderIndex(targetIndex);
    }
  };

  const handleOrderDragLeave = (e: React.DragEvent) => {
    setDragOverOrderIndex(null);
  };

  const handleOrderDrop = async (
    e: React.DragEvent,
    targetTripId: string,
    targetIndex: number
  ) => {
    e.preventDefault();
    setDragOverOrderIndex(null);

    if (!draggedOrder) return;

    // Only allow reordering within the same trip
    if (draggedOrder.sourceTripId !== targetTripId) {
      alert("Orders can only be reordered within the same trip. Use 'Add Orders' to assign orders to different trips.");
      setDraggedOrder(null);
      return;
    }

    // If dropping at the same position, do nothing
    if (draggedOrder.sourceIndex === targetIndex) {
      setDraggedOrder(null);
      return;
    }

    try {
      const sourceTrip = allTrips.find((t) => t.id === targetTripId);
      if (!sourceTrip || sourceTrip.status !== "planning") {
        alert("Can only reorder orders in trips with planning status");
        setDraggedOrder(null);
        return;
      }

      // Get the current orders
      const currentOrders = [...sourceTrip.orders];

      // Remove the dragged order from its original position
      const reorderedOrders = currentOrders.filter(
        (order) => order.id !== draggedOrder.id
      );

      // Insert it at the new position
      reorderedOrders.splice(targetIndex, 0, {
        ...draggedOrder,
        sourceTripId: undefined,
        sourceIndex: undefined
      });

      // Update the order in the UI immediately for better UX
      const updatedTrips = allTrips.map((trip) => {
        if (trip.id === targetTripId) {
          return { ...trip, orders: reorderedOrders };
        }
        return trip;
      });
      setAllTrips(updatedTrips);

      // Call the reorder API to persist the change
      await handleReorderOrders(targetTripId, reorderedOrders);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reorder orders");
      // Refresh to restore original state
      fetchTrips();
    }

    setDraggedOrder(null);
  };

  // Reorder orders within a trip
  const handleReorderOrders = async (tripId: string, orders: any[]) => {
    try {
      // Prepare the sequence data
      const orderSequences = orders.map((order, index) => ({
        order_id: order.id,
        sequence_number: index,
      }));

      // Call the reorder API
      await tmsAPI.reorderTripOrders(tripId, {
        order_sequences: orderSequences,
      });

      // Refresh trips
      fetchTrips();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reorder orders");
      fetchTrips(); // Refresh to restore original order
    }
  };

  // Remove order from trip
  const handleRemoveOrder = async (tripId: string, orderId: string) => {
    if (!confirm("Are you sure you want to remove this order from the trip?")) {
      return;
    }

    try {
      await tmsAPI.removeOrderFromTrip(tripId, orderId);

      // Refresh trips and orders
      await Promise.all([fetchTrips(), fetchResources()]);

      alert(`Successfully removed order ${orderId} from trip ${tripId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove order from trip");
    }
  };

  // Split order logic - open item selection modal
  const handleSplitOrder = (order: any) => {
    if (!selectedTripForOrders) return;

    const availableCapacity =
      (selectedTripForOrders.capacityTotal || 0) -
      (selectedTripForOrders.capacityUsed || 0);

    if (availableCapacity <= 0) {
      alert("No available capacity to split this order!");
      return;
    }

    // Set the order and initialize split state
    setSplitOrder(order);
    setSelectedSplitItems([]);
    setSplitItemQuantities({});
    setShowSplitOptions(true);
  };

  const handleConfirmSplit = async () => {
    if (!splitOrder || !selectedTripForOrders || selectedSplitItems.length === 0) return;

    try {
      // Get the order items with fallback support
      const orderItems = splitOrder.items_data || splitOrder.items_json || splitOrder.items;
      const itemsArray = Array.isArray(orderItems) ? orderItems : [];

      if (itemsArray.length === 0) {
        alert("Order has no items to split");
        return;
      }

      // Create arrays for assigned and remaining items with adjusted quantities
      type OrderItem = {
        id?: string;
        product_id?: string;
        quantity?: number;
        weight?: number;
        volume?: number;
        total_price?: number;
        unit_price?: number;
        product_name?: string;
        product_code?: string;
        description?: string;
        unit?: string;
        weight_type?: string;
        fixed_weight?: number;
        weight_unit?: string;
        total_weight?: number;
      };

      const itemsToAssign: OrderItem[] = [];
      const itemsRemaining: OrderItem[] = [];

      itemsArray.forEach((item: OrderItem, idx: number) => {
        // Use composite key to match what's stored in selectedSplitItems
        const itemId = `${splitOrder.id}-${item.id || item.product_id || idx}`;

        // CRITICAL: For partially assigned orders, use remaining_quantity instead of quantity
        // quantity is the full original (30), remaining_quantity is what's available to assign (20)
        const availableQuantity = (item as any).remaining_quantity !== undefined
          ? (item as any).remaining_quantity
          : (item.quantity || 1);

        const originalQuantity = (item as any).original_quantity || item.quantity || 1;

        // Validate weight calculation - use per-unit weight from API
        const weightPerUnit = item.weight || (originalQuantity > 0 ? (item.total_weight || 0) / originalQuantity : 0);
        const volumePerUnit = (item as any).volume || (originalQuantity > 0 ? ((item as any).total_volume || 0) / originalQuantity : 0);
        const pricePerUnit = originalQuantity > 0 ? (item.total_price || 0) / originalQuantity : 0;

        if (selectedSplitItems.includes(itemId)) {
          // This item is selected - assign the specified quantity (max is availableQuantity)
          const assignQuantity = splitItemQuantities[itemId] || availableQuantity;

          if (assignQuantity > 0) {
            // Create item with assigned quantity
            itemsToAssign.push({
              ...item,
              quantity: assignQuantity,
              original_quantity: assignQuantity,  // CRITICAL: This is the original quantity for THIS assignment
              weight: weightPerUnit,  // Store weight PER UNIT (not total)
              total_weight: weightPerUnit * assignQuantity,  // Total weight for assigned quantity
              volume: volumePerUnit * assignQuantity,
              total_price: pricePerUnit * assignQuantity,
            });
          }

          // If there's remaining quantity, add to remaining items
          if (assignQuantity < availableQuantity) {
            const remainingQuantity = availableQuantity - assignQuantity;
            itemsRemaining.push({
              ...item,
              quantity: remainingQuantity,
              original_quantity: originalQuantity,  // CRITICAL: Store original quantity for correct weight calculations
              weight: weightPerUnit,  // Store weight PER UNIT (not total)
              total_weight: weightPerUnit * remainingQuantity,  // Total weight for remaining quantity
              volume: volumePerUnit * remainingQuantity,
              total_price: pricePerUnit * remainingQuantity,
            });
          }
        } else {
          // This item is not selected - all available quantity remains
          // IMPORTANT: Ensure original_quantity and total_weight are set correctly
          itemsRemaining.push({
            ...item,
            quantity: availableQuantity,
            original_quantity: originalQuantity,
            weight: weightPerUnit,
            total_weight: weightPerUnit * availableQuantity,
          });
        }
      });

      // Validate that we have items to assign
      if (itemsToAssign.length === 0) {
        alert("No items selected for assignment");
        return;
      }

      // Calculate totals - use total_weight (not weight per unit)
      const assignedWeight = itemsToAssign.reduce((sum: number, item: { total_weight?: number }) => sum + (item.total_weight || 0), 0);
      const assignedVolume = itemsToAssign.reduce((sum: number, item: { volume?: number }) => sum + (item.volume || 0), 0);
      const assignedTotal = itemsToAssign.reduce((sum: number, item: { total_price?: number }) => sum + (item.total_price || 0), 0);
      const assignedQuantity = itemsToAssign.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 0), 0);

      const remainingWeight = itemsRemaining.reduce((sum: number, item: { total_weight?: number }) => sum + (item.total_weight || (item.weight || 0) * (item.quantity || 1)), 0);
      const remainingQuantity = itemsRemaining.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 0), 0);

      // Create split order data
      const splitOrderData: OrderAssignData = {
        order_id: splitOrder.id,
        customer: splitOrder.customer || "Unknown Customer",
        customerAddress: splitOrder.customerAddress || splitOrder.address,
        total: assignedTotal,
        weight: Math.round(assignedWeight * 100) / 100,
        volume: Math.round(assignedVolume * 100) / 100,
        items: itemsToAssign.length,
        priority: splitOrder.priority || "normal",
        address: splitOrder.address || splitOrder.customerAddress,
        original_order_id: splitOrder.id,
        original_items: itemsArray.reduce((sum: number, item: { quantity?: number }) => sum + (item.quantity || 0), 0),
        original_weight: splitOrder.weight || assignedWeight + remainingWeight,
        items_json: itemsToAssign,
        remaining_items_json: itemsRemaining,
      };

      // Validate capacity before assignment
      const newCapacityUsed = (selectedTripForOrders.capacityUsed || 0) + assignedWeight;
      if (newCapacityUsed > (selectedTripForOrders.capacityTotal || 0)) {
        alert(`Insufficient capacity! Required: ${assignedWeight.toFixed(2)}kg, Available: ${((selectedTripForOrders.capacityTotal || 0) - (selectedTripForOrders.capacityUsed || 0)).toFixed(2)}kg`);
        return;
      }

      // Assign split order to trip
      await tmsAPI.assignOrdersToTrip(selectedTripForOrders.id, [splitOrderData]);

      // Show success message
      alert(
        `Successfully assigned ${itemsToAssign.length} item types (${assignedQuantity} units, ${assignedWeight.toFixed(2)}kg) to trip. ` +
        `${itemsRemaining.length} item types (${remainingQuantity} units, ${remainingWeight.toFixed(2)}kg) remaining from order ${splitOrder.id}.`
      );

      // Reset split state and close modals
      setSplitOrder(null);
      setSelectedSplitItems([]);
      setSplitItemQuantities({});
      setShowSplitOptions(false);
      setShowOrderModal(false);
      setExpandedOrderIds(new Set());
      setSelectedTripForOrders(null);
      setSelectedOrders([]);

      // Refresh trips and orders
      await Promise.all([fetchTrips(), fetchResources()]);
    } catch (err) {
      console.error("Error splitting order:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to split order";
      alert(`Error: ${errorMessage}\n\nPlease check the console for details.`);
    }
  };

  const handleAddOrderClick = (trip: Trip) => {
    setSelectedTripForOrders(trip);
    setSelectedOrders([]);
    setShowOrderModal(true);
  };

  const handleOrderToggle = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const calculateTotalWeight = (orderIds: string[]) => {
    return orderIds.reduce((total, orderId) => {
      const order = availableOrders.find((o) => o.id === orderId);
      if (!order) return total;

      // If items_json exists, calculate weight from individual items
      // For partial orders, use remaining_quantity to calculate available weight
      if (order.items_json && Array.isArray(order.items_json) && order.items_json.length > 0) {
        const itemsWeight = order.items_json.reduce((itemSum: number, item: any) => {
          // Use remaining_quantity if available (for partially assigned orders)
          // Otherwise use the full quantity
          const availableQty = item.remaining_quantity !== undefined
            ? item.remaining_quantity
            : (item.quantity || 1);
          // Calculate weight: weight per unit × available quantity
          return itemSum + ((item.weight || 0) * availableQty);
        }, 0);
        return total + itemsWeight;
      }

      // Fall back to order.weight for orders without items_json
      return total + (order.weight || 0);
    }, 0);
  };

  const getCapacityPercentage = (used: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((used / total) * 100);
  };

  const getCapacityColor = (percentage: number) => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const handleAssignOrders = async () => {
    if (!selectedTripForOrders || selectedOrders.length === 0) return;

    try {
      // Prepare orders data
      const ordersData: OrderAssignData[] = [];
      const errors: string[] = [];

      for (const orderId of selectedOrders) {
        const order = availableOrders.find((o) => o.id === orderId);
        if (!order) {
          errors.push(`Order ${orderId} not found`);
          continue;
        }

        try {
          // Standardize items data - prefer items_data, fallback to items_json, then items
          let itemsArray: any[] = [];

          if (Array.isArray(order.items_data) && order.items_data.length > 0) {
            itemsArray = order.items_data;
          } else if (Array.isArray(order.items_json) && order.items_json.length > 0) {
            itemsArray = order.items_json;
          } else if (Array.isArray(order.items) && order.items.length > 0) {
            itemsArray = order.items;
          } else {
            errors.push(`Order ${order.id} has no items data`);
            continue;
          }

          // Validate items have required fields
          const validItems = itemsArray.filter(item =>
            item && (item.id || item.product_id) && item.quantity > 0
          );

          if (validItems.length === 0) {
            errors.push(`Order ${order.id} has no valid items`);
            continue;
          }

          // Calculate weight, volume, and total from the items we're actually assigning
          // IMPORTANT: Calculate based on quantity × weight per unit (or use total_weight if available)
          const assignedWeight = validItems.reduce((sum: number, item: any) => {
            const itemQty = item.quantity || 1;
            // Use total_weight if available (already calculated), otherwise calculate from weight × quantity
            if (item.total_weight) {
              return sum + item.total_weight;
            }
            return sum + (itemQty * (item.weight || 0));
          }, 0);
          const assignedVolume = validItems.reduce((sum: number, item: any) => {
            const itemQty = item.quantity || 1;
            // Use total_volume if available, otherwise calculate from volume × quantity
            if (item.total_volume) {
              return sum + item.total_volume;
            }
            return sum + (itemQty * (item.volume || 0));
          }, 0);
          const assignedTotal = validItems.reduce((sum: number, item: { total_price?: number }) => sum + (item.total_price || 0), 0);

          // Validate calculated values
          if (assignedWeight <= 0) {
            errors.push(`Order ${order.id} has invalid weight: ${assignedWeight}`);
            continue;
          }

          // IMPORTANT: Ensure items_json includes original_quantity and weight PER UNIT
          // This prevents the Orders service from recalculating wrong weight per unit
          const itemsJsonWithOriginalQuantity = validItems.map((item: any) => ({
            ...item,
            // Ensure original_quantity is set (for correct weight per unit calculations)
            original_quantity: item.original_quantity || item.quantity || item.original_quantity,
            // Ensure weight is PER UNIT (not total)
            weight: item.weight || (item.total_weight ? item.total_weight / (item.quantity || 1) : 0),
            // Calculate total_weight if not present
            total_weight: item.total_weight || ((item.quantity || 1) * (item.weight || 0)),
          }));

          ordersData.push({
            order_id: order.id,
            customer: order.customer || "Unknown Customer",
            customerAddress: order.customerAddress || order.address,
            total: assignedTotal,
            weight: assignedWeight,
            volume: assignedVolume,
            items: validItems.length,
            items_json: itemsJsonWithOriginalQuantity, // Items with original_quantity and per-unit weight
            remaining_items_json: [], // Will be empty since we're assigning all remaining items
            original_items: order.items_count || order.items || validItems.length,
            original_weight: order.weight || assignedWeight,
            priority: order.priority || "normal",
            address: order.address || order.customerAddress,
          });
        } catch (err) {
          errors.push(`Error processing order ${order.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Check for validation errors
      if (errors.length > 0) {
        alert(`Validation errors:\n${errors.join('\n')}`);
        return;
      }

      if (ordersData.length === 0) {
        alert("No valid orders to assign");
        return;
      }

      // Check capacity (non-blocking warning for planning stage)
      const newCapacityUsed =
        (selectedTripForOrders.capacityUsed || 0) +
        ordersData.reduce((sum, order) => sum + order.weight, 0);

      // Capacity check removed - assignment allowed in planning stage
      // Warning will be displayed in UI if over capacity

      // Assign orders via API
      await tmsAPI.assignOrdersToTrip(selectedTripForOrders.id, ordersData);

      // Refresh trips and orders to get updated state
      await Promise.all([fetchTrips(), fetchResources()]);

      // Close modal and reset
      setShowOrderModal(false);
      setSelectedTripForOrders(null);
      setSelectedOrders([]);

      // Show success message
      alert(`Successfully assigned ${ordersData.length} order(s) to trip!`);
    } catch (err) {
      console.error("Error assigning orders:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to assign orders";
      alert(`Error: ${errorMessage}\n\nPlease check the console for details.`);
    }
  };

  // Calculate statistics
  const tripStats = {
    planning: allTrips.filter((t) => t.status === "planning").length,
    loading: allTrips.filter((t) => t.status === "loading").length,
    onRoute: allTrips.filter((t) => t.status === "on-route").length,
    completed: allTrips.filter((t) => t.status === "completed").length,
    cancelled: allTrips.filter((t) => t.status === "cancelled").length,
  };

  const activeTrips = statusFilter
    ? allTrips.filter((t) => t.status === statusFilter)
    : allTrips;

  return (
    <div className="space-y-6">
      {/* Loading and Error States */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading trips data...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading data
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <Button
                  onClick={() => {
                    setError(null);
                    fetchTrips();
                    fetchResources();
                  }}
                  variant="outline"
                  size="sm"
                  className="text-red-700 border-red-300 hover:bg-red-50"
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Page Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-black">
                Logistics Manager
              </h1>
              <p className="text-gray-500 mt-2">
                Create trip plans and manage truck/driver assignments
              </p>
            </div>
            <Button
              onClick={() => setShowCreateTrip(true)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Create New Trip
            </Button>
          </div>

          {/* Status Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "planning"
                ? "ring-2 ring-blue-500 bg-blue-50"
                : ""
                }`}
              onClick={() =>
                setStatusFilter(statusFilter === "planning" ? null : "planning")
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${statusFilter === "planning"
                      ? "bg-blue-100"
                      : "bg-gray-100"
                      }`}
                  >
                    <Package
                      className={`w-5 h-5 ${statusFilter === "planning"
                        ? "text-blue-600"
                        : "text-gray-600"
                        }`}
                    />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-black">
                      {tripStats.planning}
                    </p>
                    <p
                      className={`text-sm ${statusFilter === "planning"
                        ? "text-blue-600 font-medium"
                        : "text-gray-500"
                        }`}
                    >
                      Planning
                      {statusFilter === "planning" && (
                        <span className="ml-1">✓</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "loading"
                ? "ring-2 ring-blue-500 bg-blue-50"
                : ""
                }`}
              onClick={() =>
                setStatusFilter(statusFilter === "loading" ? null : "loading")
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${statusFilter === "loading"
                      ? "bg-yellow-100"
                      : "bg-yellow-50"
                      }`}
                  >
                    <Truck className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-black">
                      {tripStats.loading}
                    </p>
                    <p
                      className={`text-sm ${statusFilter === "loading"
                        ? "text-blue-600 font-medium"
                        : "text-gray-500"
                        }`}
                    >
                      Loading
                      {statusFilter === "loading" && (
                        <span className="ml-1">✓</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "on-route"
                ? "ring-2 ring-blue-500 bg-blue-50"
                : ""
                }`}
              onClick={() =>
                setStatusFilter(statusFilter === "on-route" ? null : "on-route")
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${statusFilter === "on-route" ? "bg-blue-100" : "bg-blue-50"
                      }`}
                  >
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-black">
                      {tripStats.onRoute}
                    </p>
                    <p
                      className={`text-sm ${statusFilter === "on-route"
                        ? "text-blue-600 font-medium"
                        : "text-gray-500"
                        }`}
                    >
                      On Route
                      {statusFilter === "on-route" && (
                        <span className="ml-1">✓</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "completed"
                ? "ring-2 ring-blue-500 bg-blue-50"
                : ""
                }`}
              onClick={() =>
                setStatusFilter(
                  statusFilter === "completed" ? null : "completed"
                )
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${statusFilter === "completed"
                      ? "bg-green-100"
                      : "bg-green-50"
                      }`}
                  >
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-black">
                      {tripStats.completed}
                    </p>
                    <p
                      className={`text-sm ${statusFilter === "completed"
                        ? "text-blue-600 font-medium"
                        : "text-gray-500"
                        }`}
                    >
                      Completed
                      {statusFilter === "completed" && (
                        <span className="ml-1">✓</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "cancelled"
                ? "ring-2 ring-blue-500 bg-blue-50"
                : ""
                }`}
              onClick={() =>
                setStatusFilter(
                  statusFilter === "cancelled" ? null : "cancelled"
                )
              }
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${statusFilter === "cancelled" ? "bg-red-100" : "bg-red-50"
                      }`}
                  >
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-black">
                      {tripStats.cancelled}
                    </p>
                    <p
                      className={`text-sm ${statusFilter === "cancelled"
                        ? "text-blue-600 font-medium"
                        : "text-gray-500"
                        }`}
                    >
                      Cancelled
                      {statusFilter === "cancelled" && (
                        <span className="ml-1">✓</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="trips" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trips" className="text-black">
                Trips ({activeTrips.length})
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-black">
                Orders ({getApprovedOrders().length})
              </TabsTrigger>
              <TabsTrigger value="resources" className="text-black">
                Resources
              </TabsTrigger>
            </TabsList>


            {/* Trips Tab */}
            <TabsContent value="trips">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-black">All Trips</CardTitle>
                    {statusFilter && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          Filter:{" "}
                          <span className="font-medium text-blue-600">
                            {statusFilter.replace("-", " ").toUpperCase()}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatusFilter(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {activeTrips.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {statusFilter
                            ? `No ${statusFilter.replace("-", " ")} trips`
                            : "No trips available"}
                        </h3>
                        <p className="text-gray-500">
                          {statusFilter
                            ? `There are no trips with ${statusFilter.replace(
                              "-",
                              " "
                            )} status.`
                            : "Create your first trip to get started."}
                        </p>
                        {statusFilter && (
                          <Button
                            onClick={() => setStatusFilter(null)}
                            variant="outline"
                            className="mt-4"
                          >
                            Clear Filter
                          </Button>
                        )}
                      </div>
                    ) : (
                      activeTrips.map((trip) => (
                        <div
                          key={trip.id}
                          className={`border border-gray-200 rounded-lg overflow-hidden transition-all ${isTripLocked(trip.status)
                            ? "bg-gray-50"
                            : "bg-white"
                            }`}
                        >
                          {/* Trip Layout - Split into Left Sidebar and Right Content */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-[400px]">

                            {/* LEFT SIDEBAR - Trip Details */}
                            <div className="lg:col-span-4 border-r border-gray-200 bg-white flex flex-col">

                              {/* Trip Header */}
                              <div className="p-6 border-b border-gray-200">
                                <h3 className="font-bold text-2xl text-gray-900 mb-2">
                                  {trip.id}
                                </h3>
                                <Badge
                                  variant={getStatusVariant(trip.status)}
                                  className="text-xs uppercase px-3 py-1"
                                >
                                  {trip.status.toUpperCase().replace("-", " ")}
                                </Badge>
                                {isTripLocked(trip.status) && (
                                  <Badge variant="warning" className="text-xs ml-2">
                                    LOCKED
                                  </Badge>
                                )}
                                {/* Time in current status with from/to status */}
                                {(trip.time_in_current_status_minutes !== undefined && trip.time_in_current_status_minutes !== null) && (
                                  <div className="mt-2 text-xs text-gray-600">
                                    {trip.from_status && trip.to_status ? (
                                      <div className="flex items-center gap-1 mb-1">
                                        <span className="font-medium">
                                          {trip.from_status.replace("-", " ")} → {trip.to_status.replace("-", " ")}
                                        </span>
                                      </div>
                                    ) : null}
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      <span>
                                        For <DurationDisplay minutes={trip.time_in_current_status_minutes || 0} />
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Origin */}
                              <div className="px-6 py-4 border-b border-gray-200">
                                <div className="flex items-center gap-2 text-gray-600 mb-1">
                                  <MapPin className="w-4 h-4" />
                                  <span className="text-sm font-medium">Origin</span>
                                </div>
                                <p className="text-gray-900 font-medium ml-6">
                                  {trip.origin || "Not set"}
                                </p>
                              </div>

                              {/* Truck Section */}
                              <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
                                <div className="flex items-center gap-2 text-blue-700 mb-3">
                                  <Truck className="w-5 h-5" />
                                  <span className="text-sm font-semibold">Truck</span>
                                </div>
                                {trip.truck ? (
                                  <div className="ml-7">
                                    <p className="font-bold text-lg text-gray-900 mb-1">
                                      {trip.truck.plate}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Capacity: {trip.capacityTotal ? `${trip.capacityTotal.toLocaleString()} kg` : 'N/A'}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 italic ml-7">Not assigned</p>
                                )}
                              </div>

                              {/* Maintenance Note for Paused Trips */}
                              {trip.status === "paused" && (
                                <div className="px-6 py-4 border-b border-gray-200 bg-amber-50">
                                  <div className="flex items-center gap-2 text-amber-800 mb-2">
                                    <AlertCircle className="w-4 h-4" />
                                    <p className="text-sm font-semibold">
                                      Maintenance Note
                                    </p>
                                  </div>
                                  {trip.maintenanceNote ? (
                                    <p className="text-sm text-amber-900 ml-6 italic">
                                      {trip.maintenanceNote}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-amber-700 ml-6 italic">
                                      No maintenance note provided
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Driver Section */}
                              <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
                                <div className="flex items-center gap-2 text-green-700 mb-3">
                                  <User className="w-5 h-5" />
                                  <span className="text-sm font-semibold">Driver</span>
                                </div>
                                {trip.driver ? (
                                  <div className="ml-7">
                                    <p className="font-bold text-lg text-gray-900 mb-1">
                                      {trip.driver.name}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {trip.driver.phone}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 italic ml-7">Not assigned</p>
                                )}
                              </div>

                              {/* Orders Count Section */}
                              <div className="px-6 py-4 border-b border-gray-200 bg-orange-50">
                                <div className="flex items-center gap-2 text-orange-700 mb-3">
                                  <Package className="w-5 h-5" />
                                  <span className="text-sm font-semibold">Orders</span>
                                </div>
                                <p className="font-bold text-3xl text-gray-900 ml-7">
                                  {trip.orders.length} Order{trip.orders.length !== 1 ? 's' : ''}
                                </p>
                              </div>

                              {/* Load Capacity */}
                              <div className="px-6 py-4 flex-1 flex flex-col justify-end">
                                <div className="mb-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-gray-700">Load Capacity</span>
                                    <span className="text-2xl font-bold text-green-600">
                                      {trip.capacityTotal && trip.capacityTotal > 0
                                        ? getCapacityPercentage(trip.capacityUsed || 0, trip.capacityTotal)
                                        : 0}%
                                    </span>
                                  </div>
                                  {trip.capacityTotal && trip.capacityTotal > 0 && (
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                      <div
                                        className={`h-3 rounded-full transition-all ${getCapacityColor(
                                          getCapacityPercentage(
                                            trip.capacityUsed || 0,
                                            trip.capacityTotal
                                          )
                                        )}`}
                                        style={{
                                          width: `${Math.min(
                                            getCapacityPercentage(
                                              trip.capacityUsed || 0,
                                              trip.capacityTotal
                                            ),
                                            100
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Capacity Warning Indicator */}
                                {trip.capacityUsed && trip.capacityTotal &&
                                  trip.capacityUsed > trip.capacityTotal && (
                                  <div className="mt-2 bg-yellow-50 border border-yellow-300 rounded-lg p-2">
                                    <div className="flex items-center gap-2 text-yellow-800">
                                      <AlertTriangle className="w-4 h-4" />
                                      <span className="text-xs font-medium">
                                        Over capacity: {(trip.capacityUsed - trip.capacityTotal).toFixed(2)}kg
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Add Orders Button */}
                                {trip.status === "planning" && (
                                  <Button
                                    onClick={() => handleAddOrderClick(trip)}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base font-semibold"
                                  >
                                    <Plus className="w-5 h-5 mr-2" />
                                    Add Orders
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* RIGHT CONTENT - Orders List */}
                            <div className="lg:col-span-8 bg-gray-50">

                              {/* Orders Header */}
                              <div className="px-6 py-4 bg-white border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-lg font-bold text-gray-900">
                                    Orders ({trip.orders.length})
                                  </h4>
                                  {getNextStatusOptions(trip.status).length > 0 && (
                                    <div className="flex gap-2">
                                      {getNextStatusOptions(trip.status).map((option) => (
                                        <Button
                                          key={option.value}
                                          size="sm"
                                          onClick={() =>
                                            handleStatusChange(trip.id, option.value)
                                          }
                                          className={`text-xs text-white border-transparent hover:opacity-90 ${option.color === "red"
                                            ? "bg-red-600 hover:bg-red-700"
                                            : option.color === "green"
                                              ? "bg-green-600 hover:bg-green-700"
                                              : option.color === "blue"
                                                ? "bg-blue-600 hover:bg-blue-700"
                                                : option.color === "yellow"
                                                  ? "bg-yellow-600 hover:bg-yellow-700"
                                                  : "bg-gray-600 hover:bg-gray-700"
                                            }`}
                                        >
                                          {option.color === "red" && (
                                            <XCircle className="w-3 h-3 mr-1 text-white" />
                                          )}
                                          {option.color === "green" && (
                                            <CheckCircle className="w-3 h-3 mr-1 text-white" />
                                          )}
                                          {option.color === "blue" && (
                                            <Play className="w-3 h-3 mr-1 text-white" />
                                          )}
                                          {option.color === "yellow" && (
                                            <Package className="w-3 h-3 mr-1 text-white" />
                                          )}
                                          {option.color === "gray" && (
                                            <RotateCcw className="w-3 h-3 mr-1 text-white" />
                                          )}
                                          {option.label}
                                        </Button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Orders List */}
                              <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                                {trip.orders.length > 0 ? (
                                  trip.orders.map((order, orderIndex) => (
                                    <div
                                      key={order.id}
                                      draggable={trip.status === "planning"}
                                      onDragStart={(e) => handleOrderDragStart(e, order, trip.id, orderIndex)}
                                      onDragOver={(e) => handleOrderDragOver(e, trip.id, orderIndex)}
                                      onDragLeave={handleOrderDragLeave}
                                      onDrop={(e) => handleOrderDrop(e, trip.id, orderIndex)}
                                      className={`bg-white border border-gray-200 rounded-lg overflow-hidden transition-shadow ${
                                        trip.status === "planning" ? "hover:shadow-md cursor-move" : ""
                                      } ${
                                        draggedOrder?.id === order.id ? "opacity-50" : ""
                                      } ${
                                        dragOverOrderIndex === orderIndex && draggedOrder?.id !== order.id ? "border-blue-500 border-2" : ""
                                      }`}
                                    >
                                      {/* Order Header */}
                                      <div className="p-4 bg-gray-50 border-b border-gray-200">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            {trip.status === "planning" && (
                                              <GripVertical className="w-5 h-5 text-gray-400 cursor-grab active:cursor-grabbing" />
                                            )}
                                            <span className="text-sm font-bold text-white bg-gray-700 px-3 py-1 rounded">
                                              #{order.sequence_number !== undefined ? order.sequence_number + 1 : orderIndex + 1}
                                            </span>
                                            <span className="font-bold text-lg text-gray-900">{order.id}</span>
                                            <Badge
                                              variant={getStatusVariant(order.status || trip.status)}
                                              className="text-xs uppercase"
                                            >
                                              {(order.status || trip.status).toUpperCase().replace("-", " ")}
                                            </Badge>
                                          </div>
                                          <div className="flex items-center gap-4">
                                            <div className="text-right">
                                              <p className="text-sm font-semibold text-gray-600">Weight</p>
                                              <p className="text-xl font-bold text-gray-900">
                                                {order.weight ? order.weight.toFixed(2) : '0.00'} kg
                                              </p>
                                            </div>
                                            {trip.status === "planning" && (
                                              <button
                                                onClick={() => handleRemoveOrder(trip.id, order.order_id || order.id)}
                                                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Remove order from trip"
                                              >
                                                <Trash2 className="w-5 h-5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Order Details */}
                                      <div className="p-4">
                                        <div className="flex items-start gap-2 mb-4">
                                          <MapPin className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                                          <div>
                                            <p className="font-semibold text-gray-900">
                                              {order.customer || "Unknown Customer"}
                                            </p>
                                            {order.address && (
                                              <p className="text-sm text-gray-600 mt-1">{order.address}</p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 mb-4">
                                          <Package className="w-4 h-4 text-gray-500" />
                                          <span className="text-sm text-gray-600">
                                            {typeof order.items === 'number'
                                              ? order.items
                                              : (order.items_count || 0)} items
                                          </span>
                                        </div>

                                        {/* Order Items Table */}
                                        {Array.isArray(order.items_data) && order.items_data.length > 0 ? (
                                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <table className="w-full text-sm">
                                              <thead className="bg-gray-100 border-b border-gray-200">
                                                <tr>
                                                  <th className="text-left py-2 px-3 font-semibold text-gray-700">#</th>
                                                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Product</th>
                                                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Planned Qty</th>
                                                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Wt/Unit</th>
                                                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Total Wt</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-200">
                                                {order.items_data.map((item, itemIndex) => (
                                                  <tr key={item.id || itemIndex} className="hover:bg-gray-50">
                                                    <td className="py-3 px-3 text-gray-600">{itemIndex + 1}</td>
                                                    <td className="py-3 px-3">
                                                      <div>
                                                        <p className="font-medium text-gray-900">
                                                          {item.product_name || "Unknown Product"}
                                                        </p>
                                                        {item.product_code && (
                                                          <p className="text-xs text-gray-500">{item.product_code}</p>
                                                        )}
                                                      </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-medium text-gray-900">
                                                      {item.quantity || 0}
                                                    </td>
                                                    <td className="py-3 px-3 text-right text-gray-900">
                                                      {item.weight ?? 0}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-bold text-gray-900">
                                                      {item.total_weight ?? (item.weight * item.quantity) ?? 0}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                                <tr>
                                                  <td colSpan={2} className="py-3 px-3 font-bold text-gray-900">Order Total</td>
                                                  <td className="py-3 px-3 text-right font-bold text-gray-900">
                                                    {order.items_data.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                                                  </td>
                                                  <td className="py-3 px-3"></td>
                                                  <td className="py-3 px-3 text-right font-bold text-gray-900">
                                                    {order.items_data.reduce((sum, item) => sum + (item.total_weight ?? (item.weight * item.quantity) ?? 0), 0).toFixed(2)}
                                                  </td>
                                                </tr>
                                              </tfoot>
                                            </table>
                                          </div>
                                        ) : (
                                          <div className="text-center py-6 text-gray-500 text-sm border border-gray-200 rounded-lg bg-gray-50">
                                            No items found for this order
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
                                    <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                    <p className="text-gray-600 font-medium">No orders assigned to this trip yet</p>
                                    {trip.status === "planning" && (
                                      <p className="text-sm mt-2 text-gray-400">
                                        Click &quot;Add Orders&quot; to assign orders to this trip
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Trip Totals Summary */}
                                {trip.orders.length > 0 && (
                                  <div className="bg-white border border-gray-300 rounded-lg p-6 mt-6">
                                    <h5 className="font-bold text-lg text-gray-900 mb-4">Trip Totals</h5>
                                    <div className="grid grid-cols-2 gap-6">
                                      <div>
                                        <p className="text-sm text-gray-600 mb-1">Total Orders</p>
                                        <p className="text-4xl font-bold text-gray-900">{trip.orders.length}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-gray-600 mb-1">Total Weight</p>
                                        <p className="text-4xl font-bold text-gray-900">
                                          {trip.orders.reduce((sum, order) => sum + (order.weight || 0), 0).toFixed(2)} kg
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Drag Instructions */}
                          {trip.status === "planning" && trip.orders.length > 0 && (
                            <div className="p-4 bg-blue-50 border-t border-blue-200">
                              <p className="text-sm text-blue-800">
                                <strong>Drag & Drop:</strong> Drag orders to reorder them within this trip. Orders can only be reordered while the trip is in planning status.
                              </p>
                            </div>
                          )}

                          {/* Lock Status Message */}
                          {isTripLocked(trip.status) && (
                            <div className="p-4 bg-yellow-50 border-t border-yellow-200">
                              <p className="text-sm text-yellow-800">
                                <strong>Trip is locked:</strong> Order details cannot be modified when trip is {trip.status.replace("-", " ")}.
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Approved Orders Tab */}
            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle className="text-black">
                    Orders ({getApprovedOrders().length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getApprovedOrders().map((order) => (
                      <div
                        key={order.id}
                        className="border border-gray-200 rounded-lg bg-white hover:shadow-md transition-all"
                      >
                        {/* Order Card Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">

                          {/* LEFT SIDEBAR - Order Summary */}
                          <div className="lg:col-span-4 border-r border-gray-200 bg-white p-6">

                            {/* Order Header */}
                            <div className="mb-4">
                              <h3 className="font-bold text-2xl text-gray-900 mb-2">
                                {order.id}
                              </h3>
                              <div className="flex flex-wrap gap-2 mb-3">
                                <Badge
                                  variant={getOrderStatusVariant(order.status)}
                                  className="text-xs uppercase"
                                >
                                  {getOrderStatusDisplay(order.status)}
                                </Badge>
                                <Badge
                                  variant={getTmsStatusVariant(order.tms_order_status || "available")}
                                  className="text-xs uppercase"
                                >
                                  {getTmsStatusDisplay(order.tms_order_status || "available")}
                                </Badge>
                                {order.priority && (
                                  <Badge
                                    variant={getPriorityVariant(order.priority)}
                                    className="text-xs uppercase"
                                  >
                                    {order.priority}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{order.date}</p>
                            </div>

                            {/* Customer Section */}
                            <div className="mb-4 pb-4 border-b border-gray-200">
                              <div className="flex items-start gap-2">
                                <User className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Customer</p>
                                  <p className="font-semibold text-gray-900">{order.customer}</p>
                                </div>
                              </div>
                            </div>

                            {/* Address Section */}
                            <div className="mb-4 pb-4 border-b border-gray-200">
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Delivery Address</p>
                                  <p className="text-sm text-gray-900">{order.address}</p>
                                </div>
                              </div>
                            </div>

                            {/* Order Stats */}
                            <div className="space-y-3 mb-6">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Items</span>
                                <span className="text-lg font-bold text-gray-900">
                                  {typeof order.items === 'number' ? order.items : (order.items_count || 0)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Weight</span>
                                <span className="text-lg font-bold text-gray-900">
                                  {order.weight} kg
                                </span>
                              </div>
                              {/* <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Volume</span>
                                <span className="text-lg font-bold text-gray-900">
                                  {order.volume} L
                                </span>
                              </div> */}
                              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                <span className="text-sm text-gray-600">Total Amount</span>
                                <span className="text-2xl font-bold text-gray-900">
                                  ₹{order.total.toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Action Button */}
                            <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5">
                              Assign to Trip
                            </Button>
                          </div>

                          {/* RIGHT CONTENT - Order Items */}
                          <div className="lg:col-span-8 bg-gray-50 p-6">

                            {/* Items Header */}
                            <div className="mb-4">
                              <h4 className="text-lg font-bold text-gray-900">
                                Order Items ({Array.isArray(order.items_data) ? order.items_data.length : (typeof order.items === 'number' ? order.items : 0)})
                              </h4>
                            </div>

                            {/* Items List/Table */}
                            {Array.isArray(order.items_data) && order.items_data.length > 0 ? (
                              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100 border-b border-gray-200">
                                    <tr>
                                      <th className="text-left py-3 px-4 font-semibold text-gray-700">#</th>
                                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Quantity</th>
                                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Weight/Unit</th>
                                      {/* <th className="text-right py-3 px-4 font-semibold text-gray-700">Volume</th> */}
                                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Price/Unit</th>
                                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Weight</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {order.items_data.map((item: any, itemIndex: number) => (
                                      <tr key={item.id || itemIndex} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 text-gray-600">{itemIndex + 1}</td>
                                        <td className="py-3 px-4">
                                          <div>
                                            <p className="font-medium text-gray-900">
                                              {item.product_name || "Unknown Product"}
                                            </p>
                                            {item.product_code && (
                                              <p className="text-xs text-gray-500">{item.product_code}</p>
                                            )}
                                            {item.description && (
                                              <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                                          {item.quantity} {item.unit || "pcs"}
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-900">
                                          {item.weight ?? 0} {item.weight_unit || "kg"}
                                          {item.weight_type && (
                                            <span className="text-xs text-gray-400 block">({item.weight_type})</span>
                                          )}
                                        </td>
                                        {/* <td className="py-3 px-4 text-right text-gray-900">
                                          {item.volume ?? 0} m³
                                        </td> */}
                                        <td className="py-3 px-4 text-right text-gray-900">
                                          {item.unit_price ? `₹${item.unit_price}` : "N/A"}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-gray-900">
                                          {item.total_weight ?? (item.weight * item.quantity) ?? 0} kg
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                    <tr>
                                      <td colSpan={2} className="py-3 px-4 font-bold text-gray-900">Total</td>
                                      <td className="py-3 px-4 text-right font-bold text-gray-900">
                                        {order.items_data.reduce((sum, item) => sum + (item.quantity || 0), 0)} items
                                      </td>
                                      <td colSpan={3}></td>
                                      <td className="py-3 px-4 text-right font-bold text-gray-900">
                                        {order.items_data.reduce((sum, item) => sum + (item.total_weight ?? (item.weight * item.quantity) ?? 0), 0).toFixed(2)} kg
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            ) : (
                              <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-gray-500">No items found for this order</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Resources Tab */}
            <TabsContent value="resources">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* All Trucks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-black flex items-center gap-2">
                      <Truck className="w-5 h-5 text-gray-600" />
                      All Trucks ({availableTrucks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {availableTrucks.length > 0 ? (
                        availableTrucks.map((truck) => (
                          <div
                            key={truck.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-bold text-lg text-gray-900">{truck.plate}</h4>
                              <Badge variant={getTruckStatusVariant(truck.status)} className="text-xs capitalize">
                                {truck.status || "Unknown"}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>Model: <span className="font-medium text-gray-900">{truck.model}</span></p>
                              <p>Capacity: <span className="font-medium text-gray-900">{truck.capacity} kg</span></p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
                          <Truck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-gray-500">No trucks found</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* All Drivers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-black flex items-center gap-2">
                      <User className="w-5 h-5 text-gray-600" />
                      All Drivers ({availableDrivers.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {availableDrivers.length > 0 ? (
                        availableDrivers.map((driver) => (
                          <div
                            key={driver.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-bold text-lg text-gray-900">{driver.name}</h4>
                              <Badge variant={getDriverStatusVariant(driver.status)} className="text-xs capitalize">
                                {driver.status?.replace("_", " ") || "Unknown"}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                <span className="font-medium text-gray-900">{driver.phone}</span>
                              </p>
                              <p>Experience: <span className="font-medium text-gray-900">{driver.experience}</span></p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
                          <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-gray-500">No drivers found</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Create Trip Modal */}
          {showCreateTrip && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Modal Header - Green */}
                <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                        <Package className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">
                          Plan New Trip
                        </h2>
                        <p className="text-green-50 text-sm mt-1">
                          Select branch, truck, and driver to create a new delivery trip
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleCloseModal}
                      variant="outline"
                      size="sm"
                      className="text-white border-white/30 hover:bg-white/10 bg-transparent"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Modal Content - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
                  <div className="space-y-6">

                    {/* Select Branch Section */}
                    <div className="dropdown-container">
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-green-600" />
                        Branch <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400 pointer-events-none" />
                        <input
                          type="text"
                          value={selectedBranch ? (branches.find(b => b.id === selectedBranch)?.name || '') + ' - ' + (branches.find(b => b.id === selectedBranch)?.location || '') : ''}
                          onChange={(e) => setBranchSearchQuery(e.target.value)}
                          onFocus={() => setBranchDropdownOpen(true)}
                          placeholder="Search branches..."
                          className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 text-gray-900 rounded-xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 bg-white hover:border-green-400 cursor-pointer font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
                        >
                          <ChevronDown className={`w-5 h-5 text-green-400 transition-transform ${branchDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {branchDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                            {filteredBranches.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 text-sm font-medium">
                                No branches found
                              </div>
                            ) : (
                              <div className="py-1">
                                {filteredBranches.map((branch) => (
                                  <button
                                    type="button"
                                    key={branch.id}
                                    onClick={() => handleBranchSelect(branch.id)}
                                    className={`w-full px-4 py-3 text-left font-semibold transition-colors ${selectedBranch === branch.id
                                      ? 'bg-green-50 text-green-700'
                                      : 'text-gray-900 hover:bg-gray-50'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>{branch.name} - {branch.location}</span>
                                      {branch.status === 'active' && (
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Active</span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedBranch && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm font-medium text-gray-900">
                            {branches.find(b => b.id === selectedBranch)?.name}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {branches.find(b => b.id === selectedBranch)?.location}
                          </p>
                          {branches.find(b => b.id === selectedBranch)?.manager && (
                            <p className="text-xs text-gray-500 mt-1">
                              Manager: {branches.find(b => b.id === selectedBranch)?.manager}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Select Truck Section */}
                    <div className="dropdown-container">
                      <label className={`block text-sm font-bold mb-2 flex items-center gap-2 ${selectedBranch ? 'text-gray-700' : 'text-gray-400'
                        }`}>
                        <Truck className="w-4 h-4 text-blue-600" />
                        Truck <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${selectedBranch ? 'text-blue-400' : 'text-gray-300'
                          }`} />
                        <input
                          type="text"
                          value={selectedTruck ? (availableTrucks.find(t => t.id === selectedTruck)?.plate || '') + ' - ' + (availableTrucks.find(t => t.id === selectedTruck)?.model || '') + ` (${availableTrucks.find(t => t.id === selectedTruck)?.capacity}kg)` : ''}
                          onChange={(e) => setTruckSearchQuery(e.target.value)}
                          onFocus={() => selectedBranch && setTruckDropdownOpen(true)}
                          placeholder="Search trucks..."
                          disabled={!selectedBranch}
                          className={`w-full pl-10 pr-10 py-3 border-2 text-gray-900 rounded-xl focus:outline-none transition-all font-semibold ${!selectedBranch
                            ? 'border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500'
                            : 'border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-white hover:border-blue-400 cursor-pointer'
                            }`}
                        />
                        <button
                          type="button"
                          onClick={() => selectedBranch && setTruckDropdownOpen(!truckDropdownOpen)}
                          disabled={!selectedBranch}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 ${!selectedBranch ? 'cursor-not-allowed' : ''
                            }`}
                        >
                          <ChevronDown className={`w-5 h-5 transition-transform ${truckDropdownOpen ? 'rotate-180' : ''} ${selectedBranch ? 'text-blue-400' : 'text-gray-300'
                            }`} />
                        </button>

                        {truckDropdownOpen && selectedBranch && (
                          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                            {filteredTrucks.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 text-sm font-medium">
                                No trucks found
                              </div>
                            ) : (
                              <div className="py-1">
                                {filteredTrucks.map((truck) => (
                                  <button
                                    type="button"
                                    key={truck.id}
                                    onClick={() => {
                                      setSelectedTruck(truck.id);
                                      setTruckDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-3 text-left font-semibold transition-colors ${selectedTruck === truck.id
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'text-gray-900 hover:bg-gray-50'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>{truck.plate} - {truck.model} ({truck.capacity}kg)</span>
                                      {truck.status === 'active' && (
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Active</span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedTruck && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-gray-900">
                                {availableTrucks.find(t => t.id === selectedTruck)?.plate}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                {availableTrucks.find(t => t.id === selectedTruck)?.model}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-blue-600">Capacity</p>
                              <p className="text-lg font-bold text-blue-600">
                                {availableTrucks.find(t => t.id === selectedTruck)?.capacity?.toLocaleString()} kg
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Select Driver Section */}
                    <div className="dropdown-container">
                      <label className={`block text-sm font-bold mb-2 flex items-center gap-2 ${selectedBranch && selectedTruck ? 'text-gray-700' : 'text-gray-400'
                        }`}>
                        <User className="w-4 h-4 text-orange-600" />
                        Driver <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${selectedBranch && selectedTruck ? 'text-orange-400' : 'text-gray-300'
                          }`} />
                        <input
                          type="text"
                          value={selectedDriver ? (selectedDriver.name || '') + ' - ' + (selectedDriver.phone || '') + ` (${selectedDriver.license})` : ''}
                          onChange={(e) => setDriverSearchQuery(e.target.value)}
                          onFocus={() => selectedBranch && selectedTruck && setDriverDropdownOpen(true)}
                          placeholder="Search drivers..."
                          disabled={!selectedBranch || !selectedTruck}
                          className={`w-full pl-10 pr-10 py-3 border-2 text-gray-900 rounded-xl focus:outline-none transition-all font-semibold ${!selectedBranch || !selectedTruck
                            ? 'border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500'
                            : 'border-gray-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 bg-white hover:border-orange-400 cursor-pointer'
                            }`}
                        />
                        <button
                          type="button"
                          onClick={() => selectedBranch && selectedTruck && setDriverDropdownOpen(!driverDropdownOpen)}
                          disabled={!selectedBranch || !selectedTruck}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 ${!selectedBranch || !selectedTruck ? 'cursor-not-allowed' : ''
                            }`}
                        >
                          <ChevronDown className={`w-5 h-5 transition-transform ${driverDropdownOpen ? 'rotate-180' : ''} ${selectedBranch && selectedTruck ? 'text-orange-400' : 'text-gray-300'
                            }`} />
                        </button>

                        {driverDropdownOpen && selectedBranch && selectedTruck && (
                          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                            {filteredDrivers.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 text-sm font-medium">
                                No drivers found
                              </div>
                            ) : (
                              <div className="py-1">
                                {filteredDrivers.map((driver) => (
                                  <button
                                    type="button"
                                    key={driver.id}
                                    onClick={() => {
                                      setSelectedDriver(driver);
                                      setDriverDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-3 text-left font-semibold transition-colors ${selectedDriver?.id === driver.id
                                      ? 'bg-orange-50 text-orange-700'
                                      : 'text-gray-900 hover:bg-gray-50'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>{driver.name} - {driver.phone} ({driver.license})</span>
                                      {driver.status === 'active' && (
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Active</span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedDriver && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-gray-900">
                                {selectedDriver.name}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {selectedDriver.phone}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Award className="w-3 h-3" />
                                  {selectedDriver.experience}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CreditCard className="w-3 h-3" />
                                  {selectedDriver.license}
                                </span>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selectedDriver.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                              }`}>
                              {selectedDriver.status}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-white border-t border-gray-200 px-6 py-4">
                  <div className="flex justify-between items-center">
                    <Button
                      onClick={handleCloseModal}
                      variant="outline"
                      className="text-gray-700 border-gray-300 hover:bg-gray-50 px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTrip}
                      disabled={!selectedBranch || !selectedTruck || !selectedDriver}
                      className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed px-8 py-2.5 font-semibold"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Trip
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Order Assignment Modal - Same as original */}
          {showOrderModal && selectedTripForOrders && (
            <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-black">
                        Add Orders to Trip
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Trip:{" "}
                        <span className="font-medium">
                          {selectedTripForOrders.id}
                        </span>{" "}
                        • Truck:{" "}
                        <span className="font-medium">
                          {selectedTripForOrders.truck?.plate}
                        </span>{" "}
                        • Capacity:{" "}
                        <span className="font-medium">
                          {selectedTripForOrders.capacityTotal}kg
                        </span>
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowOrderModal(false)}
                      variant="outline"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="px-6 py-6">
                  {/* Capacity Summary */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">
                          Current Capacity Used
                        </p>
                        <p className="text-lg font-semibold text-black">
                          {selectedTripForOrders.capacityUsed || 0}kg
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          Selected Orders Weight
                        </p>
                        <p className="text-lg font-semibold text-blue-600">
                          {calculateTotalWeight(selectedOrders)}kg
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          Total After Assignment
                        </p>
                        <p
                          className={`text-lg font-semibold ${(selectedTripForOrders.capacityUsed || 0) +
                            calculateTotalWeight(selectedOrders) >
                            (selectedTripForOrders.capacityTotal || 0)
                            ? "text-red-600"
                            : "text-green-600"
                            }`}
                        >
                          {(selectedTripForOrders.capacityUsed || 0) +
                            calculateTotalWeight(selectedOrders)}
                          kg
                        </p>
                      </div>
                    </div>
                    {(selectedTripForOrders.capacityTotal || 0) > 0 && (
                      <div className="mt-4">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all ${getCapacityColor(
                              getCapacityPercentage(
                                (selectedTripForOrders.capacityUsed || 0) +
                                calculateTotalWeight(selectedOrders),
                                selectedTripForOrders.capacityTotal || 0
                              )
                            )}`}
                            style={{
                              width: `${Math.min(
                                getCapacityPercentage(
                                  (selectedTripForOrders.capacityUsed || 0) +
                                  calculateTotalWeight(selectedOrders),
                                  selectedTripForOrders.capacityTotal || 0
                                ),
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {getCapacityPercentage(
                            (selectedTripForOrders.capacityUsed || 0) +
                            calculateTotalWeight(selectedOrders),
                            selectedTripForOrders.capacityTotal || 0
                          )}
                          % capacity used
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Available Orders List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-black">
                        Available Orders
                      </h3>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          placeholder="Search orders..."
                          value={orderSearchTerm}
                          onChange={(e) => setOrderSearchTerm(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                        />
                        <select
                          value={orderPriorityFilter}
                          onChange={(e) =>
                            setOrderPriorityFilter(e.target.value)
                          }
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">All Priority</option>
                          <option value="high">High Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="low">Low Priority</option>
                        </select>
                        <select
                          value={tmsOrderStatusFilter}
                          onChange={(e) =>
                            setTmsOrderStatusFilter(e.target.value as "all" | "available" | "partial" | "fully_assigned")
                          }
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">All Status</option>
                          <option value="available">Available</option>
                          <option value="partial">Partial</option>
                          <option value="fully_assigned">Fully Assigned</option>
                        </select>
                      </div>
                    </div>
                    {getAvailableOrders().length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No available orders to assign</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {getAvailableOrders().map((order) => {
                          const wouldExceedCapacity =
                            (selectedTripForOrders.capacityUsed || 0) +
                            calculateTotalWeight([
                              ...selectedOrders,
                              order.id,
                            ]) >
                            (selectedTripForOrders.capacityTotal || 0);
                          const isExpanded = expandedOrderIds.has(order.id);
                          const orderItems = order.items_data || order.items_json || [];
                          const itemsArray = Array.isArray(orderItems) ? orderItems : [];

                          return (
                            <div
                              key={order.id}
                              className={`border rounded-lg transition-all overflow-hidden ${selectedOrders.includes(order.id)
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                                } ${wouldExceedCapacity ? "border-orange-400" : ""
                                }`}
                            >
                              {/* Order Header - Always Visible */}
                              <div className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4 flex-1">
                                    <input
                                      type="checkbox"
                                      checked={selectedOrders.includes(order.id)}
                                      onChange={() => {
                                        // Allow selection regardless of capacity (planning stage)
                                        handleOrderToggle(order.id);
                                      }}
                                      className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3">
                                        <p className="font-medium text-black">
                                          {order.id}
                                        </p>
                                        <Badge
                                          variant={getPriorityVariant(order.priority)}
                                          className="text-xs"
                                        >
                                          {order.priority?.toUpperCase()}
                                        </Badge>
                                        <Badge
                                          variant={getTmsStatusVariant(order.tms_order_status || "available")}
                                          className="text-xs"
                                        >
                                          {getTmsStatusDisplay(order.tms_order_status || "available")}
                                        </Badge>
                                        {wouldExceedCapacity && (
                                          <span className="text-xs text-orange-600 font-medium">
                                            ⚠️ Exceeds capacity!
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-600 mt-1">
                                        {order.customer}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        {order.address}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right text-sm">
                                      <p className="font-medium text-black">
                                        {(() => {
                                          // Calculate available weight from remaining_quantity for partial orders
                                          const availableWeight = itemsArray.reduce((sum: number, item: any) => {
                                            const availableQty = item.remaining_quantity !== undefined
                                              ? item.remaining_quantity
                                              : (item.quantity || 1);
                                            return sum + ((item.weight || 0) * availableQty);
                                          }, 0);
                                          return availableWeight.toFixed(2);
                                        })()}kg
                                      </p>
                                      <p className="text-gray-600">
                                        {itemsArray.length} items
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setExpandedOrderIds(prev => {
                                          const newSet = new Set(prev);
                                          if (newSet.has(order.id)) {
                                            newSet.delete(order.id);
                                          } else {
                                            newSet.add(order.id);
                                          }
                                          return newSet;
                                        });
                                      }}
                                      className="p-1 hover:bg-gray-100 rounded"
                                    >
                                      <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Order Items - Expandable */}
                              {isExpanded && itemsArray.length > 0 && (
                                <div className="border-t border-gray-200 bg-gray-50 px-4 pb-4">
                                  <h6 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                                    Order Items
                                  </h6>
                                  <div className="space-y-2">
                                    {itemsArray.map((item: any, idx: number) => (
                                      <div
                                        key={item.id || idx}
                                        className="bg-white border border-gray-200 rounded-lg p-3"
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-xs font-medium text-gray-500">#{idx + 1}</span>
                                              <span className="font-medium text-gray-900 text-sm">
                                                {item.product_name || "Unknown Product"}
                                              </span>
                                              {item.product_code && (
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                  {item.product_code}
                                                </span>
                                              )}
                                            </div>
                                            {item.description && (
                                              <p className="text-xs text-gray-500 ml-5">{item.description}</p>
                                            )}
                                            <div className="mt-2 ml-5 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                              <div>
                                                <span className="text-gray-500">Quantity:</span>
                                                <span className="ml-1 font-medium text-gray-900">
                                                  {item.quantity} {item.unit || "pcs"}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Weight:</span>
                                                <span className="ml-1 font-medium text-gray-900">
                                                  {item.weight ?? 0} {item.weight_unit || "kg"}
                                                  {item.weight_type && (
                                                    <span className="text-gray-400">({item.weight_type})</span>
                                                  )}
                                                </span>
                                              </div>
                                              {/* <div>
                                                <span className="text-gray-500">Volume:</span>
                                                <span className="ml-1 font-medium text-gray-900">
                                                  {item.volume ?? 0} m³
                                                </span>
                                              </div> */}
                                              <div>
                                                <span className="text-gray-500">Price:</span>
                                                <span className="ml-1 font-medium text-gray-900">
                                                  {item.unit_price ? `${item.unit_price}/${item.unit || "unit"}` : "N/A"}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {wouldExceedCapacity && (
                                    <div className="mt-3 flex justify-end">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSplitOrder(order)}
                                        className="text-xs"
                                      >
                                        <Scissors className="w-4 h-4 mr-1" />
                                        Split Order Items
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
                  <div className="flex justify-between">
                    <Button
                      onClick={() => {
                        setShowOrderModal(false);
                        setExpandedOrderIds(new Set());
                      }}
                      variant="outline"
                      className="text-gray-700 border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAssignOrders}
                      disabled={selectedOrders.length === 0}
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Assign {selectedOrders.length} Order
                      {selectedOrders.length !== 1 ? "s" : ""}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Split Order Modal - Item Level Selection */}
          {showSplitOptions && splitOrder && (
            <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-black">
                        Split Order Items
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {splitOrder.id} - {splitOrder.customer}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setShowSplitOptions(false);
                        setSplitOrder(null);
                        setSelectedSplitItems([]);
                      }}
                      variant="outline"
                      size="sm"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="px-6 py-6 overflow-y-auto flex-1">
                  {/* Capacity Info */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <Scissors className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-orange-800 mb-1">
                          Select Items to Assign
                        </h3>
                        <p className="text-sm text-orange-700">
                          Available Capacity: {(selectedTripForOrders?.capacityTotal || 0) - (selectedTripForOrders?.capacityUsed || 0)} kg
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Selected Weight</p>
                        <p className="text-lg font-bold text-orange-600">
                          {(() => {
                            const orderItems = splitOrder.items_data || splitOrder.items_json || splitOrder.items;
                            const itemsArray = Array.isArray(orderItems) ? orderItems : [];
                            return itemsArray.reduce((sum: number, item: any, idx: number) => {
                              const itemId = `${splitOrder.id}-${item.id || item.product_id || idx}`;
                              if (selectedSplitItems.includes(itemId)) {
                                const quantity = splitItemQuantities[itemId] || (item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity || 1);
                                const weightPerUnit = item.weight || 0;
                                return sum + (weightPerUnit * quantity);
                              }
                              return sum;
                            }, 0).toFixed(2);
                          })()} kg
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-black">Order Items</h4>
                    {(() => {
                      const orderItems = splitOrder.items_data || splitOrder.items_json || splitOrder.items;
                      const itemsArray = Array.isArray(orderItems) ? orderItems : [];

                      if (itemsArray.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No items found in this order</p>
                          </div>
                        );
                      }

                      return itemsArray.map((item: any, idx: number) => {
                        // Use composite key to ensure uniqueness across all orders
                        const itemId = `${splitOrder.id}-${item.id || item.product_id || idx}`;
                        const isSelected = selectedSplitItems.includes(itemId);

                        // Calculate available capacity
                        const usedCapacity = selectedTripForOrders?.capacityUsed || 0;
                        const totalCapacity = selectedTripForOrders?.capacityTotal || 0;
                        const availableCapacity = totalCapacity - usedCapacity;

                        // Calculate total weight of all currently selected items (using quantities)
                        const currentSelectedWeight = itemsArray.reduce((sum: number, i: any, iIdx: number) => {
                          const iid = `${splitOrder.id}-${i.id || i.product_id || iIdx}`;
                          if (selectedSplitItems.includes(iid)) {
                            const qty = splitItemQuantities[iid] || (i.remaining_quantity !== undefined ? i.remaining_quantity : i.quantity || 1);
                            const weightPerUnit = i.weight || (i.total_weight ? i.total_weight / (i.quantity || 1) : 0);
                            return sum + (weightPerUnit * qty);
                          }
                          return sum;
                        }, 0);

                        // Calculate weight per unit for this item (from API)
                        const weightPerUnit = item.weight || 0;
                        const availableQuantity = item.remaining_quantity !== undefined
                          ? item.remaining_quantity
                          : (item.quantity || 1);

                        // Calculate max quantity that can fit for this item
                        const remainingCapacity = availableCapacity - currentSelectedWeight;
                        const maxQuantityForItem = isSelected ? availableQuantity : Math.floor(remainingCapacity / weightPerUnit);
                        const clampedMaxQuantity = Math.max(0, Math.min(maxQuantityForItem, availableQuantity));

                        const canSelect = remainingCapacity >= 0 && clampedMaxQuantity > 0;

                        return (
                          <div
                            key={itemId}
                            className={`border rounded-lg overflow-hidden transition-all ${isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : canSelect
                                ? 'border-gray-200 hover:border-gray-300 bg-white'
                                : 'border-gray-200 bg-gray-100 opacity-60'
                              }`}
                          >
                            <div className="p-4">
                              <div className="flex items-start gap-4">
                                <input
                                  type="checkbox"
                                  id={`item-${itemId}`}
                                  checked={isSelected}
                                  disabled={!canSelect && !isSelected}
                                  onChange={() => {
                                    setSelectedSplitItems(prev => {
                                      const newSet = new Set(prev);
                                      if (newSet.has(itemId)) {
                                        newSet.delete(itemId);
                                        // Clear quantity when unselecting
                                        setSplitItemQuantities(prevQty => {
                                          const newQty = { ...prevQty };
                                          delete newQty[itemId];
                                          return newQty;
                                        });
                                      } else {
                                        newSet.add(itemId);
                                        // Automatically set quantity to maximum that fits
                                        setSplitItemQuantities(prev => ({
                                          ...prev,
                                          [itemId]: clampedMaxQuantity
                                        }));
                                      }
                                      return Array.from(newSet);
                                    });
                                  }}
                                  className="w-5 h-5 text-blue-600 rounded mt-1"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                      #{idx + 1}
                                    </span>
                                    <label
                                      htmlFor={`item-${itemId}`}
                                      className={`font-medium ${canSelect || isSelected ? 'text-black cursor-pointer' : 'text-gray-500 cursor-not-allowed'}`}
                                    >
                                      {item.product_name || "Unknown Product"}
                                    </label>
                                    {item.product_code && (
                                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                        {item.product_code}
                                      </span>
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                                  )}

                                  {/* Quantity Split Input */}
                                  <div className="mb-3">
                                    <label className="block text-xs font-medium text-black mb-1">
                                      Quantity to Assign (Max: {clampedMaxQuantity} {clampedMaxQuantity < availableQuantity ? `- Limited by capacity` : ''})
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={clampedMaxQuantity}
                                      value={isSelected ? (splitItemQuantities[itemId] || clampedMaxQuantity) : 0}
                                      disabled={!isSelected}
                                      onChange={(e) => {
                                        let newQuantity = parseInt(e.target.value) || 0;
                                        // Clamp to the maximum that fits in capacity
                                        newQuantity = Math.max(0, Math.min(newQuantity, clampedMaxQuantity));
                                        setSplitItemQuantities(prev => ({
                                          ...prev,
                                          [itemId]: newQuantity
                                        }));
                                      }}
                                      className="w-32 px-2 py-1 text-sm text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
                                    />
                                    {clampedMaxQuantity < availableQuantity && (
                                      <p className="text-xs text-orange-600 mt-1">
                                        ⚠️ Only {clampedMaxQuantity} units can fit in remaining capacity ({remainingCapacity.toFixed(2)} kg available)
                                      </p>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-4 gap-3 text-xs">
                                    <div className="bg-gray-50 p-2 rounded">
                                      <p className="text-black">Total Qty</p>
                                      <p className="font-medium text-black">{item.quantity || 1} {item.unit || 'pcs'}</p>
                                    </div>
                                    <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                      <p className="text-black">Assigning</p>
                                      <p className="font-medium text-black">
                                        {isSelected ? (splitItemQuantities[itemId] || item.quantity || 1) : 0} {item.unit || 'pcs'}
                                      </p>
                                    </div>
                                    <div className="bg-green-50 p-2 rounded border border-green-200">
                                      <p className="text-black">Weight</p>
                                      <p className="font-medium text-black">
                                        {(() => {
                                          if (!isSelected) return '0 kg';
                                          const quantity = splitItemQuantities[itemId] || availableQuantity;
                                          // Use weight per unit from API
                                          return (weightPerUnit * quantity).toFixed(2) + ' kg';
                                        })()}
                                      </p>
                                    </div>
                                    <div className="bg-purple-50 p-2 rounded border border-purple-200">
                                      <p className="text-black">Remaining</p>
                                      <p className="font-medium text-black">
                                        {isSelected ? (availableQuantity - (splitItemQuantities[itemId] || availableQuantity)) : availableQuantity} {item.unit || 'pcs'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Summary */}
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h5 className="font-semibold text-blue-900 mb-3">This Trip</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-700">Items Selected:</span>
                          <span className="font-medium text-blue-900">{selectedSplitItems.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Total Weight:</span>
                          <span className="font-medium text-blue-900">
                            {(() => {
                              const orderItems = splitOrder.items;
                              const itemsArray = Array.isArray(orderItems) ? orderItems : [];
                              return itemsArray.reduce((sum: number, item: any, idx: number) => {
                                const itemId = `${splitOrder.id}-${item.id || item.product_id || idx}`;
                                if (selectedSplitItems.includes(itemId)) {
                                  const quantity = splitItemQuantities[itemId] || (item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity || 1);
                                  const weightPerUnit = item.weight || 0;
                                  return sum + (weightPerUnit * quantity);
                                }
                                return sum;
                              }, 0).toFixed(2);
                            })()} kg
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Total Quantity:</span>
                          <span className="font-medium text-blue-900">
                            {(() => {
                              const orderItems = splitOrder.items;
                              const itemsArray = Array.isArray(orderItems) ? orderItems : [];
                              return itemsArray.reduce((sum: number, item: any, idx: number) => {
                                const itemId = `${splitOrder.id}-${item.id || item.product_id || idx}`;
                                if (selectedSplitItems.includes(itemId)) {
                                  return sum + (splitItemQuantities[itemId] || (item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity || 1));
                                }
                                return sum;
                              }, 0);
                            })()} units
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h5 className="font-semibold text-orange-900 mb-3">Remaining</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-orange-700">Items Remaining:</span>
                          <span className="font-medium text-orange-900">
                            {(() => {
                              const orderItems = splitOrder.items;
                              const itemsArray = Array.isArray(orderItems) ? orderItems : [];
                              const remainingItems = itemsArray.filter((item: { id?: string; product_id?: string; quantity?: number }, idx: number) => {
                                const itemId = `${splitOrder.id}-${item.id || item.product_id || idx}`;
                                if (selectedSplitItems.includes(itemId)) {
                                  const quantity = splitItemQuantities[itemId] || item.quantity || 1;
                                  return quantity < (item.quantity || 1);
                                }
                                return true;
                              });
                              return remainingItems.length;
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-orange-700">Total Weight:</span>
                          <span className="font-medium text-orange-900">
                            {(() => {
                              const orderItems = splitOrder.items;
                              const itemsArray = Array.isArray(orderItems) ? orderItems : [];
                              const selectedWeight = itemsArray.reduce((sum: number, item: any, idx: number) => {
                                const itemId = `${splitOrder.id}-${item.id || item.product_id || idx}`;
                                if (selectedSplitItems.includes(itemId)) {
                                  const quantity = splitItemQuantities[itemId] || (item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity || 1);
                                  const weightPerUnit = item.weight || 0;
                                  return sum + (weightPerUnit * quantity);
                                }
                                return sum;
                              }, 0);
                              // Calculate remaining weight from items
                              const remainingWeight = itemsArray.reduce((sum: number, item: any, idx: number) => {
                                const itemId = `${splitOrder.id}-${item.id || item.product_id || idx}`;
                                if (selectedSplitItems.includes(itemId)) {
                                  const assignedQty = splitItemQuantities[itemId] || (item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity || 1);
                                  const availableQty = item.remaining_quantity !== undefined ? item.remaining_quantity : (item.quantity || 1);
                                  const remainingQty = availableQty - assignedQty;
                                  const weightPerUnit = item.weight || 0;
                                  return sum + (weightPerUnit * remainingQty);
                                }
                                // Item not selected - all available quantity remains
                                const availableQty = item.remaining_quantity !== undefined ? item.remaining_quantity : (item.quantity || 1);
                                const weightPerUnit = item.weight || 0;
                                return sum + (weightPerUnit * availableQty);
                              }, 0);
                              return remainingWeight.toFixed(2);
                            })()} kg
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-orange-700">Total Quantity:</span>
                          <span className="font-medium text-orange-900">
                            {(() => {
                              const orderItems = splitOrder.items;
                              const itemsArray = Array.isArray(orderItems) ? orderItems : [];
                              const selectedQty = itemsArray.reduce((sum: number, item: any, idx: number) => {
                                const itemId = `${splitOrder.id}-${item.id || item.product_id || idx}`;
                                if (selectedSplitItems.includes(itemId)) {
                                  return sum + (splitItemQuantities[itemId] || (item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity || 1));
                                }
                                return sum;
                              }, 0);
                              const totalAvailableQty = itemsArray.reduce((sum: number, item: any) => {
                                return sum + (item.remaining_quantity !== undefined ? item.remaining_quantity : (item.quantity || 1));
                              }, 0);
                              return totalAvailableQty - selectedQty;
                            })()} units
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl">
                  {/* Capacity Warning */}
                  {(() => {
                    const orderItems = splitOrder.items;
                    const itemsArray = Array.isArray(orderItems) ? orderItems : [];
                    const selectedWeight = itemsArray.reduce((sum: number, item: any, idx: number) => {
                      const itemId = `${splitOrder.id}-${item.id || item.product_id || idx}`;
                      if (selectedSplitItems.includes(itemId)) {
                        const quantity = splitItemQuantities[itemId] || (item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity || 1);
                        const weightPerUnit = item.weight || 0;
                        return sum + (weightPerUnit * quantity);
                      }
                      return sum;
                    }, 0);
                    const usedCapacity = selectedTripForOrders?.capacityUsed || 0;
                    const totalCapacity = selectedTripForOrders?.capacityTotal || 0;
                    const availableCapacity = totalCapacity - usedCapacity;
                    const exceedsCapacity = selectedWeight > availableCapacity;

                    if (exceedsCapacity && selectedSplitItems.length > 0) {
                      return (
                        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-900">
                                Capacity Exceeded
                              </p>
                              <p className="text-xs text-red-700 mt-1">
                                Selected items ({selectedWeight.toFixed(2)} kg) exceed available capacity ({availableCapacity.toFixed(2)} kg). Quantities have been automatically adjusted to fit.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex justify-between">
                    <Button
                      onClick={() => {
                        setShowSplitOptions(false);
                        setSplitOrder(null);
                        setSelectedSplitItems([]);
                        setSplitItemQuantities({});
                      }}
                      variant="outline"
                      className="text-gray-700 border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        handleConfirmSplit();
                      }}
                      disabled={selectedSplitItems.length === 0}
                      className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Assign {selectedSplitItems.length} Item{selectedSplitItems.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reassignment Modal for Paused Trips */}
          {showReassignModal && selectedTripForReassign && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Modal Header - Purple */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-6">
                  <h2 className="text-2xl font-bold text-white">Reassign & Resume Trip</h2>
                  <p className="text-purple-100 mt-1">
                    Trip: {selectedTripForReassign.id}
                  </p>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      <strong>Note:</strong> This trip is currently paused. Select a truck and driver, then click "Reassign & Resume" to continue the delivery.
                    </p>
                  </div>

                  {/* Current Assignment Info */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Current Assignment</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Truck</p>
                        <p className="font-medium text-gray-900">
                          {selectedTripForReassign.truck?.plate || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Driver</p>
                        <p className="font-medium text-gray-900">
                          {selectedTripForReassign.driver?.name || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Truck Selection - Dropdown Style */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Select Truck
                      </label>
                      <div className="relative">
                        {/* Input Field with Search Icon and Chevron */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            readOnly
                            value={reassignTruck ? availableTrucks.find(t => t.id === reassignTruck)?.plate || "" : reassignTruckSearchQuery}
                            placeholder="Select a truck..."
                            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            onClick={() => setReassignTruckDropdownOpen(!reassignTruckDropdownOpen)}
                          />
                          <button
                            type="button"
                            onClick={() => setReassignTruckDropdownOpen(!reassignTruckDropdownOpen)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            <svg
                              className={`h-5 w-5 text-gray-400 transition-transform ${reassignTruckDropdownOpen ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* Dropdown Panel */}
                        {reassignTruckDropdownOpen && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Search trucks..."
                              className="w-full px-3 py-2 border-b border-gray-200"
                              value={reassignTruckSearchQuery}
                              onChange={(e) => setReassignTruckSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="py-1">
                              {availableTrucks
                                .filter((truck) => truck.status === "available" || truck.id === reassignTruck)
                                .filter((truck) =>
                                  truck.plate.toLowerCase().includes(reassignTruckSearchQuery.toLowerCase()) ||
                                  truck.model.toLowerCase().includes(reassignTruckSearchQuery.toLowerCase())
                                )
                                .map((truck) => (
                                  <button
                                    key={truck.id}
                                    type="button"
                                    onClick={() => {
                                      setReassignTruck(truck.id);
                                      setReassignTruckDropdownOpen(false);
                                      setReassignTruckSearchQuery("");
                                    }}
                                    className={`w-full text-left px-4 py-3 hover:bg-purple-50 ${
                                      reassignTruck === truck.id ? "bg-purple-50" : ""
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-semibold text-gray-900">{truck.plate}</p>
                                        <p className="text-xs text-gray-600">{truck.model} ({truck.capacity}kg)</p>
                                      </div>
                                      {truck.status === "available" && (
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Available</span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Selection Card */}
                        {reassignTruck && !reassignTruckDropdownOpen && (
                          <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold text-purple-900">
                                  {availableTrucks.find(t => t.id === reassignTruck)?.plate}
                                </p>
                                <p className="text-sm text-purple-700">
                                  {availableTrucks.find(t => t.id === reassignTruck)?.model} • Capacity: {availableTrucks.find(t => t.id === reassignTruck)?.capacity}kg
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setReassignTruck("")}
                                className="text-purple-400 hover:text-purple-600"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Driver Selection - Dropdown Style */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Select Driver
                      </label>
                      <div className="relative">
                        {/* Input Field with Search Icon and Chevron */}
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            readOnly
                            value={reassignDriver ? reassignDriver.name : reassignDriverSearchQuery}
                            placeholder="Select a driver..."
                            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            onClick={() => setReassignDriverDropdownOpen(!reassignDriverDropdownOpen)}
                          />
                          <button
                            type="button"
                            onClick={() => setReassignDriverDropdownOpen(!reassignDriverDropdownOpen)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          >
                            <svg
                              className={`h-5 w-5 text-gray-400 transition-transform ${reassignDriverDropdownOpen ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* Dropdown Panel */}
                        {reassignDriverDropdownOpen && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Search drivers..."
                              className="w-full px-3 py-2 border-b border-gray-200"
                              value={reassignDriverSearchQuery}
                              onChange={(e) => setReassignDriverSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="py-1">
                              {availableDrivers
                                .filter((driver) => driver.status === "available" || driver.user_id === reassignDriver?.user_id)
                                .filter((driver) =>
                                  driver.name.toLowerCase().includes(reassignDriverSearchQuery.toLowerCase()) ||
                                  driver.phone.includes(reassignDriverSearchQuery)
                                )
                                .map((driver) => (
                                  <button
                                    key={driver.user_id}
                                    type="button"
                                    onClick={() => {
                                      setReassignDriver(driver);
                                      setReassignDriverDropdownOpen(false);
                                      setReassignDriverSearchQuery("");
                                    }}
                                    className={`w-full text-left px-4 py-3 hover:bg-purple-50 ${
                                      reassignDriver?.user_id === driver.user_id ? "bg-purple-50" : ""
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-semibold text-gray-900">{driver.name}</p>
                                        <p className="text-xs text-gray-600">{driver.phone}</p>
                                      </div>
                                      {driver.status === "available" && (
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Available</span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Selection Card */}
                        {reassignDriver && !reassignDriverDropdownOpen && (
                          <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold text-purple-900">{reassignDriver.name}</p>
                                <p className="text-sm text-purple-700">📞 {reassignDriver.phone}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setReassignDriver(null)}
                                className="text-purple-400 hover:text-purple-600"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end gap-3">
                  <Button
                    onClick={handleCloseReassignModal}
                    variant="outline"
                    className="text-gray-700 border-gray-300 hover:bg-gray-50"
                    disabled={isReassigning}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReassignResources}
                    disabled={!reassignTruck || !reassignDriver || isReassigning}
                    className="bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isReassigning ? "Processing..." : "Reassign & Resume"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Loading Assignment Modal */}
          {loadingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/50"
                onClick={() => setLoadingModal(null)}
              />

              {/* Modal Content */}
              <div
                className="relative z-50 w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-lg bg-white shadow-xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">Loading Stage - Item Assignment</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Decide quantities for each item. You can: assign full, assign partial, or skip items.
                  </p>
                </div>

                {/* Capacity Summary */}
                <div className="px-6 py-4 bg-gray-50 border-b">
                  {(() => {
                    const currentTotalWeight = loadingModal.pendingItems.reduce((sum, item) => {
                      const qty = editableQuantities[item.order_item_id] ?? item.assigned_quantity;
                      return sum + (qty * item.weight_per_unit);
                    }, 0);
                    const availableCapacity = loadingModal.capacityTotal - currentTotalWeight;
                    const utilizationPercentage = (currentTotalWeight / loadingModal.capacityTotal) * 100;

                    return (
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Truck Capacity</p>
                          <p className="text-lg font-semibold">{loadingModal.capacityTotal}kg</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Current Assigned</p>
                          <p className="text-lg font-semibold text-blue-600">
                            {currentTotalWeight.toFixed(2)}kg
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Available</p>
                          <p className={`text-lg font-semibold ${availableCapacity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {availableCapacity.toFixed(2)}kg
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Utilization</p>
                          <p className={`text-lg font-semibold ${
                            utilizationPercentage > 100 ? 'text-red-600' :
                            utilizationPercentage > 80 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {utilizationPercentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Modal Body */}
                <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
                  <div className="space-y-3">
                    {loadingModal.pendingItems.map((item, idx) => {
                      const currentQty = editableQuantities[item.order_item_id] ?? item.assigned_quantity;
                      const itemWeight = currentQty * item.weight_per_unit;
                      const isPartial = currentQty < item.original_quantity && currentQty > 0;
                      const isSkipped = currentQty === 0;

                      return (
                        <div key={`${item.order_item_id}-${idx}`} className="border rounded-lg p-4 bg-white shadow-sm">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
                                {item.product_code && (
                                  <span className="text-sm text-gray-500">({item.product_code})</span>
                                )}
                                {isPartial && (
                                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">Partial Assignment</span>
                                )}
                                {isSkipped && (
                                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Skipped</span>
                                )}
                              </div>

                              <p className="text-sm text-gray-600 mb-3">
                                Order: {item.order_id} • Customer: {item.customer}
                              </p>

                              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                                <div>
                                  <span className="text-gray-600">Original: </span>
                                  <span className="font-medium">{item.original_quantity}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Planning: </span>
                                  <span className="font-medium">{item.assigned_quantity}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Remaining: </span>
                                  <span className="font-medium text-green-600">{item.remaining_quantity}</span>
                                </div>
                              </div>

                              {/* Quantity Decision Controls */}
                              <div className="flex items-center gap-4">
                                <label className="text-sm font-medium">Assign to Loading:</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={item.max_assignable || item.original_quantity}
                                  value={currentQty}
                                  onChange={(e) => {
                                    const newQty = Math.min(
                                      Math.max(0, parseInt(e.target.value) || 0),
                                      item.max_assignable || item.original_quantity
                                    );
                                    setEditableQuantities(prev => ({
                                      ...prev,
                                      [item.order_item_id]: newQty
                                    }));
                                  }}
                                  className="w-32 px-3 py-2 border border-gray-300 rounded text-sm"
                                />
                                <span className="text-sm text-gray-600">
                                  / {item.max_assignable || item.original_quantity} (max)
                                </span>

                                {/* Quick Action Buttons */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setEditableQuantities(prev => ({
                                      ...prev,
                                      [item.order_item_id]: item.max_assignable || item.original_quantity
                                    }))}
                                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                  >
                                    Full
                                  </button>
                                  <button
                                    onClick={() => setEditableQuantities(prev => ({
                                      ...prev,
                                      [item.order_item_id]: Math.floor((item.max_assignable || item.original_quantity) / 2)
                                    }))}
                                    className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                                  >
                                    Half
                                  </button>
                                  <button
                                    onClick={() => setEditableQuantities(prev => ({
                                      ...prev,
                                      [item.order_item_id]: 0
                                    }))}
                                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                  >
                                    Skip
                                  </button>
                                </div>
                              </div>

                              <div className="mt-2 text-sm text-gray-600">
                                Weight: {itemWeight.toFixed(2)}kg
                                {item.weight_per_unit > 0 && ` (${item.weight_per_unit}kg/each)`}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center flex-shrink-0">
                  {(() => {
                    const itemsConfirmed = loadingModal.pendingItems.filter(item => {
                      const qty = editableQuantities[item.order_item_id] ?? item.assigned_quantity;
                      return qty > 0;
                    }).length;
                    const itemsSkipped = loadingModal.pendingItems.filter(item => {
                      const qty = editableQuantities[item.order_item_id] ?? item.assigned_quantity;
                      return qty === 0;
                    }).length;
                    const itemsPartial = loadingModal.pendingItems.filter(item => {
                      const qty = editableQuantities[item.order_item_id] ?? item.assigned_quantity;
                      return qty > 0 && qty < item.original_quantity;
                    }).length;

                    return (
                      <div className="text-sm text-gray-600">
                        <span>Items: </span>
                        <span className="font-medium">{itemsConfirmed}</span> confirmed,
                        <span className="font-medium">{itemsSkipped}</span> skipped,
                        <span className="font-medium">{itemsPartial}</span> partial
                      </div>
                    );
                  })()}

                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setLoadingModal(null);
                        setEditableQuantities({});
                      }}
                      variant="outline"
                      className="text-gray-700 border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>

                    <Button
                      onClick={async () => {
                        try {
                          // Calculate current total weight from editable quantities
                          const currentTotalWeight = loadingModal.pendingItems.reduce((sum, item) => {
                            const qty = editableQuantities[item.order_item_id] ?? item.assigned_quantity;
                            return sum + (qty * item.weight_per_unit);
                          }, 0);
                          const capacityTotal = loadingModal.capacityTotal || 0;

                          // Check capacity
                          if (currentTotalWeight > capacityTotal) {
                            alert(`Over capacity! Current: ${currentTotalWeight.toFixed(2)}kg, Max: ${capacityTotal.toFixed(2)}kg`);
                            return;
                          }

                          // Use editable quantities for the assignment
                          const itemAssignments = loadingModal.pendingItems.map(item => {
                            const qty = editableQuantities[item.order_item_id] ?? item.assigned_quantity;
                            return {
                              order_id: item.order_id,
                              order_item_id: item.order_item_id,
                              assigned_quantity: qty,
                              weight_per_unit: item.weight_per_unit
                            };
                          });

                          await tmsAPI.confirmLoadingAssignment(loadingModal.tripId, {
                            item_assignments: itemAssignments
                          });

                          // Refresh trips to show updated status
                          await fetchTrips();

                          setLoadingModal(null);
                          setEditableQuantities({});
                          alert("Trip successfully moved to loading status!");
                        } catch (error) {
                          alert(`Failed to confirm loading: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Confirm & Start Loading
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
