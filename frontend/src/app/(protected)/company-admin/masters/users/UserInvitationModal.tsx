'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { toast } from 'react-hot-toast';
import {
  Mail,
  Plus,
  X,
  Users,
  Building,
  Send
} from 'lucide-react';
import {
  useInviteUserMutation,
  useBulkInviteUsersMutation,
  useGetBranchesQuery,
  useGetRolesQuery
} from '@/services/api/companyApi';
import { UserInvitation } from '@/services/api/companyApi';

const invitationSchema = z.object({
  invitations: z.array(z.object({
    email: z.string().email('Invalid email address'),
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    role_id: z.number().min(1, 'Role is required'),
    branch_id: z.string().optional(),
    message: z.string().optional()
  }))
});

type InvitationFormData = z.infer<typeof invitationSchema>;

interface UserInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserInvitationModal({ isOpen, onClose }: UserInvitationModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Fetch branches and roles
  const { data: branchesData } = useGetBranchesQuery({ page: 1, per_page: 100 });
  const { data: rolesData } = useGetRolesQuery({});

  // Mutations
  const [inviteUser] = useInviteUserMutation();
  const [bulkInviteUsers] = useBulkInviteUsersMutation();

  const branches = branchesData?.items || [];
  const roles = rolesData?.items || [];

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      invitations: [
        {
          email: '',
          first_name: '',
          last_name: '',
          role_id: 0,
          branch_id: '',
          message: ''
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'invitations'
  });

  const handleAddInvitation = () => {
    append({
      email: '',
      first_name: '',
      last_name: '',
      role_id: 0,
      branch_id: '',
      message: ''
    });
  };

  const handleRemoveInvitation = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const onSubmit = async (data: InvitationFormData) => {
    setIsLoading(true);
    try {
      if (data.invitations.length === 1) {
        await inviteUser(data.invitations[0]).unwrap();
        toast.success('Invitation sent successfully');
      } else {
        await bulkInviteUsers({ invitations: data.invitations }).unwrap();
        toast.success(`${data.invitations.length} invitations sent successfully`);
      }

      reset();
      onClose();
    } catch (error) {
      toast.error('Failed to send invitation(s)');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send User Invitations
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            {fields.map((field, index) => (
              <Card key={field.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Invitation #{index + 1}
                    </CardTitle>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveInvitation(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address *
                      </label>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        {...register(`invitations.${index}.email`)}
                        className={errors.invitations?.[index]?.email ? 'border-red-500' : ''}
                      />
                      {errors.invitations?.[index]?.email && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.invitations[index]?.email?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role *
                      </label>
                      <select
                        {...register(`invitations.${index}.role_id`, {
                          valueAsNumber: true
                        })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.invitations?.[index]?.role_id ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="0">Select Role</option>
                        {roles?.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      {errors.invitations?.[index]?.role_id && (
                        <p className="text-red-500 text-xs mt-1">
                          Role is required
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name *
                      </label>
                      <Input
                        placeholder="John"
                        {...register(`invitations.${index}.first_name`)}
                        className={errors.invitations?.[index]?.first_name ? 'border-red-500' : ''}
                      />
                      {errors.invitations?.[index]?.first_name && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.invitations[index]?.first_name?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name *
                      </label>
                      <Input
                        placeholder="Doe"
                        {...register(`invitations.${index}.last_name`)}
                        className={errors.invitations?.[index]?.last_name ? 'border-red-500' : ''}
                      />
                      {errors.invitations?.[index]?.last_name && (
                        <p className="text-red-500 text-xs mt-1">
                          {errors.invitations[index]?.last_name?.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Branch
                    </label>
                    <select
                      {...register(`invitations.${index}.branch_id`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Branch (Optional)</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Message (Optional)
                    </label>
                    <textarea
                      {...register(`invitations.${index}.message`)}
                      rows={3}
                      placeholder="Add a custom message for the invitation..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleAddInvitation}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Invitation
          </Button>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending...
                </div>
              ) : (
                <div className="flex items-center">
                  <Send className="w-4 h-4 mr-2" />
                  Send {fields.length > 1 ? `${fields.length} Invitations` : 'Invitation'}
                </div>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}