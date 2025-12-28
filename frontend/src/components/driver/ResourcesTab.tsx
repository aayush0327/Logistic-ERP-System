"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Driver } from "@/types/common";

interface ResourcesTabProps {
  availableTrucks: any[];
  availableDrivers: Driver[];
}

export default function ResourcesTab({
  availableTrucks,
  availableDrivers,
}: ResourcesTabProps) {
  const getTrucksAvailable = () =>
    availableTrucks.filter((truck) => truck.status === "available");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Available Trucks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-black">
            Available Trucks ({getTrucksAvailable().length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {getTrucksAvailable().map((truck) => (
              <div
                key={truck.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{truck.plate}</p>
                  <p className="text-sm text-gray-600">
                    {truck.model} • {truck.capacity}kg
                  </p>
                </div>
                <Badge variant="success">Available</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Available Drivers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-black">
            Available Drivers ({availableDrivers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {availableDrivers.map((driver) => (
              <div
                key={driver.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{driver.name}</p>
                  <p className="text-sm text-gray-600">
                    {driver.phone} • {driver.experience}
                  </p>
                </div>
                <Badge variant="success">Available</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
