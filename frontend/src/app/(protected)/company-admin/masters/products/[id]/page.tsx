"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import {
  ArrowLeft,
  Edit,
  Package,
  DollarSign,
  Box,
  Info,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import {
  useGetProductQuery,
  useGetProductStockHistoryQuery,
} from "@/services/api/companyApi";

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const { data: product, isLoading, error } = useGetProductQuery(productId);

  if (error) {
    return (
      <div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium">
              Error loading product details
            </h3>
            <p className="text-red-600 text-sm mt-1">
              The product may not exist or you don't have permission to view it
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const getStockStatus = () => {
    if (!product.max_stock_level)
      return { status: "unknown", label: "Not Set" };

    const percentage = (product.current_stock / product.max_stock_level) * 100;
    if (product.current_stock <= product.min_stock_level) {
      return { status: "critical", label: "Low Stock", color: "text-red-600" };
    } else if (percentage < 25) {
      return { status: "warning", label: "Low", color: "text-yellow-600" };
    } else if (percentage < 75) {
      return { status: "normal", label: "In Stock", color: "text-green-600" };
    } else {
      return { status: "high", label: "Plenty", color: "text-blue-600" };
    }
  };

  const stockStatus = getStockStatus();
  const stockPercentage = product.max_stock_level
    ? (product.current_stock / product.max_stock_level) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-gray-500">Product Code: {product.code}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={product.is_active ? "success" : "default"}>
            {product.is_active ? "Active" : "Inactive"}
          </Badge>
          <Button
            onClick={() =>
              router.push(`/company-admin/masters/products/${productId}/edit`)
            }
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Product
          </Button>
        </div>
      </div>

      {/* Product Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Info className="w-5 h-5 mr-2" />
              Basic Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">
                Product Code
              </label>
              <p className="text-gray-900">{product.code}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Category
              </label>
              <p className="text-gray-900">
                {product.category?.name || "Uncategorized"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Status
              </label>
              <div className="mt-1">
                <Badge variant={product.is_active ? "success" : "default"}>
                  {product.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Created Date
              </label>
              <p className="text-gray-900">
                {new Date(product.created_at).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">
                Unit Price
              </label>
              <p className="text-2xl font-bold text-gray-900">
                ${product.unit_price.toFixed(2)}
              </p>
            </div>
            {product.special_price && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Special Price
                </label>
                <p className="text-lg font-semibold text-green-600">
                  ${product.special_price.toFixed(2)}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">
                Total Value
              </label>
              <p className="text-lg font-semibold text-gray-900">
                ${(product.current_stock * product.unit_price).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Box className="w-5 h-5 mr-2" />
              Inventory
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">
                Current Stock
              </label>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-bold text-gray-900">
                  {product.current_stock}
                </p>
                <span className={`text-sm font-medium ${stockStatus.color}`}>
                  ({stockStatus.label})
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Min Level
              </label>
              <p className="text-lg text-gray-900">
                {product.min_stock_level || 0}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Max Level
              </label>
              <p className="text-lg text-gray-900">
                {product.max_stock_level || 0}
              </p>
            </div>
            <div className="pt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    stockStatus.status === "critical"
                      ? "bg-red-500"
                      : stockStatus.status === "warning"
                      ? "bg-yellow-500"
                      : stockStatus.status === "normal"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stockPercentage.toFixed(1)}% of max stock
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Specifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {product.weight && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Weight
                </label>
                <p className="text-gray-900">{product.weight} kg</p>
              </div>
            )}
            {product.volume && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Volume
                </label>
                <p className="text-gray-900">{product.volume} m³</p>
              </div>
            )}
            {product.length && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Dimensions
                </label>
                <p className="text-gray-900">
                  {product.length} × {product.width || 0} ×{" "}
                  {product.height || 0} cm
                </p>
              </div>
            )}
            {product.handling_requirements &&
              product.handling_requirements.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Handling
                  </label>
                  <div className="mt-1 space-y-1">
                    {product.handling_requirements.map((req, index) => (
                      <Badge
                        key={index}
                        variant="default"
                        className="mr-1 mb-1"
                      >
                        {req}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Product Statistics */}
      {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">234</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Quantity Sold</p>
                <p className="text-2xl font-bold text-gray-900">1,567</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">$78,350</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Order</p>
                <p className="text-2xl font-bold text-gray-900">50</p>
              </div>
              <BarChart3 className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div> */}

      {/* Detailed Tabs */}
      {/* <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="stock-history">Stock History</TabsTrigger>
          <TabsTrigger value="orders">Recent Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Stock Movements (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-green-900">Stock Added</span>
                    <span className="text-lg font-bold text-green-600">
                      +450
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="text-sm text-red-900">Stock Used</span>
                    <span className="text-lg font-bold text-red-600">-320</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-900">Net Change</span>
                    <span className="text-lg font-bold text-blue-600">
                      +130
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      Days of Stock Left
                    </span>
                    <span className="text-lg font-semibold text-black">
                      {product.max_stock_level
                        ? Math.floor(
                            product.current_stock /
                              (product.max_stock_level * 0.1)
                          )
                        : 0}{" "}
                      days
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Reorder Point</span>
                    <span className="text-lg font-semibold text-black">
                      {product.min_stock_level || 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      Avg Daily Usage
                    </span>
                    <span className="text-lg font-semibold text-black">
                      45 units
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Turnover Rate</span>
                    <span className="text-lg font-semibold text-black">
                      8.5 / year
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="description">
          <Card>
            <CardHeader>
              <CardTitle>Product Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                {product.description ? (
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {product.description}
                  </p>
                ) : (
                  <p className="text-gray-500">No description available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock-history">
          <Card>
            <CardHeader>
              <CardTitle>Stock History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Balance After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>2024-01-15</TableCell>
                    <TableCell>
                      <Badge variant="success">Stock In</Badge>
                    </TableCell>
                    <TableCell className="text-green-600">+200</TableCell>
                    <TableCell>Purchase Order #PO-001</TableCell>
                    <TableCell>850</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2024-01-14</TableCell>
                    <TableCell>
                      <Badge variant="default">Stock Out</Badge>
                    </TableCell>
                    <TableCell className="text-red-600">-150</TableCell>
                    <TableCell>Order #ORD-123</TableCell>
                    <TableCell>650</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2024-01-13</TableCell>
                    <TableCell>
                      <Badge variant="warning">Adjustment</Badge>
                    </TableCell>
                    <TableCell className="text-yellow-600">+50</TableCell>
                    <TableCell>Stock Count</TableCell>
                    <TableCell>800</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>2024-01-12</TableCell>
                    <TableCell>
                      <Badge variant="default">Stock Out</Badge>
                    </TableCell>
                    <TableCell className="text-red-600">-100</TableCell>
                    <TableCell>Order #ORD-122</TableCell>
                    <TableCell>750</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">#ORD-1234</TableCell>
                    <TableCell>2024-01-15</TableCell>
                    <TableCell>ABC Corp</TableCell>
                    <TableCell>50</TableCell>
                    <TableCell>${product.unit_price.toFixed(2)}</TableCell>
                    <TableCell>
                      ${(50 * product.unit_price).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="success">Delivered</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">#ORD-1233</TableCell>
                    <TableCell>2024-01-14</TableCell>
                    <TableCell>XYZ Ltd</TableCell>
                    <TableCell>100</TableCell>
                    <TableCell>
                      $
                      {product.special_price?.toFixed(2) ||
                        product.unit_price.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      $
                      {(
                        100 * (product.special_price || product.unit_price)
                      ).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">In Transit</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">#ORD-1232</TableCell>
                    <TableCell>2024-01-13</TableCell>
                    <TableCell>Global Inc</TableCell>
                    <TableCell>75</TableCell>
                    <TableCell>${product.unit_price.toFixed(2)}</TableCell>
                    <TableCell>
                      ${(75 * product.unit_price).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="warning">Pending</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs> */}
    </div>
  );
}
