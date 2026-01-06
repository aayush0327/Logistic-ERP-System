"use client";

import { useState, useRef } from "react";
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
import { useOutsideClick } from "@/components/Hooks/useOutsideClick";
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
  Filter,
  X,
  ChevronDown,
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
import { CurrencyDisplay } from "@/components/CurrencyDisplay";

export default function ProductsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
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
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);

  useOutsideClick(filterRef, () => {
    if (filterDropdownOpen) {
      setFilterDropdownOpen(false);
    }
  });

  const { data: categoriesData } = useGetProductCategoriesQuery({
    include_children: true,
  });

  const categories = categoriesData?.items || [];
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
    is_active: statusFilter !== "all" ? statusFilter === "active" : undefined,
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
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error loading products</h3>
          <p className="text-red-600 text-sm mt-1">
            Please try refreshing the page
          </p>
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
            className="flex items-center gap-2 px-3 md:px-4 py-3 bg-[#1f40ae] hover:bg-[#1f40ae] active:bg-[#1f40ae] text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm md:text-base font-semibold hover:font-bold">
              New Product
            </span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Total Products Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#edf0f7] border-2 border-[#c4cde9]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Total Products
            </p>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading ? "..." : products?.length || 0}
            </p>
          </div>
        </div>

        {/* Active Products Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7f0] border-2 border-[#c5edd6]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Active Products
            </p>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <div className="w-5 h-5 md:w-6 md:h-6 bg-emerald-500 rounded-full" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading
                ? "..."
                : products.filter((p) => p.is_active).length}
            </p>
          </div>
        </div>

        {/* Low Stock Items Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#f0f7fa] border-2 border-[#c0e5f7]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Low Stock Items
            </p>
            <div className="p-2 bg-sky-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-sky-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading
                ? "..."
                : products.filter((p) => p.current_stock <= p.min_stock_level)
                    .length}
            </p>
          </div>
        </div>

        {/* Categories Card */}
        <div className="rounded-xl p-3 md:p-6 transition-all duration-300 hover:shadow-md bg-[#fff8f0] border-2 border-[#f8e4c2]">
          <div className="flex justify-between items-start">
            <p className="text-sm md:text-base font-semibold text-black">
              Categories
            </p>
            <div className="p-2 bg-amber-100 rounded-lg">
              <Tag className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
            </div>
          </div>
          <div className="flex items-end justify-between mt-3">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLoading ? "..." : categories?.length || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Products</CardTitle>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full sm:w-64"
                />
              </div>

              {/* Filter Button with Dropdown */}
              <div className="relative" ref={filterRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                  className="flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Filter
                  <ChevronDown className="w-4 h-4" />
                </Button>

                {/* Filter Dropdown */}
                {filterDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setStatusFilter("all");
                          setFilterDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between text-black"
                      >
                        <span>All Products</span>
                        {statusFilter === "all" && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setStatusFilter("active");
                          setFilterDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between text-black"
                      >
                        <span>Active</span>
                        {statusFilter === "active" && (
                          <span className="w-2 h-2 bg-green-600 rounded-full" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setStatusFilter("inactive");
                          setFilterDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between text-black"
                      >
                        <span>Inactive</span>
                        {statusFilter === "inactive" && (
                          <span className="w-2 h-2 bg-gray-600 rounded-full" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Categories</option>
                {categories?.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>

              {/* Export Button */}
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Active Filter Chips */}
          {statusFilter !== "all" && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {statusFilter === "active" ? "Active" : "Inactive"}
                <button
                  onClick={() => setStatusFilter("all")}
                  className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Product Code</TableHead>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Category</TableHead>
                    <TableHead className="whitespace-nowrap">Weight</TableHead>
                    <TableHead className="whitespace-nowrap">Branch</TableHead>
                    <TableHead className="whitespace-nowrap">Unit Price</TableHead>
                    <TableHead className="whitespace-nowrap">Stock Level</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={index} className="animate-pulse">
                      <TableCell className="font-medium">
                        <div className="h-4 bg-gray-200 rounded w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-32" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-24" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-200 rounded w-16" />
                          <div className="h-3 bg-gray-200 rounded w-20" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded w-28" />
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-8 w-8 bg-gray-200 rounded" />
                          <div className="h-8 w-8 bg-gray-200 rounded" />
                          <div className="h-8 w-8 bg-gray-200 rounded" />
                          <div className="h-8 w-8 bg-gray-200 rounded" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
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
                statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by adding your first product"}
              </p>
              {!searchQuery &&
                categoryFilter === "all" &&
                branchFilter === "all" &&
                stockFilter === "all" &&
                statusFilter === "all" && (
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
                    <TableHead className="whitespace-nowrap">Product Code</TableHead>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Category</TableHead>
                    <TableHead className="whitespace-nowrap">Weight</TableHead>
                    <TableHead className="whitespace-nowrap">Branch</TableHead>
                    <TableHead className="whitespace-nowrap">Unit Price</TableHead>
                    <TableHead className="whitespace-nowrap">Stock Level</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
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
                              <CurrencyDisplay amount={product.unit_price} />
                            </p>
                            {product.special_price && (
                              <p className="text-sm text-green-600">
                                <CurrencyDisplay amount={product.special_price} /> (special)
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
                    </Button>
                    <span className="text-sm text-gray-600 px-2">
                      {page}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                    >
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
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this product? This action cannot
              be undone.
            </p>
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
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
