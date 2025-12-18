'use client';

import { useState, useEffect } from 'react';
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
  Building,
  Users,
  Filter,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useGetBranchesQuery, useDeleteBranchMutation } from '@/services/api/companyApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { toast } from 'react-hot-toast';

export default function BranchesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);

  const {
    data: branchesData,
    isLoading,
    error
  } = useGetBranchesQuery({
    page,
    per_page: 20,
    search: searchQuery || undefined,
    is_active: statusFilter !== 'all' ? statusFilter === 'active' : undefined
  });

  const [deleteBranch, { isLoading: isDeleting }] = useDeleteBranchMutation();

  const branches = branchesData?.items || [];

  const filteredBranches = branches?.filter(branch => {
    const matchesSearch = !searchQuery ||
      branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.city?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && branch.is_active) ||
      (statusFilter === 'inactive' && !branch.is_active);

    return matchesSearch && matchesStatus;
  }) || [];

  const handleEdit = (id: string) => {
    router.push(`/masters/branches/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/masters/branches/${id}`);
  };

  const handleDelete = async () => {
    if (!branchToDelete) return;

    try {
      await deleteBranch(branchToDelete).unwrap();
      toast.success('Branch deleted successfully');
      setDeleteDialogOpen(false);
      setBranchToDelete(null);
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete branch');
    }
  };

  const confirmDelete = (id: string) => {
    setBranchToDelete(id);
    setDeleteDialogOpen(true);
  };

  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? 'success' : 'default'}>
        {isActive ? 'Active' : 'Inactive'}
      </Badge>
    );
  };

  if (error) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-medium">Error loading branches</h3>
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
            <h1 className="text-3xl font-bold text-gray-900">Branch Management</h1>
            <p className="text-gray-500 mt-2">Manage your company branches and locations</p>
          </div>
          <Button onClick={() => router.push('/masters/branches/new')} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Branch
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Branches</p>
                  <p className="text-2xl font-bold text-gray-900">{branches?.length || 0}</p>
                </div>
                <Building className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {branches?.filter(b => b.is_active).length || 0}
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
                  <p className="text-sm text-gray-600">Inactive</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {branches?.filter(b => !b.is_active).length || 0}
                  </p>
                </div>
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-gray-600 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {branches?.reduce((acc, branch) => acc + (branch.customers?.length || 0), 0) || 0}
                  </p>
                </div>
                <Users className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search branches..."
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
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Branches Table */}
        <Card>
          <CardHeader>
            <CardTitle>Branches</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : filteredBranches.length === 0 ? (
              <div className="text-center py-8">
                <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No branches found</h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Get started by creating your first branch'
                  }
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <Button onClick={() => router.push('/masters/branches/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Branch
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Customers</TableHead>
                      <TableHead>Vehicles</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBranches.map((branch) => (
                      <TableRow key={branch.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{branch.code}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{branch.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="w-4 h-4 mr-1" />
                            {branch.city && branch.state ? `${branch.city}, ${branch.state}` : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {branch.phone && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Phone className="w-3 h-3 mr-1" />
                                {branch.phone}
                              </div>
                            )}
                            {branch.email && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Mail className="w-3 h-3 mr-1" />
                                {branch.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-900">
                            {branch.manager_id || 'Not assigned'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center text-sm text-gray-900">
                            <Users className="w-3 h-3 mr-1" />
                            {branch.customers?.length || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center text-sm text-gray-900">
                            <Building className="w-3 h-3 mr-1" />
                            {branch.vehicles?.length || 0}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(branch.is_active)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(branch.id)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(branch.id)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => confirmDelete(branch.id)}
                                className="text-red-600"
                                disabled={!branch.is_active}
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
                {filteredBranches.length > 0 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Showing {filteredBranches.length} of {branches?.length || 0} branches
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
                        disabled={filteredBranches.length < 20}
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
                Are you sure you want to delete this branch? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setBranchToDelete(null);
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