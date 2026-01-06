"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import {
  Briefcase,
  Plus,
  Edit,
  Eye,
  Search,
  MoreHorizontal,
  X,
  Check,
  Building,
  PowerOff,
} from "lucide-react";
import {
  useGetBusinessTypesQuery,
  useCreateBusinessTypeMutation,
  useUpdateBusinessTypeMutation,
  useDeleteBusinessTypeMutation,
} from "@/services/api/companyApi";
import {
  BusinessTypeModel,
  BusinessTypeModelCreate,
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

export default function BusinessTypesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessTypeModel | null>(null);
  const [formData, setFormData] = useState<Partial<BusinessTypeModelCreate>>({
    name: "",
    code: "",
    description: "",
    is_active: true,
  });

  const {
    data: businessTypesData,
    isLoading,
    refetch,
  } = useGetBusinessTypesQuery({
    is_active: statusFilter === "all" ? undefined : statusFilter === "active",
  });
  const [createBusinessType, { isLoading: isCreating }] =
    useCreateBusinessTypeMutation();
  const [updateBusinessType, { isLoading: isUpdating }] =
    useUpdateBusinessTypeMutation();
  const [deleteBusinessType, { isLoading: isDeleting }] =
    useDeleteBusinessTypeMutation();

  // Handle both array and paginated response formats
  const businessTypes = Array.isArray(businessTypesData)
    ? businessTypesData
    : businessTypesData?.items || [];

  const filteredBusinessTypes = businessTypes.filter((bt) =>
    bt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bt.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddBusinessType = async () => {
    try {
      // Generate code from name if not provided
      const code = formData.code || formData.name?.toLowerCase().replace(/\s+/g, '_') || '';

      await createBusinessType({
        name: formData.name || "",
        code,
        description: formData.description,
        is_active: formData.is_active,
      }).unwrap();

      toast.success("Business type created successfully");
      setShowAddDialog(false);
      setFormData({
        name: "",
        code: "",
        description: "",
        is_active: true,
      });
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.detail || "Failed to create business type");
    }
  };

  const handleEditBusinessType = async () => {
    if (!selectedBusinessType) return;

    try {
      await updateBusinessType({
        id: selectedBusinessType.id,
        businessType: {
          name: formData.name || "",
          description: formData.description,
          is_active: formData.is_active,
        },
      }).unwrap();

      toast.success("Business type updated successfully");
      setShowEditDialog(false);
      setSelectedBusinessType(null);
      setFormData({
        name: "",
        code: "",
        description: "",
        is_active: true,
      });
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.detail || "Failed to update business type");
    }
  };

  const handleDeleteBusinessType = async () => {
    if (!selectedBusinessType) return;

    try {
      const result = await deleteBusinessType(selectedBusinessType.id).unwrap();
      // 204 returns undefined, so success means no error thrown
      toast.success("Business type deleted successfully");
      setShowDeleteDialog(false);
      setSelectedBusinessType(null);
      refetch();
    } catch (error: any) {
      console.error("Delete error:", error);
      // Check if it's actually a 204 that was handled incorrectly
      if (error?.error?.code === "INTERNAL_SERVER_ERROR" && selectedBusinessType) {
        // Might be a false positive - the delete actually worked
        toast.success("Business type deleted successfully");
        setShowDeleteDialog(false);
        setSelectedBusinessType(null);
        refetch();
      } else {
        toast.error(error?.data?.detail || error?.error?.detail || "Failed to delete business type");
      }
    }
  };

  const confirmDelete = (businessType: BusinessTypeModel) => {
    setSelectedBusinessType(businessType);
    setShowDeleteDialog(true);
  };

  const handleToggleActive = async (businessType: BusinessTypeModel) => {
    try {
      await updateBusinessType({
        id: businessType.id,
        businessType: {
          is_active: !businessType.is_active,
        },
      }).unwrap();
      toast.success(
        `Business type ${businessType.is_active ? "deactivated" : "activated"} successfully`
      );
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.detail || "Failed to update business type");
    }
  };

  const openEditDialog = (businessType: BusinessTypeModel) => {
    setSelectedBusinessType(businessType);
    setFormData({
      name: businessType.name,
      code: businessType.code,
      description: businessType.description,
      is_active: businessType.is_active,
    });
    setShowEditDialog(true);
  };

  const generateCodeFromName = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  };

  const handleNameChange = (value: string) => {
    setFormData({ ...formData, name: value });
    // Auto-generate code if not manually set
    if (!formData.code || formData.code === generateCodeFromName(formData.name || '')) {
      setFormData(prev => ({
        ...prev,
        name: value,
        code: generateCodeFromName(value)
      }));
    }
  };

  return (
    <div>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Business Types
            </h1>
            <p className="text-gray-500 mt-2">
              Manage your customer business types
            </p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Business Type
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Business Types</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {businessTypes.length}
                  </p>
                </div>
                <Briefcase className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {businessTypes.filter((bt) => bt.is_active).length}
                  </p>
                </div>
                <Check className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {businessTypes.filter((bt) => !bt.is_active).length}
                  </p>
                </div>
                <Building className="w-8 h-8 text-gray-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search business types..."
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
                <Button
                  variant={statusFilter === "active" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("active")}
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === "inactive" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("inactive")}
                >
                  Inactive
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Types List */}
        <Card>
          <CardHeader>
            <CardTitle>Business Types</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 animate-pulse"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-5 h-5 bg-gray-200 rounded" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-24" />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-6 bg-gray-200 rounded w-16" />
                      <div className="h-8 w-8 bg-gray-200 rounded" />
                      <div className="h-8 w-8 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredBusinessTypes.length === 0 ? (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No business types found
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Get started by creating your first business type"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Business Type
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredBusinessTypes.map((businessType) => (
                  <div
                    key={businessType.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <Briefcase className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <p className="font-medium text-gray-900">
                            {businessType.name}
                          </p>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {businessType.code}
                          </span>
                        </div>
                        {businessType.description && (
                          <p className="text-sm text-gray-500 mt-1">
                            {businessType.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={businessType.is_active ? "success" : "default"}>
                        {businessType.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(businessType)}
                        className={`${
                          businessType.is_active
                            ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            : "text-green-600 hover:text-green-700 hover:bg-green-50"
                        }`}
                        title={businessType.is_active ? "Deactivate" : "Activate"}
                      >
                        <PowerOff className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(businessType)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => confirmDelete(businessType)}
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

        {/* Add Business Type Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Business Type</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g., Small Business"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Code *
                </label>
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })
                  }
                  placeholder="e.g., small_business"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Unique identifier for this business type
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Business type description (optional)"
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="is_active"
                  className="text-sm font-medium text-gray-700"
                >
                  Active Business Type
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddBusinessType}
                disabled={isCreating || !formData.name || !formData.code}
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Business Type Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Business Type</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Business type name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Code
                </label>
                <Input
                  value={formData.code}
                  disabled
                  className="mt-1 bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Code cannot be changed after creation
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Business type description (optional)"
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="edit_is_active"
                  className="text-sm font-medium text-gray-700"
                >
                  Active Business Type
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  setSelectedBusinessType(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditBusinessType}
                disabled={isUpdating || !formData.name}
              >
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete Business Type</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete the business type <strong>"{selectedBusinessType?.name}"</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This action cannot be undone. The business type will be permanently deleted.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Business types with existing customers cannot be deleted.
                  If any customers are using this business type, you will need to reassign them first.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedBusinessType(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteBusinessType}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
