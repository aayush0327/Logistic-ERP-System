'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Separator } from '@/components/ui/Separator';
import { toast } from 'react-hot-toast';
import {
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Building,
  Briefcase,
  CreditCard,
  Car,
  FileText,
  Edit,
  Save,
  X,
  Upload,
  Eye
} from 'lucide-react';
import {
  useGetUserQuery,
  useUpdateUserMutation,
  useGetUserProfileQuery,
  useUpdateUserProfileMutation,
  useGetProfileCompletionQuery,
  useUploadUserDocumentMutation,
  useGetUserDocumentsQuery,
  useDeleteUserDocumentMutation
} from '@/services/api/companyApi';
import { User as UserType, type UserProfile as UserProfileType } from '@/services/api/companyApi';
import { ProfileCompletion } from './ProfileCompletion';

const profileSchema = z.object({
  employee_id: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  date_of_joining: z.string().optional(),
  reporting_manager_id: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_number: z.string().optional(),
  blood_group: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  marital_status: z.enum(['single', 'married', 'divorced', 'widowed']).optional(),
  nationality: z.string().optional(),
  aadhar_number: z.string().optional(),
  pan_number: z.string().optional(),
  passport_number: z.string().optional(),
  current_address: z.object({
    address_line1: z.string(),
    address_line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
    country: z.string()
  }).optional(),
  permanent_address: z.object({
    address_line1: z.string(),
    address_line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
    country: z.string()
  }).optional(),
  bank_details: z.object({
    bank_name: z.string(),
    account_number: z.string(),
    ifsc_code: z.string(),
    branch_name: z.string(),
    account_type: z.enum(['savings', 'current'])
  }).optional(),
  driving_license: z.object({
    license_number: z.string(),
    license_type: z.array(z.string()),
    issue_date: z.string(),
    expiry_date: z.string(),
    issuing_authority: z.string()
  }).optional(),
  branch_manager_profile: z.object({
    managed_branch_id: z.string().optional(),
    can_create_quotes: z.boolean().default(true),
    can_approve_discounts: z.boolean().default(false),
    max_discount_percentage: z.number().default(0),
    can_manage_inventory: z.boolean().default(true),
    can_manage_vehicles: z.boolean().default(false),
    staff_management_permissions: z.object({
      hire: z.boolean().default(false),
      terminate: z.boolean().default(false),
      approve_leave: z.boolean().default(false),
      schedule_shifts: z.boolean().default(false),
      performance_reviews: z.boolean().default(false),
      salary_adjustments: z.boolean().default(false)
    }).default({})
  }).optional()
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface UserProfileProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfile({ userId, isOpen, onClose }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'professional' | 'documents'>('personal');

  // Fetch user data
  const { data: user, isLoading: userLoading } = useGetUserQuery(userId);
  const { data: profile, isLoading: profileLoading } = useGetUserProfileQuery(userId);
  const { data: completion } = useGetProfileCompletionQuery(userId);
  const { data: documents } = useGetUserDocumentsQuery({ profileId: profile?.id || '' });

  // Mutations
  const [updateUser] = useUpdateUserMutation();
  const [updateProfile] = useUpdateUserProfileMutation();
  const [uploadDocument] = useUploadUserDocumentMutation();
  const [deleteDocument] = useDeleteUserDocumentMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: profile || {}
  });

  useEffect(() => {
    if (profile) {
      reset(profile);
    }
  }, [profile, reset]);

  const handleSave = async (data: ProfileFormData) => {
    try {
      // Update basic user info if changed
      if (user && isDirty) {
        await updateUser({
          id: userId,
          user: {
            first_name: data.employee_id ? undefined : user.first_name,
            last_name: data.employee_id ? undefined : user.last_name,
            phone_number: data.emergency_contact_number
          }
        }).unwrap();
      }

      // Update profile
      await updateProfile({
        userId,
        profile: data
      }).unwrap();

      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const documentType = event.target.getAttribute('data-document-type');
    if (!documentType) return;

    try {
      await uploadDocument({
        profileId: profile?.id || '',
        document_type: documentType,
        document_name: file.name,
        file
      }).unwrap();

      toast.success('Document uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload document');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocument({
        documentId
      }).unwrap();

      toast.success('Document deleted successfully');
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  if (userLoading || profileLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {user?.first_name} {user?.last_name}
              </h2>
              <p className="text-gray-500">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={user?.is_active ? 'success' : 'default'}>
                  {user?.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="info">{user?.profile_type}</Badge>
                {user?.role && <Badge>{user.role.name}</Badge>}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {completion && <ProfileCompletion percentage={completion.percentage} />}
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSubmit(handleSave)}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Tabs */}
        <div className="flex space-x-1 mt-6 mb-6">
          <button
            onClick={() => setActiveTab('personal')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'personal'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Personal Info
          </button>
          <button
            onClick={() => setActiveTab('professional')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'professional'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Professional
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'documents'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Documents
          </button>
        </div>

        {/* Tab Content */}
        <form onSubmit={handleSubmit(handleSave)}>
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee ID
                    </label>
                    <Input
                      {...register('employee_id')}
                      disabled={!isEditing}
                      placeholder="Enter employee ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <Input
                      {...register('date_of_birth')}
                      type="date"
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      {...register('gender')}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Blood Group
                    </label>
                    <Input
                      {...register('blood_group')}
                      disabled={!isEditing}
                      placeholder="e.g., A+"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Marital Status
                    </label>
                    <select
                      {...register('marital_status')}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Status</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nationality
                    </label>
                    <Input
                      {...register('nationality')}
                      disabled={!isEditing}
                      placeholder="Enter nationality"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <Input
                      {...register('emergency_contact_number')}
                      disabled={!isEditing}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Emergency Contact Name
                    </label>
                    <Input
                      {...register('emergency_contact_name')}
                      disabled={!isEditing}
                      placeholder="Enter emergency contact name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Emergency Contact Number
                    </label>
                    <Input
                      {...register('emergency_contact_number')}
                      disabled={!isEditing}
                      placeholder="Enter emergency contact number"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Address Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-3">Current Address</h4>
                      <div className="space-y-3">
                        <Input
                          {...register('current_address.address_line1')}
                          disabled={!isEditing}
                          placeholder="Address Line 1"
                        />
                        <Input
                          {...register('current_address.address_line2')}
                          disabled={!isEditing}
                          placeholder="Address Line 2 (Optional)"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            {...register('current_address.city')}
                            disabled={!isEditing}
                            placeholder="City"
                          />
                          <Input
                            {...register('current_address.state')}
                            disabled={!isEditing}
                            placeholder="State"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            {...register('current_address.postal_code')}
                            disabled={!isEditing}
                            placeholder="Postal Code"
                          />
                          <Input
                            {...register('current_address.country')}
                            disabled={!isEditing}
                            placeholder="Country"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-3">Permanent Address</h4>
                      <div className="space-y-3">
                        <Input
                          {...register('permanent_address.address_line1')}
                          disabled={!isEditing}
                          placeholder="Address Line 1"
                        />
                        <Input
                          {...register('permanent_address.address_line2')}
                          disabled={!isEditing}
                          placeholder="Address Line 2 (Optional)"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            {...register('permanent_address.city')}
                            disabled={!isEditing}
                            placeholder="City"
                          />
                          <Input
                            {...register('permanent_address.state')}
                            disabled={!isEditing}
                            placeholder="State"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            {...register('permanent_address.postal_code')}
                            disabled={!isEditing}
                            placeholder="Postal Code"
                          />
                          <Input
                            {...register('permanent_address.country')}
                            disabled={!isEditing}
                            placeholder="Country"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Identification Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Aadhar Number
                      </label>
                      <Input
                        {...register('aadhar_number')}
                        disabled={!isEditing}
                        placeholder="Enter Aadhar number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        PAN Number
                      </label>
                      <Input
                        {...register('pan_number')}
                        disabled={!isEditing}
                        placeholder="Enter PAN number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Passport Number
                      </label>
                      <Input
                        {...register('passport_number')}
                        disabled={!isEditing}
                        placeholder="Enter passport number"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'professional' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Professional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department
                    </label>
                    <Input
                      {...register('department')}
                      disabled={!isEditing}
                      placeholder="Enter department"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Designation
                    </label>
                    <Input
                      {...register('designation')}
                      disabled={!isEditing}
                      placeholder="Enter designation"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Joining
                    </label>
                    <Input
                      {...register('date_of_joining')}
                      type="date"
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reporting Manager
                    </label>
                    <Input
                      {...register('reporting_manager_id')}
                      disabled={!isEditing}
                      placeholder="Select reporting manager"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Bank Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bank Name
                    </label>
                    <Input
                      {...register('bank_details.bank_name')}
                      disabled={!isEditing}
                      placeholder="Enter bank name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Number
                    </label>
                    <Input
                      {...register('bank_details.account_number')}
                      disabled={!isEditing}
                      placeholder="Enter account number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      IFSC Code
                    </label>
                    <Input
                      {...register('bank_details.ifsc_code')}
                      disabled={!isEditing}
                      placeholder="Enter IFSC code"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Branch Name
                    </label>
                    <Input
                      {...register('bank_details.branch_name')}
                      disabled={!isEditing}
                      placeholder="Enter branch name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Type
                    </label>
                    <select
                      {...register('bank_details.account_type')}
                      disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="savings">Savings</option>
                      <option value="current">Current</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              {user?.profile_type === 'driver' && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Driving License Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          License Number
                        </label>
                        <Input
                          {...register('driving_license.license_number')}
                          disabled={!isEditing}
                          placeholder="Enter license number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          License Type
                        </label>
                        <Input
                          {...register('driving_license.license_type')}
                          disabled={!isEditing}
                          placeholder="e.g., LMV, HMV"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Issue Date
                        </label>
                        <Input
                          {...register('driving_license.issue_date')}
                          type="date"
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Expiry Date
                        </label>
                        <Input
                          {...register('driving_license.expiry_date')}
                          type="date"
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Issuing Authority
                        </label>
                        <Input
                          {...register('driving_license.issuing_authority')}
                          disabled={!isEditing}
                          placeholder="Enter issuing authority"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {user?.profile_type === 'branch_manager' && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Branch Management Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!isEditing && profile?.branch_manager_profile ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                              Managed Branch
                            </label>
                            <div className="flex items-center space-x-2">
                              <Building className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-900">
                                {user?.branch?.name || 'Not assigned'}
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1">
                              Maximum Discount
                            </label>
                            <div className="flex items-center space-x-2">
                              <span className="text-2xl font-bold text-blue-600">
                                {profile.branch_manager_profile.max_discount_percentage || 0}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-900 mb-4">Branch Permissions</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center space-x-2">
                              {profile.branch_manager_profile.can_create_quotes ? (
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm">Can Create Quotes</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {profile.branch_manager_profile.can_approve_discounts ? (
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm">Can Approve Discounts</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {profile.branch_manager_profile.can_manage_inventory ? (
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm">Can Manage Inventory</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {profile.branch_manager_profile.can_manage_vehicles ? (
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm">Can Manage Vehicles</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-900 mb-4">Staff Management Permissions</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex items-center space-x-2">
                              {profile.branch_manager_profile.staff_management_permissions?.hire ? (
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm">Can Hire Staff</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {profile.branch_manager_profile.staff_management_permissions?.terminate ? (
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm">Can Terminate</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {profile.branch_manager_profile.staff_management_permissions?.approve_leave ? (
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm">Can Approve Leave</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {profile.branch_manager_profile.staff_management_permissions?.schedule_shifts ? (
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm">Can Schedule Shifts</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {profile.branch_manager_profile.staff_management_permissions?.performance_reviews ? (
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm">Performance Reviews</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {profile.branch_manager_profile.staff_management_permissions?.salary_adjustments ? (
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              <span className="text-sm">Salary Adjustments</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Managed Branch
                          </label>
                          <select
                            {...register('branch_manager_profile.managed_branch_id')}
                            disabled={!isEditing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select Branch</option>
                            {user?.branch && (
                              <option value={user.branch.id}>
                                {user.branch.name}
                              </option>
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Maximum Discount (%)
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            {...register('branch_manager_profile.max_discount_percentage')}
                            disabled={!isEditing}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}

                    {isEditing && (
                      <>
                        <div className="mt-6">
                          <h4 className="font-medium text-gray-900 mb-4">Permissions</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                {...register('branch_manager_profile.can_create_quotes')}
                                disabled={!isEditing}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">Can Create Quotes</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                {...register('branch_manager_profile.can_approve_discounts')}
                                disabled={!isEditing}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">Can Approve Discounts</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                {...register('branch_manager_profile.can_manage_inventory')}
                                disabled={!isEditing}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">Can Manage Inventory</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                {...register('branch_manager_profile.can_manage_vehicles')}
                                disabled={!isEditing}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">Can Manage Vehicles</span>
                            </label>
                          </div>
                        </div>

                        <div className="mt-6">
                          <h4 className="font-medium text-gray-900 mb-4">Staff Management Permissions</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                {...register('branch_manager_profile.staff_management_permissions.hire')}
                                disabled={!isEditing}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">Can Hire Staff</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                {...register('branch_manager_profile.staff_management_permissions.terminate')}
                                disabled={!isEditing}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">Can Terminate</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                {...register('branch_manager_profile.staff_management_permissions.approve_leave')}
                                disabled={!isEditing}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">Can Approve Leave</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                {...register('branch_manager_profile.staff_management_permissions.schedule_shifts')}
                                disabled={!isEditing}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">Can Schedule Shifts</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                {...register('branch_manager_profile.staff_management_permissions.performance_reviews')}
                                disabled={!isEditing}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">Performance Reviews</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                {...register('branch_manager_profile.staff_management_permissions.salary_adjustments')}
                                disabled={!isEditing}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm">Salary Adjustments</span>
                            </label>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upload Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { type: 'aadhar_card', label: 'Aadhar Card' },
                      { type: 'pan_card', label: 'PAN Card' },
                      { type: 'passport', label: 'Passport' },
                      { type: 'driving_license', label: 'Driving License' },
                      { type: 'address_proof', label: 'Address Proof' },
                      { type: 'educational_certificate', label: 'Educational Certificate' },
                      { type: 'experience_certificate', label: 'Experience Certificate' },
                      { type: 'photo', label: 'Passport Size Photo' },
                      { type: 'resume', label: 'Resume/CV' },
                      { type: 'offer_letter', label: 'Offer Letter' },
                      { type: 'salary_slip', label: 'Salary Slip' },
                      { type: 'bank_statement', label: 'Bank Statement' },
                      { type: 'form_16', label: 'Form 16' },
                      { type: ' relieving_letter', label: 'Relieving Letter' }
                    ].map((doc) => (
                      <div key={doc.type} className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-700 mb-2">{doc.label}</p>
                        <label className="cursor-pointer">
                          <span className="text-sm text-blue-600 hover:text-blue-700">
                            Choose File
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleDocumentUpload}
                            data-document-type={doc.type}
                            accept=".pdf,.jpg,.jpeg,.png"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Uploaded Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  {documents && documents.length > 0 ? (
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium">{doc.file_name}</p>
                              <p className="text-sm text-gray-500">
                                {doc.document_type} • {(doc.file_size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={doc.is_verified ? 'success' : 'warning'}>
                              {doc.is_verified ? 'Verified' : 'Pending'}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(doc.file_path, '_blank')}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-8">
                      No documents uploaded yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}