"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  ArrowLeft,
  Save,
  X,
  User,
  Mail,
  Shield,
  Building,
  Phone,
  Users,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  useCreateUserMutation,
  useGetBranchesQuery,
  useGetRolesQuery,
} from "@/services/api/companyApi";
import { useCreateAuthUserMutation } from "@/services/api/authApi";
import { UserCreate, Role, Branch } from "@/services/api/companyApi";

const userCreateSchema = z.object({
  email: z.string().email("Invalid email address"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone_number: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  profile_type: z.enum(["staff", "driver", "admin"]),
  role_id: z.string().min(1, "Role is required"),
  branch_id: z.string().optional(),
  branch_ids: z.array(z.string()).optional(),
  is_active: z.boolean(),
  send_invitation: z.boolean(),
});

type UserCreateFormData = z.infer<typeof userCreateSchema>;

export default function NewUserPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch branches and roles
  const { data: branchesData } = useGetBranchesQuery({
    page: 1,
    per_page: 100,
  });
  const { data: rolesData } = useGetRolesQuery({});

  // Mutations
  const [createUser] = useCreateUserMutation();
  const [createAuthUser] = useCreateAuthUserMutation();

  const branches = branchesData?.items || [];
  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.items || [];

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
  } = useForm<UserCreateFormData>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      email: "",
      first_name: "",
      last_name: "",
      phone_number: "",
      password: "",
      profile_type: "staff",
      role_id: "", // Will be set when roles are loaded
      branch_id: "",
      branch_ids: [],
      is_active: true,
      send_invitation: true,
    },
  });

  const selectedProfileType = watch("profile_type");
  const selectedRoleId = watch("role_id");
  const selectedBranchId = watch("branch_id");
  const selectedBranchIds = watch("branch_ids") || [];

  // Handle multi-select for branches
  const handleBranchChange = (branchId: string) => {
    const currentIds = selectedBranchIds || [];
    if (currentIds.includes(branchId)) {
      // Remove branch if already selected
      setValue("branch_ids", currentIds.filter((id) => id !== branchId));
    } else {
      // Add branch
      setValue("branch_ids", [...currentIds, branchId]);
    }
  };

  // Debug: Log form validation state
  useEffect(() => {
    console.log("Form errors:", errors);
    console.log("Form isValid:", isValid);
    console.log("selectedRoleId:", selectedRoleId);
    console.log("Form values:", watch());
  }, [errors, isValid, selectedRoleId, watch]);

  // Auto-select first role when roles are loaded
  useEffect(() => {
    if (roles && !selectedRoleId && roles.length > 0) {
      console.log("Auto-selecting first role:", roles[0]);
      setValue("role_id", roles[0].id);
    }
  }, [roles, selectedRoleId, setValue]);

  // Handle profile type change
  const handleProfileTypeChange = (profileType: string) => {
    setValue("profile_type", profileType as any);
    console.log("Profile type changed to:", profileType);
    // Role selection is now manual - user can choose any role regardless of profile type
  };

  const onSubmit = async (data: UserCreateFormData) => {
    setIsSubmitting(true);
    try {
      // Step 1: Create auth user
      const authUserData = {
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        // role_id will be set to default "User" role by the auth service
        // tenant_id will be set by the auth service from the token
      };

      const authUser = await createAuthUser(authUserData).unwrap();

      // Step 2: Create employee profile
      const profileData = {
        user_id: authUser.id, // Use the auth user ID
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone_number,
        profile_type: data.profile_type,
        role_id: data.role_id,
        branch_id: data.branch_id || undefined,
        branch_ids: data.branch_ids && data.branch_ids.length > 0 ? data.branch_ids : undefined,
        is_active: data.is_active,
        // The auth service handles the password
      };

      await createUser(profileData).unwrap();

      toast.success("User created successfully");
      router.push("/masters/users");
    } catch (error: any) {
      console.error("User creation error:", error);

      // Handle validation errors
      if (error?.data?.detail) {
        if (Array.isArray(error.data.detail)) {
          // Handle FastAPI validation errors
          const errorMessages = error.data.detail
            .map((err: any) => `${err.loc?.join(".")} ${err.msg}`)
            .join(", ");
          toast.error(`Validation error: ${errorMessages}`);
        } else if (typeof error.data.detail === "object") {
          // Handle object error
          const errorMsg = JSON.stringify(error.data.detail);
          toast.error(`Validation error: ${errorMsg}`);
        } else {
          // Handle string error
          toast.error(error.data.detail);
        }
      } else if (error?.status) {
        // Handle HTTP status errors
        toast.error(
          `Error ${error.status}: ${
            error.statusText || "Failed to create user"
          }`
        );
      } else {
        // Handle other errors
        const errorMessage =
          error?.error || error?.message || "Failed to create user";
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto inline space-y-6">
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
              <h1 className="text-3xl font-bold text-gray-900">New User</h1>
              <p className="text-gray-500">Add a new user to your system</p>
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
                <Label htmlFor="email">Email Address *</Label>
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
                  <Label htmlFor="profile_type">Profile Type *</Label>
                  <select
                    id="profile_type"
                    {...register("profile_type")}
                    onChange={(e) => handleProfileTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="staff">Staff</option>
                    <option value="driver">Driver</option>
                    <option value="admin">Admin</option>
                  </select>
                  {errors.profile_type && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.profile_type.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="role_id">Role *</Label>
                  <select
                    id="role_id"
                    {...register("role_id")}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.role_id ? "border-red-500" : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Role</option>
                    {roles?.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name || role.display_name || role.role_name}
                      </option>
                    ))}
                  </select>
                  {errors.role_id && (
                    <p className="text-sm text-red-600 mt-1">
                      Role is required
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="branch_id">Assigned Branches</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Optional: Select one or more branches for this user
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {branches.map((branch) => {
                    const isSelected = selectedBranchIds.includes(branch.id);
                    return (
                      <label
                        key={branch.id}
                        className={`flex items-center space-x-3 p-2 rounded cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50 border border-blue-200"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleBranchChange(branch.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="flex-1">{branch.name}</span>
                        <span className="text-xs text-gray-500">{branch.code}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedBranchIds.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    {selectedBranchIds.length} branch{selectedBranchIds.length > 1 ? "es" : ""} selected
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Users can be assigned to multiple branches for cross-branch operations
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Security Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  {...register("password")}
                  placeholder="Enter password"
                  className={errors.password ? "border-red-500" : ""}
                />
                {errors.password && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="send_invitation"
                  {...register("send_invitation")}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="send_invitation" className="text-sm">
                  Send invitation email to the user
                </Label>
              </div>

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
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating...
                </div>
              ) : (
                <div className="flex items-center">
                  <Save className="w-4 h-4 mr-2" />
                  Create User
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
