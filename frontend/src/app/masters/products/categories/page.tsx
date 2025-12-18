'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Tag,
  Plus,
  Edit,
  Eye,
  Search,
  Package,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Folder,
  FolderOpen,
  X,
  Check
} from 'lucide-react';
import {
  useGetProductCategoriesQuery,
  useCreateProductCategoryMutation,
  useUpdateProductCategoryMutation,
  useDeleteProductCategoryMutation
} from '@/services/api/companyApi';
import { ProductCategoryCreate, ProductCategory } from '@/services/api/companyApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { toast } from 'react-hot-toast';

interface CategoryItemProps {
  category: any;
  level: number;
  onEdit: (category: any) => void;
  onDelete: (id: string) => void;
}

function CategoryItem({ category, level, onEdit, onDelete }: CategoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasChildren = category.children && category.children.length > 0;

  return (
    <div className="select-none">
      <div
        className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer group"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        <div className="flex items-center space-x-3 flex-1">
          {hasChildren && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          {!hasChildren && <div className="w-6" />}
          {hasChildren ? (
            <FolderOpen className="w-5 h-5 text-blue-600" />
          ) : (
            <Tag className="w-5 h-5 text-gray-400" />
          )}
          <div>
            <p className="font-medium text-gray-900">{category.name}</p>
            {category.description && (
              <p className="text-sm text-gray-500">{category.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={category.is_active ? 'success' : 'default'}>
            {category.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(category)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(category.id)} className="text-red-600">
                <X className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {category.children.map((child: any) => (
            <CategoryItem
              key={child.id}
              category={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductCategoriesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<ProductCategoryCreate>>({
    name: '',
    description: '',
    parent_id: '',
    is_active: true
  });

  const { data: categoriesData, isLoading, refetch } = useGetProductCategoriesQuery({ include_children: true });
  const [createCategory, { isLoading: isCreating }] = useCreateProductCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdateProductCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] = useDeleteProductCategoryMutation();

  // Handle both array and paginated response formats
  const categories = Array.isArray(categoriesData) ? categoriesData : categoriesData?.items || [];
  const rootCategories = categories?.filter(c => !c.parent_id) || [];

  const handleAddCategory = async () => {
    try {
      await createCategory({
        name: formData.name || '',
        description: formData.description,
        parent_id: formData.parent_id || undefined,
        is_active: formData.is_active
      }).unwrap();

      toast.success('Category created successfully');
      setShowAddDialog(false);
      setFormData({ name: '', description: '', parent_id: '', is_active: true });
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to create category');
    }
  };

  const handleEditCategory = async () => {
    if (!selectedCategory) return;

    try {
      await updateCategory({
        id: selectedCategory.id,
        category: {
          name: formData.name || '',
          description: formData.description,
          parent_id: formData.parent_id || undefined,
          is_active: formData.is_active
        }
      }).unwrap();

      toast.success('Category updated successfully');
      setShowEditDialog(false);
      setSelectedCategory(null);
      setFormData({ name: '', description: '', parent_id: '', is_active: true });
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id).unwrap();
      toast.success('Category deleted successfully');
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete category');
    }
  };

  const openEditDialog = (category: any) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      parent_id: category.parent_id || '',
      is_active: category.is_active
    });
    setShowEditDialog(true);
  };

  const renderCategoryOptions = (categories: ProductCategory[], level = 0) => {
    return categories.map(category => (
      <option key={category.id} value={category.id}>
        {'  '.repeat(level)}{category.name}
      </option>
    ));
  };

  const getAllCategories = (categories: ProductCategory[], parent_id: string | null = null): ProductCategory[] => {
    const result: ProductCategory[] = [];
    categories.forEach(category => {
      if (category.parent_id === parent_id) {
        result.push(category);
        result.push(...getAllCategories(categories, category.id));
      }
    });
    return result;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Product Categories</h1>
            <p className="text-gray-500 mt-2">Manage your product categories hierarchy</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Category
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Categories</p>
                  <p className="text-2xl font-bold text-gray-900">{categories?.length || 0}</p>
                </div>
                <Tag className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Root Categories</p>
                  <p className="text-2xl font-bold text-gray-900">{rootCategories.length}</p>
                </div>
                <Folder className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {categories?.filter(c => c.is_active).length || 0}
                  </p>
                </div>
                <Check className="w-8 h-8 text-green-600" />
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
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Categories Tree */}
        <Card>
          <CardHeader>
            <CardTitle>Categories Hierarchy</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : rootCategories.length === 0 ? (
              <div className="text-center py-8">
                <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
                <p className="text-gray-500 mb-4">Get started by creating your first category</p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Category
                </Button>
              </div>
            ) : (
              <div>
                {rootCategories.map(category => (
                  <CategoryItem
                    key={category.id}
                    category={category}
                    level={0}
                    onEdit={openEditDialog}
                    onDelete={handleDeleteCategory}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Category Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Category name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Parent Category</label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Root Category</option>
                  {renderCategoryOptions(getAllCategories(categories || []))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Category description (optional)"
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active Category
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCategory}
                disabled={isCreating || !formData.name}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Category Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Category name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Parent Category</label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Root Category</option>
                  {categories && renderCategoryOptions(getAllCategories(categories).filter(c => c.id !== selectedCategory?.id))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Category description (optional)"
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="edit_is_active" className="text-sm font-medium text-gray-700">
                  Active Category
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  setSelectedCategory(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditCategory}
                disabled={isUpdating || !formData.name}
              >
                {isUpdating ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}