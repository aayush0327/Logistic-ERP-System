"use client";

import { useState, useEffect } from "react";
import React from "react";
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
  Plus,
  Edit,
  MapPin,
  DollarSign,
  TrendingUp,
  Zap,
  Package,
  Calculator,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
} from "lucide-react";
import {
  useGetPricingRulesQuery,
  useCreatePricingRuleMutation,
  useUpdatePricingRuleMutation,
  useDeletePricingRuleMutation,
} from "@/services/api/companyApi";
import { PricingRuleCreate } from "@/services/api/companyApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { toast } from "react-hot-toast";

export default function PricingPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: pricingRules, isLoading, refetch } = useGetPricingRulesQuery();
  const [createRule, { isLoading: isCreating }] =
    useCreatePricingRuleMutation();
  const [updateRule, { isLoading: isUpdating }] =
    useUpdatePricingRuleMutation();
  const [deleteRule, { isLoading: isDeleting }] =
    useDeletePricingRuleMutation();

  const [formData, setFormData] = useState<Partial<PricingRuleCreate>>({
    name: "",
    service_type: "standard",
    zone_origin: "",
    zone_destination: "",
    base_price: 0,
    price_per_km: 0,
    price_per_kg: 0,
    fuel_surcharge_percent: 0,
    is_active: true,
  });

  const serviceTypes = ["express", "standard", "economy", "freight"];
  const zones = ["North", "South", "East", "West", "Central"];

  const filteredRules =
    pricingRules?.filter(
      (rule) =>
        !searchQuery ||
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.service_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.zone_origin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.zone_destination?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  const handleAddRule = async () => {
    try {
      await createRule({
        name: formData.name || "",
        service_type: formData.service_type,
        zone_origin: formData.zone_origin,
        zone_destination: formData.zone_destination,
        base_price: formData.base_price || 0,
        price_per_km: formData.price_per_km,
        price_per_kg: formData.price_per_kg,
        fuel_surcharge_percent: formData.fuel_surcharge_percent,
        is_active: formData.is_active,
      }).unwrap();

      toast.success("Pricing rule created successfully");
      setShowAddDialog(false);
      setFormData({
        name: "",
        service_type: "standard",
        zone_origin: "",
        zone_destination: "",
        base_price: 0,
        price_per_km: 0,
        price_per_kg: 0,
        fuel_surcharge_percent: 0,
        is_active: true,
      });
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to create pricing rule");
    }
  };

  const handleEditRule = async () => {
    if (!selectedRule) return;

    try {
      await updateRule({
        id: selectedRule.id,
        rule: {
          name: formData.name,
          service_type: formData.service_type,
          zone_origin: formData.zone_origin,
          zone_destination: formData.zone_destination,
          base_price: formData.base_price,
          price_per_km: formData.price_per_km,
          price_per_kg: formData.price_per_kg,
          fuel_surcharge_percent: formData.fuel_surcharge_percent,
          is_active: formData.is_active,
        },
      }).unwrap();

      toast.success("Pricing rule updated successfully");
      setShowEditDialog(false);
      setSelectedRule(null);
      setFormData({
        name: "",
        service_type: "standard",
        zone_origin: "",
        zone_destination: "",
        base_price: 0,
        price_per_km: 0,
        price_per_kg: 0,
        fuel_surcharge_percent: 0,
        is_active: true,
      });
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to update pricing rule");
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRule(id).unwrap();
      toast.success("Pricing rule deleted successfully");
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to delete pricing rule");
    }
  };

  const openEditDialog = (rule: any) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      service_type: rule.service_type,
      zone_origin: rule.zone_origin,
      zone_destination: rule.zone_destination,
      base_price: rule.base_price,
      price_per_km: rule.price_per_km,
      price_per_kg: rule.price_per_kg,
      fuel_surcharge_percent: rule.fuel_surcharge_percent,
      is_active: rule.is_active,
    });
    setShowEditDialog(true);
  };

  const calculatePrice = (
    basePrice: number,
    distance: number,
    weight: number,
    fuelSurcharge: number
  ) => {
    const distanceCost = distance * 0.5; // Mock calculation
    const weightCost = weight * 0.1; // Mock calculation
    const fuelCost =
      (basePrice + distanceCost + weightCost) * (fuelSurcharge / 100);
    return basePrice + distanceCost + weightCost + fuelCost;
  };

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getServiceTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      express: "destructive",
      standard: "default",
      economy: "secondary",
      freight: "outline",
    };
    return (
      <Badge variant={colors[type] as any}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Pricing Configuration
          </h1>
          <p className="text-gray-500 mt-2">
            Manage your pricing rules and service rates
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              // Mock price calculator
              toast("Price calculator coming soon!", { icon: "ℹ️" });
            }}
            className="flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            Price Calculator
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Pricing Rule
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Rules</p>
                <p className="text-2xl font-bold text-gray-900">
                  {pricingRules?.length || 0}
                </p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Rules</p>
                <p className="text-2xl font-bold text-green-600">
                  {pricingRules?.filter((r) => r.is_active).length || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Base Price</p>
                <p className="text-2xl font-bold text-purple-600">
                  $
                  {pricingRules?.reduce((sum, r) => sum + r.base_price, 0)
                    ? (
                        pricingRules.reduce((sum, r) => sum + r.base_price, 0) /
                        (pricingRules.length || 1)
                      ).toFixed(0)
                    : "0"}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Service Types</p>
                <p className="text-2xl font-bold text-orange-600">
                  {serviceTypes.length}
                </p>
              </div>
              <Zap className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search pricing rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Per KM</TableHead>
                    <TableHead>Per KG</TableHead>
                    <TableHead>Fuel Surcharge</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index} className="animate-pulse">
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-32" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 bg-gray-200 rounded w-20" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-28" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-20" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 bg-gray-200 rounded w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 w-4 bg-gray-200 rounded" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No pricing rules found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Get started by creating your first pricing rule"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Pricing Rule
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Per KM</TableHead>
                  <TableHead>Per KG</TableHead>
                  <TableHead>Fuel Surcharge</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <React.Fragment key={rule.id}>
                    <TableRow
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleRowExpansion(rule.id)}
                    >
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {expandedRows.has(rule.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                          <span className="font-medium">{rule.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getServiceTypeBadge(rule.service_type || "")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-gray-900">
                          <MapPin className="w-4 h-4 mr-2" />
                          {rule.zone_origin || "Any"} →{" "}
                          {rule.zone_destination || "Any"}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${rule.base_price.toFixed(2)}
                      </TableCell>
                      <TableCell>${rule.price_per_km.toFixed(2)}</TableCell>
                      <TableCell>${rule.price_per_kg.toFixed(2)}</TableCell>
                      <TableCell>{rule.fuel_surcharge_percent}%</TableCell>
                      <TableCell>
                        <Badge variant={rule.is_active ? "success" : "default"}>
                          {rule.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <MoreHorizontal className="w-4 h-4" />
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(rule.id) && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-gray-50">
                          <div className="p-4 space-y-4">
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">
                                Price Calculation Example
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="text-sm text-gray-500">
                                    Distance
                                  </label>
                                  <p className="font-medium">100 km</p>
                                </div>
                                <div>
                                  <label className="text-sm text-gray-500">
                                    Weight
                                  </label>
                                  <p className="font-medium">50 kg</p>
                                </div>
                                <div>
                                  <label className="text-sm text-gray-500">
                                    Total Price
                                  </label>
                                  <p className="text-lg font-bold text-blue-600">
                                    $
                                    {calculatePrice(
                                      rule.base_price,
                                      100,
                                      50,
                                      rule.fuel_surcharge_percent
                                    ).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(rule);
                                }}
                              >
                                Edit Rule
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRule(rule.id);
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Pricing Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Rule Name
              </Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Mumbai to Pune Standard"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Service Type
                </Label>
                <select
                  value={formData.service_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      service_type: e.target.value as any,
                    })
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Status
                </Label>
                <select
                  value={formData.is_active ? "true" : "false"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_active: e.target.value === "true",
                    })
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Origin Zone
                </Label>
                <select
                  value={formData.zone_origin}
                  onChange={(e) =>
                    setFormData({ ...formData, zone_origin: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Zones</option>
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Destination Zone
                </Label>
                <select
                  value={formData.zone_destination}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      zone_destination: e.target.value,
                    })
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Zones</option>
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Base Price ($)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.base_price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      base_price: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Price Per KM ($)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price_per_km}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_per_km: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Price Per KG ($)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price_per_kg}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_per_kg: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Fuel Surcharge (%)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.fuel_surcharge_percent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fuel_surcharge_percent: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.0"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddRule}
              disabled={isCreating || !formData.name}
            >
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pricing Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Rule Name
              </Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Mumbai to Pune Standard"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Service Type
                </Label>
                <select
                  value={formData.service_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      service_type: e.target.value as any,
                    })
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Status
                </Label>
                <select
                  value={formData.is_active ? "true" : "false"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_active: e.target.value === "true",
                    })
                  }
                  className="w-full mt-1 px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            {/* ... Rest of the form fields same as Add dialog ... */}
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setSelectedRule(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditRule}
              disabled={isUpdating || !formData.name}
            >
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
