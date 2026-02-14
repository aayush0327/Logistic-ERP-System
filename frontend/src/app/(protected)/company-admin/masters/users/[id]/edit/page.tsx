"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  ArrowLeft,
  Save,
  X,
  User,
  Mail,
  Shield,
  Building,
  Phone,
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  GitBranch,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  useGetUserQuery,
  useUpdateUserMutation,
  useGetBranchesQuery,
  useChangeUserPasswordMutation,
} from "@/services/api/companyApi";
import { UserUpdate, Branch } from "@/services/api/companyApi";

const userUpdateSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  first_name: z.string().min(1, "First name is required").optional(),
  last_name: z.string().min(1, "Last name is required").optional(),
  phone_number: z.string().optional(),
  branch_ids: z.array(z.string()).min(1, "At least one branch is required").optional(),
  is_active: z.boolean().optional(),
});

type UserUpdateFormData = z.infer<typeof userUpdateSchema>;

// Password change schema
const passwordChangeSchema = z.object({
  new_password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string().min(1, "Please confirm the password"),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  // Local state for branch selection to avoid read-only array issues
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  // Fetch user data
  const { data: user, isLoading } = useGetUserQuery(userId, {
    skip: !userId,
  });

  // Fetch branches
  const { data: branchesData } = useGetBranchesQuery({
    page: 1,
    per_page: 100,
  });

  // Mutations
  const [updateUser] = useUpdateUserMutation();
  const [changeUserPassword] = useChangeUserPasswordMutation();

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors, isValid: isPasswordValid },
    reset: resetPassword,
    watch: watchPassword,
  } = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      new_password: "",
      confirm_password: "",
    },
  });

  const branches = branchesData?.items || [];

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    reset,
    setValue,
  } = useForm<UserUpdateFormData>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      email: "",
      first_name: "",
      last_name: "",
      phone_number: "",
      branch_ids: [],
      is_active: true,
    },
  });

  // Handle multi-select for branches using local state
  const handleBranchChange = (branchId: string) => {
    const currentIds = [...selectedBranchIds];
    if (currentIds.includes(branchId)) {
      // Remove branch if already selected
      const newIds = currentIds.filter((id) => id !== branchId);
      setSelectedBranchIds(newIds);
      setValue("branch_ids", newIds, { shouldDirty: true });
    } else {
      // Add branch
      const newIds = [...currentIds, branchId];
      setSelectedBranchIds(newIds);
      setValue("branch_ids", newIds, { shouldDirty: true });
    }
  };

  // Reset form when user data is loaded
  useEffect(() => {
    if (user) {
      // Create new array to avoid frozen array from API response
      const branchIds = [...(user.branch_ids || user.branches?.map((b) => b.id) || [])];
      setSelectedBranchIds(branchIds);
      reset({
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone || "",
        branch_ids: branchIds,
        is_active: user.is_active,
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: UserUpdateFormData) => {
    setIsSubmitting(true);
    try {
      // Only send fields that have changed
      const updateData: Partial<UserUpdate> = {};
      if (data.email !== user?.email) updateData.email = data.email;
      if (data.first_name !== user?.first_name)
        updateData.first_name = data.first_name;
      if (data.last_name !== user?.last_name)
        updateData.last_name = data.last_name;
      if (data.phone_number !== user?.phone_number)
        updateData.phone_number = data.phone_number;

      // Compare branch_ids arrays - create copies before sorting to avoid mutating frozen arrays
      const currentBranchIds = [...(user?.branch_ids || user?.branches?.map((b) => b.id) || [])];
      const formBranchIds = data.branch_ids ? [...data.branch_ids] : [];
      if (JSON.stringify(formBranchIds.sort()) !== JSON.stringify([...currentBranchIds].sort())) {
        updateData.branch_ids = data.branch_ids;
      }

      if (data.is_active !== user?.is_active)
        updateData.is_active = data.is_active;

      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        await updateUser({ id: userId, user: updateData }).unwrap();
        toast.success("User updated successfully");
      } else {
        toast.success("No changes to update");
      }

      router.push(`/company-admin/masters/users/${userId}`);
    } catch (error: any) {
      console.error("User update error:", error);
      toast.error(
        error?.data?.detail || error?.message || "Failed to update user"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPasswordChange = async (data: PasswordChangeFormData) => {
    setIsChangingPassword(true);
    try {
      await changeUserPassword({
        id: userId,
        new_password: data.new_password,
      }).unwrap();
      toast.success("Password changed successfully");
      resetPassword();
      setShowPasswordFields(false);
    } catch (error: any) {
      console.error("Password change error:", error);
      toast.error(
        error?.data?.detail || error?.message || "Failed to change password"
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            User not found
          </h2>
          <p className="text-gray-500 mb-4">
            The user you're looking for doesn't exist.
          </p>
          <Button onClick={() => router.push("/company-admin/masters/users")}>
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
            <h1 className="text-3xl font-bold text-gray-900">Edit User</h1>
            <p className="text-gray-500">
              Update information for {user.first_name} {user.last_name}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  {...register("first_name")}
                  placeholder="e.g., John"
                  className={errors.first_name ? "border-red-500" : ""}
                />
                {errors.first_name && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.first_name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  {...register("last_name")}
                  placeholder="e.g., Doe"
                  className={errors.last_name ? "border-red-500" : ""}
                />
                {errors.last_name && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.last_name.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="e.g., john.doe@company.com"
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                {...register("phone_number")}
                placeholder="e.g., +91 9876543210"
                className={errors.phone_number ? "border-red-500" : ""}
              />
              {errors.phone_number && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.phone_number.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="branch_ids">Assigned Branches *</Label>
              <p className="text-xs text-gray-500 mb-2">
                Select one or more branches for this user
              </p>

              {/* Selected Branches as Badges */}
              {selectedBranchIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
                  {selectedBranchIds.map((branchId) => {
                    const branch = branches.find((b) => b.id === branchId);
                    return branch ? (
                      <span
                        key={branch.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                      >
                        <GitBranch className="w-3 h-3" />
                        {branch.name}
                        <button
                          type="button"
                          onClick={() => handleBranchChange(branch.id)}
                          className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {/* Dropdown for branch selection */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="text-gray-700">
                    {branchDropdownOpen ? "Hide branches" : "Show branches"}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-500 transition-transform ${
                      branchDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {branchDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {branches.map((branch) => {
                      const isSelected = selectedBranchIds.includes(branch.id);
                      return (
                        <label
                          key={branch.id}
                          className={`flex items-center text-black space-x-3 p-2 cursor-pointer hover:bg-gray-50 ${
                            isSelected ? "bg-blue-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleBranchChange(branch.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="flex-1">{branch.name}</span>
                          <span className="text-xs text-gray-500">
                            {branch.code}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedBranchIds.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Please select at least one branch
                </p>
              )}
              {errors.branch_ids && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.branch_ids.message}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Users can be assigned to multiple branches for cross-branch
                operations
              </p>
            </div>

            <div>
              <Label>Profile Type</Label>
              <p className="text-sm text-gray-600 capitalize mt-1">
                {user.profile_type} (Cannot be modified)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Status Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Status Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                {...register("is_active")}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="text-sm">
                User is active
              </Label>
            </div>

            <div className="text-sm text-gray-600">
              <p>
                Profile Type:{" "}
                <span className="font-medium capitalize">
                  {user.profile_type}
                </span>
              </p>
              <p>
                Superuser:{" "}
                <span className="font-medium">
                  {user.is_superuser ? "Yes" : "No"}
                </span>
              </p>
              <p>
                User ID: <span className="font-medium">{user.id}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(`/company-admin/masters/users/${userId}`)
            }
            disabled={isSubmitting}
            className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isValid || !isDirty || isSubmitting}
            className="min-w-[120px] bg-[#1F40AE] hover:bg-[#203BA0] active:bg-[#192F80] text-white px-4 py-2 rounded-lg font-medium"
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Updating...
              </div>
            ) : (
              <div className="flex items-center">
                <Save className="w-4 h-4 mr-2" />
                Update User
              </div>
            )}
          </Button>
        </div>
      </form>

      {/* Password Change Form - Separate from main user form */}
      <form onSubmit={handlePasswordSubmit(onPasswordChange)} className="space-y-6">
        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Key className="w-5 h-5 mr-2" />
                Change Password
              </div>
              {!showPasswordFields && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordFields(true)}
                  className="text-sm"
                >
                  Change Password
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showPasswordFields ? (
              <p className="text-sm text-gray-600">
                Click "Change Password" to update this user's password.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new_password">New Password *</Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                      type={showNewPassword ? "text" : "password"}
                        {...registerPassword("new_password")}
                        placeholder="Enter new password"
                        className={passwordErrors.new_password ? "border-red-500 pr-10" : "pr-10"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.new_password && (
                      <p className="text-sm text-red-600 mt-1">
                        {passwordErrors.new_password.message}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Must be at least 8 characters long
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="confirm_password">Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                        {...registerPassword("confirm_password")}
                        placeholder="Confirm new password"
                        className={passwordErrors.confirm_password ? "border-red-500 pr-10" : "pr-10"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.confirm_password && (
                      <p className="text-sm text-red-600 mt-1">
                        {passwordErrors.confirm_password.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordFields(false);
                      resetPassword();
                    }}
                    disabled={isChangingPassword}
                    className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isPasswordValid || isChangingPassword}
                    className="bg-[#1F40AE] hover:bg-[#203BA0] active:bg-[#192F80] text-white px-4 py-2 rounded-lg font-medium"
                  >
                    {isChangingPassword ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Updating...
                      </div>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
