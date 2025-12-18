'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Search,
  Plus,
  Edit,
  Eye,
  MapPin,
  Phone,
  Mail,
  Users,
  Building,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Briefcase
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useGetCustomersQuery,
  useDeleteCustomerMutation,
  useGetBusinessTypesQuery
} from '@/services/api/companyApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { toast } from 'react-hot-toast';

export default function CustomersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  const { data: businessTypes } = useGetBusinessTypesQuery();

  const {
    data: customersData,
    isLoading,
    error
  } = useGetCustomersQuery({
    page,
    per_page: 20,
    search: searchQuery || undefined,
    business_type: businessTypeFilter !== 'all' ? businessTypeFilter : undefined,
    is_active: statusFilter !== 'all' ? statusFilter === 'active' : undefined
  });

  const [deleteCustomer, { isLoading: isDeleting }] = useDeleteCustomerMutation();

  // Extract customers items from paginated response
  const customers = customersData?.items || [];
  const totalCustomers = customersData?.total || 0;
  const totalPages = customersData?.pages || 1;

  const handleEdit = (id: string) => {
    router.push(`/masters/customers/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/masters/customers/${id}`);
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;

    try {
      await deleteCustomer(customerToDelete).unwrap();
      toast.success('Customer deleted successfully');
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete customer');
    }
  };

  const confirmDelete = (id: string) => {
    setCustomerToDelete(id);
    setDeleteDialogOpen(true);
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? 'success' : 'default'}>
        {isActive ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  const getBusinessTypeBadge = (businessType: string) => {
    const colors: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      'individual': 'default',
      'small_business': 'info',
      'corporate': 'success',
      'government': 'warning'
    };
    return (
      <Badge variant={colors[businessType] || 'default'}>
        {businessType?.replace('_', ' ') || 'N/A'}
      </Badge>
    );
  };

  if (error) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium">Error loading customers</h3>
            <p className="text-red-600 text-sm mt-1">Please try refreshing the page</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
            <p className="text-gray-500 mt-2">Manage your customer database and relationships</p>
          </div>
          <Button onClick={() => router.push('/masters/customers/new')} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Customer
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{totalCustomers}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {customers.filter(c => c.is_active).length}
                  </p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-green-600 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Corporate</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {customers.filter(c => c.business_type === 'corporate').length}
                  </p>
                </div>
                <Briefcase className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Credit Limit</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ${customers.reduce((sum, c) => sum + (c.credit_limit || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-orange-600">$</span>
                </div>
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
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === 'active' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('active')}
                >
                  Active
                </Button>
                <Button
                  variant={statusFilter === 'inactive' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('inactive')}
                >
                  Inactive
                </Button>
              </div>
              <select
                value={businessTypeFilter}
                onChange={(e) => setBusinessTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Business Types</option>
                {businessTypes?.map(type => (
                  <option key={type} value={type}>{type.replace('_', ' ')}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery || statusFilter !== 'all' || businessTypeFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Get started by creating your first customer'
                  }
                </p>
                {!searchQuery && statusFilter === 'all' && businessTypeFilter === 'all' && (
                  <Button onClick={() => router.push('/masters/customers/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Customer
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Business Type</TableHead>
                      <TableHead>Home Branch</TableHead>
                      <TableHead>Credit Limit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{customer.code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{customer.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {customer.phone && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Phone className="w-3 h-3 mr-1" />
                                {customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Mail className="w-3 h-3 mr-1" />
                                {customer.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="w-4 h-4 mr-1" />
                            {customer.city && customer.state ? `${customer.city}, ${customer.state}` : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getBusinessTypeBadge(customer.business_type || '')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-gray-900">
                            <Building className="w-3 h-3 mr-1" />
                            {customer.home_branch?.name || 'Not assigned'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-gray-900">
                            ${customer.credit_limit?.toLocaleString() || 0}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(customer.is_active)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(customer.id)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(customer.id)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => confirmDelete(customer.id)}
                                className="text-red-600"
                                disabled={!customer.is_active}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {customers.length > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Showing {customers.length} of {totalCustomers} customers
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
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this customer? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setCustomerToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}