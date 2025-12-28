"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  Package,
  Truck,
  MapPin,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Trip } from "@/types/common";

interface TripsDashboardProps {
  tripStats: {
    planning: number;
    loading: number;
    onRoute: number;
    completed: number;
    cancelled: number;
  };
  statusFilter: string | null;
  onStatusFilterChange: (status: string | null) => void;
  onCreateTripClick: () => void;
}

export default function TripsDashboard({
  tripStats,
  statusFilter,
  onStatusFilterChange,
  onCreateTripClick,
}: TripsDashboardProps) {
  return (
    <>
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-black">My Trips</h1>
          <p className="text-gray-500 mt-2">
            View and manage your assigned trips
          </p>
        </div>
        <Button
          onClick={onCreateTripClick}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <Plus className="w-4 h-4" />
          Create New Trip
        </Button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "planning" ? "ring-2 ring-blue-500 bg-blue-50" : ""
          }`}
          onClick={() =>
            onStatusFilterChange(
              statusFilter === "planning" ? null : "planning"
            )
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  statusFilter === "planning" ? "bg-blue-100" : "bg-gray-100"
                }`}
              >
                <Package
                  className={`w-5 h-5 ${
                    statusFilter === "planning"
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
                  className={`text-sm ${
                    statusFilter === "planning"
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
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "loading" ? "ring-2 ring-blue-500 bg-blue-50" : ""
          }`}
          onClick={() =>
            onStatusFilterChange(statusFilter === "loading" ? null : "loading")
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  statusFilter === "loading" ? "bg-yellow-100" : "bg-yellow-50"
                }`}
              >
                <Truck className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">
                  {tripStats.loading}
                </p>
                <p
                  className={`text-sm ${
                    statusFilter === "loading"
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
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "on-route" ? "ring-2 ring-blue-500 bg-blue-50" : ""
          }`}
          onClick={() =>
            onStatusFilterChange(
              statusFilter === "on-route" ? null : "on-route"
            )
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  statusFilter === "on-route" ? "bg-blue-100" : "bg-blue-50"
                }`}
              >
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">
                  {tripStats.onRoute}
                </p>
                <p
                  className={`text-sm ${
                    statusFilter === "on-route"
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
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "completed"
              ? "ring-2 ring-blue-500 bg-blue-50"
              : ""
          }`}
          onClick={() =>
            onStatusFilterChange(
              statusFilter === "completed" ? null : "completed"
            )
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  statusFilter === "completed" ? "bg-green-100" : "bg-green-50"
                }`}
              >
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">
                  {tripStats.completed}
                </p>
                <p
                  className={`text-sm ${
                    statusFilter === "completed"
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
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "cancelled"
              ? "ring-2 ring-blue-500 bg-blue-50"
              : ""
          }`}
          onClick={() =>
            onStatusFilterChange(
              statusFilter === "cancelled" ? null : "cancelled"
            )
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  statusFilter === "cancelled" ? "bg-red-100" : "bg-red-50"
                }`}
              >
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-black">
                  {tripStats.cancelled}
                </p>
                <p
                  className={`text-sm ${
                    statusFilter === "cancelled"
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
    </>
  );
}
