"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAppSelector } from "@/store/hooks";
import { api } from "@/lib/api";
import { showSuccessToast, showErrorToast } from "@/utils/toast";
import {
  Building,
  Building2,
  UserPlus,
  Shield,
  Power,
  PowerOff,
  Search,
  Plus,
  Edit,
  CheckCircle,
  XCircle,
  Settings,
  Trash2,
  Eye,
  EyeOff,
  Users,
} from "lucide-react";

// Type definitions for company data
interface Company {
  id: string;
  name: string;
  domain?: string;
  admin_email?: string;
  total_users?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  admin?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
  };
}

export default function SuperAdmin() {
  const { user } = useAppSelector((state) => state.auth);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState({
    total_companies: 0,
    active_companies: 0,
    disabled_companies: 0,
    total_users: 0,
  });
  const [loading, setLoading] = useState(true);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    domain: "",
    admin_email: "",
    admin_first_name: "",
    admin_last_name: "",
    admin_password: "temp123456",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditAdminModal, setShowEditAdminModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [adminEditForm, setAdminEditForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    new_password: "",
  });

  // Fetch companies and stats on component mount
  useEffect(() => {
    fetchCompaniesAndStats();
  }, []);

  const fetchCompaniesAndStats = async () => {
    try {
      setLoading(true);
      const [companiesData, statsData] = await Promise.all([
        api.getAllTenants(),
        api.getCompaniesStats(),
      ]);
      setCompanies(companiesData);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      showErrorToast("Failed to load companies data");
    } finally {
      setLoading(false);
    }
  };

  // Check if user is super admin
  if (!user?.is_superuser) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-500">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.admin_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      company.is_active === (statusFilter === "active");
    return matchesSearch && matchesStatus;
  });

  const handleCreateCompany = async (formData: any) => {
    try {
      const response = await api.createCompanyWithAdmin(formData);
      showSuccessToast("Company and admin created successfully!");
      fetchCompaniesAndStats(); // Refresh data
      return response;
    } catch (error) {
      console.error("Failed to create company:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create company";
      showErrorToast(errorMessage);
      throw error;
    }
  };

  const handleCompanyFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: companyForm.name,
        domain: companyForm.domain,
        admin: {
          email: companyForm.admin_email,
          first_name: companyForm.admin_first_name,
          last_name: companyForm.admin_last_name,
          password: companyForm.admin_password,
        },
      };
      await handleCreateCompany(data);
      setCompanyForm({
        name: "",
        domain: "",
        admin_email: "",
        admin_first_name: "",
        admin_last_name: "",
        admin_password: "temp123456",
      });
    } catch (error) {
      // Error is already handled in handleCreateCompany
    }
  };

  const handleToggleCompanyStatus = async (
    tenantId: string,
    isActive: boolean
  ) => {
    try {
      await api.updateTenantStatus(tenantId, isActive);
      showSuccessToast(
        `Company ${isActive ? "activated" : "deactivated"} successfully`
      );
      fetchCompaniesAndStats(); // Refresh data
    } catch (error) {
      console.error("Failed to update company status:", error);
      showErrorToast("Failed to update company status");
    }
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setShowEditModal(true);
  };

  const handleEditAdmin = (company: Company) => {
    setEditingCompany(company);
    setAdminEditForm({
      email: company.admin_email || "",
      first_name: "",
      last_name: "",
      password: "",
      new_password: "",
    });
    setShowEditAdminModal(true);
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    try {
      const updateData: any = {};
      if (adminEditForm.email) updateData.email = adminEditForm.email;
      if (adminEditForm.first_name)
        updateData.first_name = adminEditForm.first_name;
      if (adminEditForm.last_name)
        updateData.last_name = adminEditForm.last_name;
      if (adminEditForm.new_password)
        updateData.password = adminEditForm.new_password;

      const response = await fetch(
        `/api/super-admin/companies/${editingCompany.id}/admin`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update admin");
      }

      showSuccessToast("Admin updated successfully!");
      setShowEditAdminModal(false);
      fetchCompaniesAndStats();
    } catch (error) {
      console.error("Failed to update admin:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update admin";
      showErrorToast(errorMessage);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;

    try {
      const updateData = {
        name: (e.target as any).name.value,
        domain: (e.target as any).domain.value,
      };

      await api.updateTenant(editingCompany.id, updateData);
      showSuccessToast("Company updated successfully!");
      setShowEditModal(false);
      setEditingCompany(null);
      fetchCompaniesAndStats();
    } catch (error) {
      console.error("Failed to update company:", error);
      showErrorToast("Failed to update company");
    }
  };

  const handleDeleteCompany = (company: Company) => {
    setDeletingCompany(company);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCompany) return;

    try {
      await api.deleteTenant(deletingCompany.id);
      showSuccessToast("Company deleted successfully!");
      setShowDeleteModal(false);
      setDeletingCompany(null);
      fetchCompaniesAndStats();
    } catch (error) {
      console.error("Failed to delete company:", error);
      showErrorToast("Failed to delete company");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Super Admin Dashboard
        </h1>
        <p className="text-gray-500 mt-2">
          Manage all logistics companies and system-wide settings
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {stats.total_companies}
                </p>
                <p className="text-sm text-gray-500">Total Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {stats.active_companies}
                </p>
                <p className="text-sm text-gray-500">Active Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Users className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">
                  {(stats.total_users || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-green-600">Active</p>
                <p className="text-sm text-gray-500">System Health</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        <TabsList>
          <TabsTrigger value="companies" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Manage Companies
          </TabsTrigger>
          <TabsTrigger
            value="create-company"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Company
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>All Companies</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Company
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Search companies..."
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
                    All ({companies.length})
                  </Button>
                  <Button
                    variant={statusFilter === "active" ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("active")}
                  >
                    Active ({companies.filter((c) => c.is_active).length})
                  </Button>
                  <Button
                    variant={
                      statusFilter === "disabled" ? "primary" : "outline"
                    }
                    size="sm"
                    onClick={() => setStatusFilter("disabled")}
                  >
                    Disabled ({companies.filter((c) => !c.is_active).length})
                  </Button>
                </div>
              </div>

              {/* Companies Table */}
              {loading ? (
                <div className="space-y-4 py-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-4 border border-gray-100 rounded-lg"
                    >
                      <Skeleton
                        variant="rectangle"
                        width="8rem"
                        height="1rem"
                      />
                      <Skeleton variant="line" width="6rem" height="1rem" />
                      <div className="flex-1 space-y-1">
                        <Skeleton
                          variant="line"
                          width="10rem"
                          height="0.875rem"
                        />
                        <Skeleton
                          variant="line"
                          width="8rem"
                          height="0.75rem"
                        />
                      </div>
                      <Skeleton variant="line" width="3rem" height="1rem" />
                      <Skeleton variant="line" width="5rem" height="1.5rem" />
                      <Skeleton variant="line" width="6rem" height="1rem" />
                    </div>
                  ))}
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No companies found
                  </h3>
                  <p className="text-gray-500">
                    {searchQuery || statusFilter !== "all"
                      ? "Try adjusting your search or filter criteria"
                      : "Get started by creating your first company"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Admin Details</TableHead>
                      <TableHead className="text-center">Users</TableHead>
                      <TableHead className="text-center">Orders</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => (
                      <React.Fragment key={company.id}>
                        <TableRow>
                          <TableCell className="font-medium text-gray-900">
                            {company.name}
                          </TableCell>
                          <TableCell className="text-sm text-gray-900">
                            {company.domain}
                          </TableCell>
                          <TableCell>
                            {company.admin ? (
                              <div>
                                <div className="font-medium text-gray-900">
                                  {company.admin.first_name}{" "}
                                  {company.admin.last_name}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {company.admin.email}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-500">
                                No admin assigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-lg font-medium text-gray-900">
                              {company.total_users || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-gray-500">
                            -
                          </TableCell>
                          <TableCell className="text-sm text-gray-900">
                            {formatDateTime(company.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                company.is_active ? "success" : "warning"
                              }
                            >
                              <div className="flex items-center gap-1">
                                {company.is_active ? (
                                  <CheckCircle className="w-3 h-3" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                                {company.is_active ? "Active" : "Inactive"}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditCompany(company)}
                                title="Edit Company"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditAdmin(company)}
                                title="Edit Admin"
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteCompany(company)}
                                title="Delete Company"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleToggleCompanyStatus(
                                    company.id,
                                    !company.is_active
                                  )
                                }
                                className={
                                  company.is_active
                                    ? "text-yellow-600 hover:text-yellow-700"
                                    : "text-green-600 hover:text-green-700"
                                }
                                title={
                                  company.is_active
                                    ? "Deactivate Company"
                                    : "Activate Company"
                                }
                              >
                                {company.is_active ? (
                                  <PowerOff className="w-4 h-4" />
                                ) : (
                                  <Power className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create-company">
          <Card>
            <CardHeader>
              <CardTitle>Create New Logistics Company</CardTitle>
              <p className="text-sm text-gray-500">
                Set up a new logistics company with admin credentials
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompanyFormSubmit}>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Company Details
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Company Name
                          </label>
                          <Input
                            type="text"
                            placeholder="Enter company name"
                            value={companyForm.name}
                            onChange={(e) =>
                              setCompanyForm({
                                ...companyForm,
                                name: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Company Domain
                          </label>
                          <Input
                            type="text"
                            placeholder="company-name.logistic-erp.com"
                            value={companyForm.domain}
                            onChange={(e) =>
                              setCompanyForm({
                                ...companyForm,
                                domain: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Admin Account
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Admin Email
                          </label>
                          <Input
                            type="email"
                            placeholder="admin@company.com"
                            value={companyForm.admin_email}
                            onChange={(e) =>
                              setCompanyForm({
                                ...companyForm,
                                admin_email: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              First Name
                            </label>
                            <Input
                              type="text"
                              placeholder="First name"
                              value={companyForm.admin_first_name}
                              onChange={(e) =>
                                setCompanyForm({
                                  ...companyForm,
                                  admin_first_name: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Last Name
                            </label>
                            <Input
                              type="text"
                              placeholder="Last name"
                              value={companyForm.admin_last_name}
                              onChange={(e) =>
                                setCompanyForm({
                                  ...companyForm,
                                  admin_last_name: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Initial Password
                          </label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Set initial password"
                              value={companyForm.admin_password}
                              onChange={(e) =>
                                setCompanyForm({
                                  ...companyForm,
                                  admin_password: e.target.value,
                                })
                              }
                              required
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 transform -translate-y-1/2"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <Button type="submit" className="w-full md:w-auto">
                    Create Company with Admin
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Company Modal */}
      {showEditModal && editingCompany && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => {
              setShowEditModal(false);
              setEditingCompany(null);
            }}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-96">
            <Card className="bg-white/95 backdrop-blur-md shadow-lg">
              <CardHeader className="border-b border-gray-100 px-6 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-gray-800">
                  <Edit className="w-4 h-4 text-gray-600" />
                  Edit Company
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pt-4">
                <form onSubmit={handleUpdateCompany}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Company Name
                      </label>
                      <Input
                        type="text"
                        name="name"
                        defaultValue={editingCompany.name}
                        required
                        className="text-sm h-9 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Company Domain
                      </label>
                      <Input
                        type="text"
                        name="domain"
                        defaultValue={editingCompany.domain || ""}
                        required
                        className="text-sm h-9 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingCompany(null);
                      }}
                      className="text-xs hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="text-xs">
                      Update
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Edit Admin Modal */}
      {showEditAdminModal && editingCompany && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => {
              setShowEditAdminModal(false);
              setEditingCompany(null);
            }}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[450px]">
            <Card className="bg-white/95 backdrop-blur-md shadow-lg">
              <CardHeader className="border-b border-gray-100 px-4 pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-gray-800">
                  <UserPlus className="w-3 h-3 text-blue-600" />
                  Edit Company Admin
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pt-3">
                <form onSubmit={handleUpdateAdmin}>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Current Admin Email
                      </label>
                      <div className="p-2 bg-gray-50 rounded-md border border-gray-200">
                        <p className="text-xs text-gray-900">
                          {editingCompany.admin_email || "No admin assigned"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        New Email (optional)
                      </label>
                      <Input
                        type="email"
                        name="email"
                        defaultValue={editingCompany.admin_email || ""}
                        onChange={(e) =>
                          setAdminEditForm({
                            ...adminEditForm,
                            email: e.target.value,
                          })
                        }
                        placeholder="Enter new email or leave unchanged"
                        className="text-xs h-8 focus:ring-2 focus:ring-blue-500/20 bg-white/70"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          First Name
                        </label>
                        <Input
                          type="text"
                          name="first_name"
                          value={adminEditForm.first_name}
                          onChange={(e) =>
                            setAdminEditForm({
                              ...adminEditForm,
                              first_name: e.target.value,
                            })
                          }
                          placeholder="Leave empty"
                          className="text-xs h-8 focus:ring-2 focus:ring-blue-500/20 bg-white/70"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Last Name
                        </label>
                        <Input
                          type="text"
                          name="last_name"
                          value={adminEditForm.last_name}
                          onChange={(e) =>
                            setAdminEditForm({
                              ...adminEditForm,
                              last_name: e.target.value,
                            })
                          }
                          placeholder="Leave empty"
                          className="text-xs h-8 focus:ring-2 focus:ring-blue-500/20 bg-white/70"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={adminEditForm.new_password}
                          onChange={(e) =>
                            setAdminEditForm({
                              ...adminEditForm,
                              new_password: e.target.value,
                            })
                          }
                          placeholder="Leave empty to keep current"
                          className="text-xs h-8 focus:ring-2 focus:ring-blue-500/20 bg-white/70 pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Password must be at least 8 characters
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2 pt-3 border-t border-gray-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowEditAdminModal(false);
                        setEditingCompany(null);
                        setAdminEditForm({
                          email: "",
                          first_name: "",
                          last_name: "",
                          password: "",
                          new_password: "",
                        });
                      }}
                      className="text-xs hover:bg-gray-50 h-7"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      className="text-xs h-7 bg-blue-600 hover:bg-blue-700"
                    >
                      Update Admin
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingCompany && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => {
              setShowDeleteModal(false);
              setDeletingCompany(null);
            }}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[400px]">
            <Card className="bg-white/95 backdrop-blur-md shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center mr-3">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Delete Company
                    </h3>
                    <p className="text-xs text-gray-600">
                      This action cannot be undone
                    </p>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-xs text-gray-800">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-gray-900">
                      {deletingCompany.name}
                    </span>
                    ?
                  </p>
                  {deletingCompany.admin_email && (
                    <p className="text-xs text-gray-600 mt-2">
                      <span className="font-medium">Admin:</span>{" "}
                      {deletingCompany.admin_email}
                    </p>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs text-red-600 font-medium flex items-center">
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      This will permanently delete the company and all data.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeletingCompany(null);
                    }}
                    className="text-xs hover:bg-gray-50 h-7"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmDelete}
                    size="sm"
                    className="text-xs h-7 bg-red-600 hover:bg-red-700"
                  >
                    Delete Company
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
