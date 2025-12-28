'use client';

import { useState, useEffect } from 'react';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Search, Shield, Eye, EyeOff, Lock } from 'lucide-react';
import {
  useGetRolesQuery,
  useGetPermissionsQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation
} from '@/services/api/companyApi';
import { Role, Permission } from '@/services/api/companyApi';
import { toast } from 'react-hot-toast';

interface RoleSelectorProps {
  value?: number;
  onChange?: (roleId: number) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  showAll?: boolean;
}

export function RoleSelector({
  value,
  onChange,
  disabled = false,
  placeholder = "Select Role",
  className = "",
  showAll = true
}: RoleSelectorProps) {
  const { data: rolesData, isLoading } = useGetRolesQuery({});
  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.items || [];

  if (isLoading) {
    return (
      <Select disabled value="" className={className}>
        <option value="">Loading roles...</option>
      </Select>
    );
  }

  const filteredRoles = roles?.filter(role =>
    showAll || !role.is_system_role
  ) || [];

  return (
    <Select
      value={value?.toString() || ""}
      onChange={(e) => onChange?.(parseInt(e.target.value))}
      disabled={disabled}
      className={className}
    >
      <option value="">{placeholder}</option>
      {filteredRoles.map((role) => (
        <option key={role.id} value={role.id}>
          {role.name} {role.is_system_role && '(System)'}
        </option>
      ))}
    </Select>
  );
}

interface RoleBadgeProps {
  role?: Role;
  showDescription?: boolean;
}

export function RoleBadge({ role, showDescription = false }: RoleBadgeProps) {
  if (!role) return null;

  const colors: Record<string, string> = {
    'admin': 'destructive',
    'manager': 'default',
    'operator': 'secondary',
    'staff': 'outline',
    'driver': 'success'
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={colors[role.name.toLowerCase()] as any || 'outline'}>
        {role.name}
        {role.is_system_role && <Lock className="w-3 h-3 ml-1" />}
      </Badge>
      {showDescription && role.description && (
        <span className="text-sm text-gray-500">{role.description}</span>
      )}
    </div>
  );
}

interface RoleManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoleManager({ isOpen, onClose }: RoleManagerProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permission_ids: [] as number[]
  });

  // Fetch roles and permissions
  const { data: rolesData, refetch: refetchRoles } = useGetRolesQuery({});
  const { data: permissions } = useGetPermissionsQuery();
  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.items || [];

  // Mutations
  const [createRole] = useCreateRoleMutation();
  const [updateRole] = useUpdateRoleMutation();
  const [deleteRole] = useDeleteRoleMutation();

  const filteredRoles = roles?.filter(role =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permission_ids: role.permissions.map(p => p.id)
    });
    setIsEditing(true);
  };

  const handleCreate = () => {
    setSelectedRole(null);
    setFormData({
      name: '',
      description: '',
      permission_ids: []
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      if (selectedRole) {
        await updateRole({
          id: selectedRole.id.toString(),
          role: formData
        }).unwrap();
        toast.success('Role updated successfully');
      } else {
        await createRole(formData).unwrap();
        toast.success('Role created successfully');
      }

      setIsEditing(false);
      setSelectedRole(null);
      refetchRoles();
    } catch (error) {
      toast.error('Failed to save role');
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      return;
    }

    try {
      await deleteRole(role.id.toString()).unwrap();
      toast.success('Role deleted successfully');
      refetchRoles();
    } catch (error) {
      toast.error('Failed to delete role');
    }
  };

  const togglePermission = (permissionId: number) => {
    setFormData(prev => ({
      ...prev,
      permission_ids: prev.permission_ids.includes(permissionId)
        ? prev.permission_ids.filter(id => id !== permissionId)
        : [...prev.permission_ids, permissionId]
    }));
  };

  const groupPermissions = (permissions: Permission[]) => {
    const groups: Record<string, Permission[]> = {};
    permissions.forEach(permission => {
      if (!groups[permission.resource]) {
        groups[permission.resource] = [];
      }
      groups[permission.resource].push(permission);
    });
    return groups;
  };

  const permissionGroups = permissions ? groupPermissions(permissions) : {};

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center ${!isOpen ? 'hidden' : ''}`}>
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Role Management</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <EyeOff className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {!isEditing ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search roles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Create Role
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRoles.map((role) => (
                  <Card key={role.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {role.name}
                          {role.is_system_role && <Lock className="w-4 h-4 text-gray-500" />}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(role)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          {!role.is_system_role && (
                            <button
                              onClick={() => handleDelete(role)}
                              className="p-1 hover:bg-red-100 rounded text-red-600"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {role.description && (
                        <p className="text-sm text-gray-600 mb-2">{role.description}</p>
                      )}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-700">
                          Permissions ({role.permissions.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.slice(0, 5).map((permission) => (
                            <Badge key={permission.id} variant="outline" className="text-xs">
                              {permission.action}
                            </Badge>
                          ))}
                          {role.permissions.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{role.permissions.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  {selectedRole ? 'Edit Role' : 'Create Role'}
                </h3>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <EyeOff className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Name
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter role name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Enter role description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Permissions</h4>
                <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
                  {Object.entries(permissionGroups).map(([resource, resourcePermissions]) => (
                    <div key={resource}>
                      <h5 className="text-sm font-medium text-gray-900 mb-2 capitalize">
                        {resource}
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {resourcePermissions.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <Checkbox
                              checked={formData.permission_ids.includes(permission.id)}
                              onCheckedChange={() => togglePermission(permission.id)}
                            />
                            <span className="capitalize">{permission.action}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {selectedRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}