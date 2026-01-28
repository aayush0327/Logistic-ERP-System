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
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  RefreshCw,
  FileClock,
  Eye,
  Info,
  User,
  Layers,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  ChevronDown,
  Plus,
  Mail,
  Activity,
  X,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useGetAuditLogsQuery,
  useLazyExportAuditLogsQuery,
  useGetAuditSummaryQuery,
  useGetUserEmailsQuery,
} from "@/services/api/companyApi";
import { AuditLog } from "@/services/api/companyApi";
import { DateDisplay } from "@/components/DateDisplay";


// Action type configurations
const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  create: { label: "Created", icon: Plus, color: "bg-green-100 text-green-700" },
  update: { label: "Updated", icon: Edit, color: "bg-blue-100 text-blue-700" },
  delete: { label: "Deleted", icon: Trash2, color: "bg-red-100 text-red-700" },
  approve: { label: "Approved", icon: CheckCircle, color: "bg-emerald-100 text-emerald-700" },
  reject: { label: "Rejected", icon: XCircle, color: "bg-rose-100 text-rose-700" },
  submit: { label: "Submitted", icon: FileClock, color: "bg-purple-100 text-purple-700" },
  cancel: { label: "Cancelled", icon: XCircle, color: "bg-orange-100 text-orange-700" },
  status_change: { label: "Status Changed", icon: Activity, color: "bg-cyan-100 text-cyan-700" },
  assign: { label: "Assigned", icon: User, color: "bg-indigo-100 text-indigo-700" },
  deliver: { label: "Delivered", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  remove: { label: "Removed", icon: Trash2, color: "bg-red-100 text-red-700" },
  reorder: { label: "Reordered", icon: ChevronDown, color: "bg-amber-100 text-amber-700" },
};

// Module configurations
const MODULE_CONFIG: Record<string, { label: string; color: string }> = {
  orders: { label: "Orders", color: "bg-blue-100 text-blue-700" },
  trips: { label: "Trips", color: "bg-purple-100 text-purple-700" },
  customers: { label: "Customers", color: "bg-green-100 text-green-700" },
  vehicles: { label: "Vehicles", color: "bg-orange-100 text-orange-700" },
  branches: { label: "Branches", color: "bg-cyan-100 text-cyan-700" },
  products: { label: "Products", color: "bg-pink-100 text-pink-700" },
  users: { label: "Users", color: "bg-indigo-100 text-indigo-700" },
  roles: { label: "Roles", color: "bg-rose-100 text-rose-700" },
};

const ENTITY_TYPE_CONFIG: Record<string, { label: string }> = {
  order: { label: "Order" },
  trip: { label: "Trip" },
  trip_order: { label: "Trip Order" },
  customer: { label: "Customer" },
  vehicle: { label: "Vehicle" },
  branch: { label: "Branch" },
  product: { label: "Product" },
  user: { label: "User" },
  role: { label: "Role" },
};

// Filter options
const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "create", label: "Created" },
  { value: "update", label: "Updated" },
  { value: "delete", label: "Deleted" },
  { value: "approve", label: "Approved" },
  { value: "reject", label: "Rejected" },
  { value: "submit", label: "Submitted" },
  { value: "cancel", label: "Cancelled" },
  { value: "status_change", label: "Status Changed" },
  { value: "assign", label: "Assigned" },
  { value: "deliver", label: "Delivered" },
];

const MODULE_OPTIONS = [
  { value: "", label: "All Modules" },
  { value: "orders", label: "Orders" },
  { value: "trips", label: "Trips" },
  { value: "customers", label: "Customers" },
  { value: "vehicles", label: "Vehicles" },
  { value: "branches", label: "Branches" },
  { value: "products", label: "Products" },
  { value: "users", label: "Users" },
];

const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "All Entity Types" },
  { value: "order", label: "Order" },
  { value: "trip", label: "Trip" },
  { value: "trip_order", label: "Trip Order" },
  { value: "customer", label: "Customer" },
  { value: "vehicle", label: "Vehicle" },
  { value: "branch", label: "Branch" },
  { value: "product", label: "Product" },
  { value: "user", label: "User" },
];

// Detail Modal Component
function DetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const getActionBadge = (action: string) => {
    const config = ACTION_CONFIG[action] || {
      label: action,
      icon: Info,
      color: "bg-gray-100 text-gray-700"
    };
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} border-0 text-sm`}>
        <Icon className="w-4 h-4 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getModuleBadge = (module: string) => {
    const config = MODULE_CONFIG[module] || { label: module, color: "bg-gray-100 text-gray-700" };
    return (
      <Badge variant="outline" className={`${config.color} border-0 text-sm`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Audit Log Details</h2>
            <p className="text-sm text-gray-500 mt-1">
              <DateDisplay date={log.created_at} format="full" />
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* User Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              User Information
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">User ID</p>
                <p className="text-sm font-medium text-gray-900">{log.user_id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Role</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{log.user_role || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-medium text-gray-900">{log.user_email || '-'}</p>
              </div>
            </div>
          </div>

          {/* Action Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Action Information
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Action:</span>
                {getActionBadge(log.action)}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Module:</span>
                {getModuleBadge(log.module)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Entity Type</p>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {ENTITY_TYPE_CONFIG[log.entity_type]?.label || log.entity_type}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Entity ID</p>
                  <p className="text-sm font-medium text-gray-900">{log.entity_id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Description</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-900">{log.description}</p>
            </div>
          </div>

          {/* Status Change */}
          {(log.from_status || log.to_status ||
            (log.new_values && (log.new_values.delivery_status || log.new_values.status))) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Status Change
              </h3>
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-center gap-3">
                  {(log.from_status || (log.old_values && log.old_values.status)) && (
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1">From</span>
                      <Badge variant="outline" className="bg-white border-gray-200 shadow-sm px-4 py-2">
                        <span className="capitalize text-black">
                          {log.from_status || (log.old_values?.status)?.replace(/-/g, ' ') || '-'}
                        </span>
                      </Badge>
                    </div>
                  )}
                  <ArrowRight className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  {(log.to_status || (log.new_values && (log.new_values.delivery_status || log.new_values.status))) && (
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-gray-500 mb-1">To</span>
                      <Badge variant="outline" className="bg-blue-100 border-blue-200 shadow-sm px-4 py-2">
                        <span className="capitalize text-black">
                          {log.to_status || (log.new_values?.delivery_status || log.new_values?.status)?.replace(/-/g, ' ') || '-'}
                        </span>
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Approval Status */}
          {log.approval_status && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Approval Status</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <Badge
                  variant="outline"
                  className={log.approval_status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                >
                  {log.approval_status}
                </Badge>
              </div>
            </div>
          )}

          {/* Reason */}
          {log.reason && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Reason</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-900">{log.reason}</p>
              </div>
            </div>
          )}

          {/* Old Values */}
          {log.old_values && Object.keys(log.old_values).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Previous Values
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2">
                  {Object.entries(log.old_values).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-3 py-2 border-b border-gray-200 last:border-0">
                      <span className="text-xs font-medium text-gray-500 min-w-[120px] capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-sm text-gray-900 flex-1">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* New Values */}
          {log.new_values && Object.keys(log.new_values).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                New Values
              </h3>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
                <div className="space-y-2">
                  {Object.entries(log.new_values).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-3 py-2 border-b border-blue-200 last:border-0">
                      <span className="text-xs font-medium text-blue-600 min-w-[120px] capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-sm text-gray-900 flex-1 font-medium">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Metadata
            </h3>
            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Service</p>
                <p className="text-sm font-medium text-gray-900">{log.service_name || '-'}</p>
              </div>
              {/* <div>
                <p className="text-xs text-gray-500">IP Address</p>
                <p className="text-sm font-medium text-gray-900">{log.ip_address || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">User Agent</p>
                <p className="text-sm font-medium text-gray-900 break-all">{log.user_agent || '-'}</p>
              </div> */}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [userEmailFilter, setUserEmailFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch audit logs
  const {
    data: auditLogsData,
    isLoading,
    error,
    refetch,
  } = useGetAuditLogsQuery({
    page,
    per_page: 50,
    action: actionFilter || undefined,
    module: moduleFilter || undefined,
    entity_type: entityTypeFilter || undefined,
    date_from: dateFromFilter || undefined,
    date_to: dateToFilter || undefined,
    user_id: userIdFilter || undefined,
    user_email: userEmailFilter || undefined,
  });

  // Fetch summary statistics
  const { data: summaryData } = useGetAuditSummaryQuery({});

  // Fetch user emails for dropdown
  const { data: userEmailsData, isLoading: userEmailsLoading } = useGetUserEmailsQuery();

  const [triggerExport] = useLazyExportAuditLogsQuery();

  const auditLogs = auditLogsData?.items || [];
  const total = auditLogsData?.total || 0;
  const pages = auditLogsData?.pages || 0;

  const handleExport = async () => {
    try {
      const result = await triggerExport({
        action: actionFilter || undefined,
        module: moduleFilter || undefined,
        entity_type: entityTypeFilter || undefined,
        date_from: dateFromFilter || undefined,
        date_to: dateToFilter || undefined,
        user_id: userIdFilter || undefined,
        user_email: userEmailFilter || undefined,
      }).unwrap();

      // Create download link
      const url = window.URL.createObjectURL(new Blob([result]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const getActionBadge = (action: string) => {
    const config = ACTION_CONFIG[action] || {
      label: action,
      icon: Info,
      color: "bg-gray-100 text-gray-700"
    };
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} border-0`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getModuleBadge = (module: string) => {
    const config = MODULE_CONFIG[module] || { label: module, color: "bg-gray-100 text-gray-700" };
    return (
      <Badge variant="outline" className={`${config.color} border-0`}>
        {config.label}
      </Badge>
    );
  };

  const hasActiveFilters = actionFilter || moduleFilter || entityTypeFilter || dateFromFilter || dateToFilter || userIdFilter || userEmailFilter;

  const clearFilters = () => {
    setActionFilter("");
    setModuleFilter("");
    setEntityTypeFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setUserIdFilter("");
    setUserEmailFilter("");
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-sm text-gray-500">
              Track all system activities and changes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      {summaryData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Logs</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryData.total.toLocaleString()}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileClock className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Modules</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryData.by_module.length}</p>
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Layers className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Actions</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryData.by_action.length}</p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryData.top_users.length}</p>
                </div>
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? "Hide" : "Show"} Filters
              {hasActiveFilters && (
                <Badge variant="default" className="ml-2">Active</Badge>
              )}
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="border-t">
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by user, entity ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Action Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {ACTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Module Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Module
                </label>
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {MODULE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entity Type
                </label>
                <select
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {ENTITY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <Input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <Input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                />
              </div>

              {/* User ID Filter */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID
                </label>
                <Input
                  placeholder="Enter user ID..."
                  value={userIdFilter}
                  onChange={(e) => setUserIdFilter(e.target.value)}
                />
              </div>

              {/* User Email Filter */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Email
                </label>
                {userEmailsLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                ) : (
                  <select
                    value={userEmailFilter}
                    onChange={(e) => setUserEmailFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All User Emails</option>
                    {userEmailsData?.items.map((item) => (
                      <option key={item.email} value={item.email}>
                        {item.email} {item.name ? `(${item.name})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Activity Logs</CardTitle>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Total: <strong className="text-gray-900">{total.toLocaleString()}</strong></span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-500">Loading audit logs...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-medium">Error loading audit logs</h3>
              <p className="text-red-600 text-sm mt-1">
                {(error as any)?.data?.message || "Failed to load audit logs. Please try again."}
              </p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileClock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No audit logs found</h3>
              <p className="text-gray-500 text-sm mb-4">
                {hasActiveFilters ? "Try adjusting your filters" : "No activity has been recorded yet"}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-gray-50">
                        <TableCell className="text-sm">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              <DateDisplay date={log.created_at} format="short" />
                            </span>
                            <span className="text-gray-500 text-xs">
                              <DateDisplay date={log.created_at} format="time" />
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span className="font-medium text-sm">
                                {log.user_email || log.user_id}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Role:</span>
                              <span className="text-xs text-gray-700 capitalize">{log.user_role || '-'}</span>
                            </div>
                            {log.service_name && (
                              <span className="text-xs text-gray-400">
                                via {log.service_name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>{getModuleBadge(log.module)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium capitalize">
                              {ENTITY_TYPE_CONFIG[log.entity_type]?.label || log.entity_type}
                            </span>
                            <span className="text-gray-500 text-xs block truncate max-w-[120px]">
                              {log.entity_id}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-[250px] truncate" title={log.description}>
                            {log.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, total)} of {total} logs
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                        let pageNum;
                        if (pages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= pages - 2) {
                          pageNum = pages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(pageNum)}
                            className="min-w-[40px]"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                      disabled={page === pages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 mr-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <DetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
