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
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  useGetUserQuery,
  useUpdateUserMutation,
  useGetBranchesQuery,
  useGetRolesQuery,
  useChangeUserPasswordMutation,
} from "@/services/api/companyApi";
import { UserUpdate, Role, Branch } from "@/services/api/companyApi";

const userUpdateSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  first_name: z.string().min(1, "First name is required").optional(),
  last_name: z.string().min(1, "Last name is required").optional(),
  phone_number: z.string().optional(),
  role_id: z.number().min(1, "Role is required").optional(),
  branch_id: z.string().optional(),
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

  // Fetch user data
  const { data: user, isLoading } = useGetUserQuery(userId, {
    skip: !userId,
  });

  // Fetch branches and roles
  const { data: branchesData } = useGetBranchesQuery({
    page: 1,
    per_page: 100,
  });
  const { data: roles } = useGetRolesQuery({});

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
    watch,
    setValue,
  } = useForm<UserUpdateFormData>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      email: "",
      first_name: "",
      last_name: "",
      phone_number: "",
      role_id: 0,
      branch_id: "",
      is_active: true,
    },
  });

  // Reset form when user data is loaded
  useEffect(() => {
    if (user) {
      reset({
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number || "",
        role_id:
          typeof user.role_id === "number"
            ? user.role_id
            : user.role_id
            ? parseInt(user.role_id)
            : 0,
        branch_id: user.branch_id || "",
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
      if (data.role_id !== user?.role_id) updateData.role_id = data.role_id;
      if (data.branch_id !== user?.branch_id)
        updateData.branch_id = data.branch_id || undefined;
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role_id">Role *</Label>
                <select
                  id="role_id"
                  {...register("role_id", { valueAsNumber: true })}
                  className={`w-full px-3 text-black py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.role_id ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  <option value="0">Select Role</option>
                  {roles?.items?.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
                {errors.role_id && (
                  <p className="text-sm text-red-600 mt-1">Role is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="branch_id">Assigned Branch</Label>
                <select
                  id="branch_id"
                  {...register("branch_id")}
                  className="w-full text-black px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Branch (Optional)</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {errors.branch_id && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.branch_id.message}
                  </p>
                )}
              </div>
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
