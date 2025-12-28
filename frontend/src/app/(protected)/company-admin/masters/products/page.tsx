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
  Package,
  DollarSign,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
  Tag,
  Box,
  Building,
  ArrowLeft,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useGetProductsQuery,
  useDeleteProductMutation,
  useUpdateProductMutation,
  useGetProductCategoriesQuery,
  useGetBranchesQuery,
} from "@/services/api/companyApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { toast } from "react-hot-toast";

export default function ProductsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "normal">(
    "all"
  );
  const [priceFilter, setPriceFilter] = useState<{
    min?: number;
    max?: number;
  }>({});
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const { data: categoriesData } = useGetProductCategoriesQuery({
    include_children: true,
  });

  const categories = categoriesData?.items || [];
  console.log(categories, "categories");
  const { data: branches } = useGetBranchesQuery({});

  const {
    data: productsData,
    isLoading,
    error,
  } = useGetProductsQuery({
    page,
    per_page: 20,
    search: searchQuery || undefined,
    category_id: categoryFilter !== "all" ? categoryFilter : undefined,
    branch_id: branchFilter !== "all" ? branchFilter : undefined,
    min_price: priceFilter.min,
    max_price: priceFilter.max,
    low_stock: stockFilter === "low",
  });

  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();
  const [updateProduct] = useUpdateProductMutation();

  // Extract products from paginated response
  const products = productsData?.items || [];
  const totalProducts = productsData?.total || 0;
  const totalPages = productsData?.pages || 1;

  const handleEdit = (id: string) => {
    router.push(`/company-admin/masters/products/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/company-admin/masters/products/${id}`);
  };

  const handleToggleActive = async (product: any) => {
    try {
      await updateProduct({
        id: product.id,
        product: { is_active: !product.is_active },
      }).unwrap();
      toast.success(
        product.is_active
          ? "Product deactivated successfully"
          : "Product activated successfully"
      );
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to update product status");
    }
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      await deleteProduct(productToDelete).unwrap();
      toast.success("Product deleted successfully");
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (error: any) {
      toast.error(error?.data?.message || "Failed to delete product");
    }
  };

  const confirmDelete = (id: string) => {
    setProductToDelete(id);
    setDeleteDialogOpen(true);
  };

  const getStockStatus = (product: any) => {
    const percentage = (product.current_stock / product.max_stock_level) * 100;
    if (product.current_stock <= product.min_stock_level) {
      return { status: "critical", label: "Low Stock", color: "red" };
    } else if (percentage < 25) {
      return { status: "warning", label: "Low", color: "yellow" };
    } else if (percentage < 75) {
      return { status: "normal", label: "In Stock", color: "green" };
    } else {
      return { status: "high", label: "Plenty", color: "blue" };
    }
  };

  const handlePriceFilterChange = (type: "min" | "max", value: string) => {
    const numValue = parseFloat(value) || undefined;
    setPriceFilter((prev) => ({
      ...prev,
      [type]: numValue,
    }));
  };

  if (error) {
    return (
      <div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium">Error loading products</h3>
            <p className="text-red-600 text-sm mt-1">
              Please try refreshing the page
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
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
              Product Management
            </h1>
            <p className="text-gray-500 mt-2">
              Manage your product catalog and inventory
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() =>
              router.push("/company-admin/masters/products/categories")
            }
            className="flex items-center gap-2"
          >
            <Tag className="w-4 h-4" />
            Manage Categories
          </Button>
          <Button
            onClick={() => router.push("/company-admin/masters/products/new")}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Product
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">
                  {products?.length || 0}
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
                <p className="text-sm text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-red-600">
                  {
                    products.filter((p) => p.current_stock <= p.min_stock_level)
                      .length
                  }
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Categories</p>
                <p className="text-2xl font-bold text-purple-600">
                  {categories?.length || 0}
                </p>
              </div>
              <Tag className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-green-600">
                  $
                  {products
                    .reduce((sum, p) => sum + p.current_stock * p.unit_price, 0)
                    .toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
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
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categories?.map((category) => (
                <option
                  className="text-black"
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
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
                <option
                  className="text-black"
                  key={branch.id}
                  value={branch.id}
                >
                  {branch.name}
                </option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) =>
                setStockFilter(e.target.value as "all" | "low" | "normal")
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option className="text-black" value="all">
                All Stock Levels
              </option>
              <option className="text-black" value="low">
                Low Stock Only
              </option>
              <option className="text-black" value="normal">
                Normal Stock
              </option>
            </select>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min Price"
                value={priceFilter.min || ""}
                onChange={(e) => handlePriceFilterChange("min", e.target.value)}
                className="w-32"
              />
              <Input
                type="number"
                placeholder="Max Price"
                value={priceFilter.max || ""}
                onChange={(e) => handlePriceFilterChange("max", e.target.value)}
                className="w-32"
              />
            </div>
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

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No products found
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery ||
                categoryFilter !== "all" ||
                branchFilter !== "all" ||
                stockFilter !== "all" ||
                priceFilter.min ||
                priceFilter.max
                  ? "Try adjusting your filters"
                  : "Get started by adding your first product"}
              </p>
              {!searchQuery &&
                categoryFilter === "all" &&
                branchFilter === "all" &&
                stockFilter === "all" &&
                !priceFilter.min &&
                !priceFilter.max && (
                  <Button
                    onClick={() =>
                      router.push("/company-admin/masters/products/new")
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Stock Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const stockStatus = getStockStatus(product);
                    return (
                      <TableRow
                        key={product.id}
                        className={`hover:bg-gray-50 ${
                          !product.is_active ? "bg-gray-50 opacity-60" : ""
                        }`}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {product.code}
                            {!product.is_active && (
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
                              {product.name}
                            </p>
                            {product.description && (
                              <p className="text-sm text-gray-500 truncate max-w-xs">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-900">
                            {product.category?.name || "Uncategorized"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <Badge
                              variant={
                                product.weight_type === "fixed"
                                  ? "success"
                                  : "warning"
                              }
                              className="w-fit mb-1"
                            >
                              {product.weight_type === "fixed"
                                ? "Fixed"
                                : "Variable"}
                            </Badge>
                            <span className="text-xs text-gray-600">
                              {product.weight_type === "fixed"
                                ? `${
                                    product.fixed_weight || product.weight || 0
                                  } ${product.weight_unit || "kg"}`
                                : "Enter weight when creating order"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-gray-900">
                            <Building className="w-3 h-3 mr-1" />
                            {product.available_for_all_branches
                              ? "All Branches"
                              : product.branches && product.branches.length > 0
                              ? product.branches
                                  .map((pb: any) => pb.branch?.name)
                                  .join(", ")
                              : "Not assigned"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              ${product.unit_price.toFixed(2)}
                            </p>
                            {product.special_price && (
                              <p className="text-sm text-green-600">
                                ${product.special_price.toFixed(2)} (special)
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Box className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">
                              {product.current_stock} /{" "}
                              {product.max_stock_level || 0}
                            </span>
                            <Badge variant={stockStatus.status as any}>
                              {stockStatus.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={product.is_active ? "success" : "default"}
                          >
                            {product.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(product.id)}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(product.id)}
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={product.is_active ? "ghost" : "outline"}
                              size="sm"
                              onClick={() => handleToggleActive(product)}
                              title={
                                product.is_active ? "Deactivate" : "Activate"
                              }
                              className={
                                product.is_active
                                  ? "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                  : "text-green-600 hover:text-green-700 hover:bg-green-50"
                              }
                            >
                              {product.is_active ? (
                                <Power className="w-4 h-4" />
                              ) : (
                                <PowerOff className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmDelete(product.id)}
                              title="Delete"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {products.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Showing {products.length} of {totalProducts} products
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
                      disabled={page >= totalPages}
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
            {productToDelete &&
              (() => {
                const product = products.find(
                  (p: any) => p.id === productToDelete
                );
                return (
                  <>
                    <p className="text-sm text-gray-600">
                      Are you sure you want to delete this product? This action
                      cannot be undone.
                    </p>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">
                        {product?.code}
                      </p>
                      <p className="text-sm text-gray-600">{product?.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        ${product?.unit_price?.toFixed(2) || 0} per unit
                      </p>
                    </div>
                  </>
                );
              })()}
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setProductToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
