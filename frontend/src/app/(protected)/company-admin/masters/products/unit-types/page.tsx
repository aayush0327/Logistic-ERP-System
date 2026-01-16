"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Tag,
  Plus,
  Edit,
  Search,
  MoreHorizontal,
  X,
  Check,
} from "lucide-react";
import {
  useGetProductUnitTypesQuery,
  useCreateProductUnitTypeMutation,
  useUpdateProductUnitTypeMutation,
  useDeleteProductUnitTypeMutation,
} from "@/services/api/companyApi";
import {
  ProductUnitTypeCreate,
  ProductUnitType,
} from "@/services/api/companyApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { toast } from "react-hot-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRouter } from "next/navigation";

export default function ProductUnitTypesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUnitType, setSelectedUnitType] = useState<ProductUnitType | null>(null);
  const [formData, setFormData] = useState<Partial<ProductUnitTypeCreate>>({
    code: "",
    name: "",
    abbreviation: "",
    description: "",
    is_active: true,
  });
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null);

  const {
    data: unitTypesData,
    isLoading,
    refetch,
  } = useGetProductUnitTypesQuery({
    search: searchQuery || undefined,
    is_active: activeFilter ?? undefined,
  });

  const [createUnitType, { isLoading: isCreating }] =
    useCreateProductUnitTypeMutation();
  const [updateUnitType, { isLoading: isUpdating }] =
    useUpdateProductUnitTypeMutation();
  const [deleteUnitType, { isLoading: isDeleting }] =
    useDeleteProductUnitTypeMutation();

  // Handle both array and paginated response formats
  const unitTypes = Array.isArray(unitTypesData)
    ? unitTypesData
    : unitTypesData?.items || [];
  const total = unitTypesData?.total || unitTypes.length;

  const handleAddUnitType = async () => {
    if (!formData.code?.trim()) {
      toast.error("Code is required");
      return;
    }
    if (!formData.name?.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      await createUnitType({
        code: formData.code.toUpperCase(),
        name: formData.name,
        abbreviation: formData.abbreviation,
        description: formData.description,
        is_active: formData.is_active,
      }).unwrap();

      toast.success("Unit type created successfully");
      setShowAddDialog(false);
      setFormData({
        code: "",
        name: "",
        abbreviation: "",
        description: "",
        is_active: true,
      });
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.detail || "Failed to create unit type");
    }
  };

  const handleEditUnitType = async () => {
    if (!selectedUnitType) return;

    try {
      await updateUnitType({
        id: selectedUnitType.id,
        unitType: {
          code: formData.code?.toUpperCase(),
          name: formData.name,
          abbreviation: formData.abbreviation,
          description: formData.description,
          is_active: formData.is_active,
        },
      }).unwrap();

      toast.success("Unit type updated successfully");
      setShowEditDialog(false);
      setSelectedUnitType(null);
      setFormData({
        code: "",
        name: "",
        abbreviation: "",
        description: "",
        is_active: true,
      });
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.detail || "Failed to update unit type");
    }
  };

  const handleDeleteUnitType = async (id: string) => {
    if (!confirm("Are you sure you want to delete this unit type?")) return;

    try {
      await deleteUnitType(id).unwrap();
      toast.success("Unit type deleted successfully");
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.detail || "Failed to delete unit type");
    }
  };

  const openEditDialog = (unitType: ProductUnitType) => {
    setSelectedUnitType(unitType);
    setFormData({
      code: unitType.code,
      name: unitType.name,
      abbreviation: unitType.abbreviation || "",
      description: unitType.description || "",
      is_active: unitType.is_active,
    });
    setShowEditDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Unit Types</h1>
          <p className="text-gray-500">Manage measurement units for products</p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-[#1F40AE] hover:bg-[#203BA0] text-white px-4 py-2 rounded-lg font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Unit Type
        </Button>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by code, name, or abbreviation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeFilter === null ? "default" : "outline"}
                onClick={() => setActiveFilter(null)}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={activeFilter === true ? "default" : "outline"}
                onClick={() => setActiveFilter(true)}
                size="sm"
              >
                Active
              </Button>
              <Button
                variant={activeFilter === false ? "default" : "outline"}
                onClick={() => setActiveFilter(false)}
                size="sm"
              >
                Inactive
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unit Types List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Tag className="w-5 h-5 mr-2" />
              Unit Types ({total})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading unit types...</p>
            </div>
          ) : unitTypes.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No unit types found</p>
              <Button
                onClick={() => setShowAddDialog(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Unit Type
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {unitTypes.map((unitType) => (
                <div
                  key={unitType.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg border border-gray-200 group"
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <Tag className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-medium text-gray-900">
                          {unitType.name}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {unitType.code}
                        </Badge>
                        {unitType.abbreviation && (
                          <Badge variant="secondary" className="text-xs">
                            {unitType.abbreviation}
                          </Badge>
                        )}
                      </div>
                      {unitType.description && (
                        <p className="text-sm text-gray-500 mt-1">
                          {unitType.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge variant={unitType.is_active ? "success" : "default"}>
                      {unitType.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(unitType)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteUnitType(unitType.id)}
                          className="text-red-600"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Unit Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                placeholder="e.g., KG"
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-1">
                Unique code (e.g., KG, LTR, PCS)
              </p>
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Kilogram"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="abbreviation">Abbreviation</Label>
              <Input
                id="abbreviation"
                value={formData.abbreviation}
                onChange={(e) =>
                  setFormData({ ...formData, abbreviation: e.target.value })
                }
                placeholder="e.g., kg"
                maxLength={20}
              />
              <p className="text-xs text-gray-500 mt-1">
                Display abbreviation (e.g., kg, ltr, pcs)
              </p>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description"
                maxLength={500}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="w-4 h-4"
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddUnitType}
                disabled={isCreating}
                className="bg-[#1F40AE] hover:bg-[#203BA0] text-white"
              >
                {isCreating ? "Creating..." : "Create Unit Type"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Unit Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_code">Code *</Label>
              <Input
                id="edit_code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                placeholder="e.g., KG"
                maxLength={20}
              />
            </div>
            <div>
              <Label htmlFor="edit_name">Name *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Kilogram"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="edit_abbreviation">Abbreviation</Label>
              <Input
                id="edit_abbreviation"
                value={formData.abbreviation}
                onChange={(e) =>
                  setFormData({ ...formData, abbreviation: e.target.value })
                }
                placeholder="e.g., kg"
                maxLength={20}
              />
            </div>
            <div>
              <Label htmlFor="edit_description">Description</Label>
              <Input
                id="edit_description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description"
                maxLength={500}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="w-4 h-4"
              />
              <Label htmlFor="edit_is_active">Active</Label>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditUnitType}
                disabled={isUpdating}
                className="bg-[#1F40AE] hover:bg-[#203BA0] text-white"
              >
                {isUpdating ? "Updating..." : "Update Unit Type"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
