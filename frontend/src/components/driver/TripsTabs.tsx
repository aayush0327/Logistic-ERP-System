"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Trip, Driver } from "@/types/common";
import TripsTab from "./TripsTab";
import ApprovedOrdersTab from "./ApprovedOrdersTab";
import ResourcesTab from "./ResourcesTab";

interface TripsTabsProps {
  activeTrips: Trip[];
  statusFilter: string | null;
  onStatusFilterClear: () => void;
  getStatusVariant: (status: string) => string;
  isTripLocked: (status: string) => boolean;
  getNextStatusOptions: (currentStatus: string) => Array<{
    value: string;
    label: string;
    color: string;
  }>;
  handleStatusChange: (tripId: string, newStatus: string) => void;
  getCapacityPercentage: (used: number, total: number) => number;
  getCapacityColor: (percentage: number) => string;
  getPriorityVariant: (priority: string) => string;
  handleAddOrderClick: (trip: Trip) => void;
  approvedOrders: any[];
  getPriorityVariantForOrder: (priority: string) => string;
  availableTrucks: any[];
  availableDrivers: Driver[];
}

export default function TripsTabs({
  activeTrips,
  statusFilter,
  onStatusFilterClear,
  getStatusVariant,
  isTripLocked,
  getNextStatusOptions,
  handleStatusChange,
  getCapacityPercentage,
  getCapacityColor,
  getPriorityVariant,
  handleAddOrderClick,
  approvedOrders,
  getPriorityVariantForOrder,
  availableTrucks,
  availableDrivers,
}: TripsTabsProps) {
  return (
    <Tabs defaultValue="trips" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="trips" className="text-black">
          Trips ({activeTrips.length})
        </TabsTrigger>
        <TabsTrigger value="orders" className="text-black">
          Approved Orders ({approvedOrders.length})
        </TabsTrigger>
        <TabsTrigger value="resources" className="text-black">
          Resources
        </TabsTrigger>
      </TabsList>

      {/* Trips Tab */}
      <TabsContent value="trips">
        <TripsTab
          activeTrips={activeTrips}
          statusFilter={statusFilter}
          onStatusFilterClear={onStatusFilterClear}
          getStatusVariant={getStatusVariant}
          isTripLocked={isTripLocked}
          getNextStatusOptions={getNextStatusOptions}
          handleStatusChange={handleStatusChange}
          getCapacityPercentage={getCapacityPercentage}
          getCapacityColor={getCapacityColor}
          getPriorityVariant={getPriorityVariant}
          handleAddOrderClick={handleAddOrderClick}
        />
      </TabsContent>

      {/* Approved Orders Tab */}
      <TabsContent value="orders">
        <ApprovedOrdersTab
          approvedOrders={approvedOrders}
          getPriorityVariant={getPriorityVariantForOrder}
        />
      </TabsContent>

      {/* Resources Tab */}
      <TabsContent value="resources">
        <ResourcesTab
          availableTrucks={availableTrucks}
          availableDrivers={availableDrivers}
        />
      </TabsContent>
    </Tabs>
  );
}
