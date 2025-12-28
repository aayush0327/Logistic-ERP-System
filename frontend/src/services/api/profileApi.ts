import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './baseApi'
import { User, UserProfile, BranchManagerProfile, Address, BankDetails, DrivingLicense } from './companyApi'

// Extended Profile Types
export interface EmployeeProfile extends UserProfile {
  user?: User
  profile_completion_percentage?: number
  missing_sections?: string[]
}

export interface DriverProfile {
  id?: string
  user_id: string
  employee_profile_id?: string
  tenant_id?: string
  license_number?: string
  license_type?: string  // Backend returns single string, not array
  license_issue_date?: string
  license_expiry?: string  // Backend returns license_expiry, not license_expiry_date
  license_issuing_authority?: string
  badge_number?: string
  badge_expiry?: string  // Backend returns badge_expiry, not badge_expiry_date
  preferred_vehicle_types?: string[]  // Backend returns preferred_vehicle_types, not vehicle_preferences
  preferred_routes?: string[]
  experience_years?: number
  current_status?: string
  last_trip_date?: string
  total_trips?: number
  total_distance?: number
  average_rating?: number
  accident_count?: number
  traffic_violations?: number
  medical_fitness_certificate_date?: string
  police_verification_date?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
  employee?: EmployeeProfile
  user?: User
}

export interface BranchManagerProfileExtended extends BranchManagerProfile {
  user?: User
  employee_profile?: EmployeeProfile
}

export interface FinanceManagerProfile {
  id?: string
  user_id: string
  employee_profile_id?: string
  can_approve_payments?: boolean
  max_approval_limit?: number
  managed_branches?: string[]
  access_levels?: {
    can_view_all_branches?: boolean
    can_access_bank_accounts?: boolean
    can_handle_tax_compliance?: boolean
    can_audit_transactions?: boolean
    can_manage_payroll?: boolean
    can_view_financial_reports?: boolean
    can_create_invoices?: boolean
    can_manage_expenses?: boolean
  }
  created_at?: string
  updated_at?: string
  user?: User
  employee_profile?: EmployeeProfile
}

export interface LogisticsManagerProfile {
  id?: string
  user_id: string
  employee_profile_id?: string
  managed_zones?: string[]
  can_assign_drivers?: boolean
  can_approve_overtime?: boolean
  can_plan_routes?: boolean
  vehicle_management_permissions?: {
    can_dispatch_vehicles?: boolean
    can_manage_drivers?: boolean
    can_track_shipments?: boolean
    can_handle_emergency_dispatch?: boolean
    can_maintain_vehicles?: boolean
    can_purchase_vehicles?: boolean
    can_sell_vehicles?: boolean
    can_monitor_fuel?: boolean
  }
  created_at?: string
  updated_at?: string
  user?: User
  employee_profile?: EmployeeProfile
}

// Form Types for different profiles
export interface EmployeeProfileForm {
  employee_id?: string
  department?: string
  designation?: string
  date_of_joining?: string
  reporting_manager_id?: string
  emergency_contact_name?: string
  emergency_contact_number?: string
  blood_group?: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other'
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed'
  nationality?: string
  aadhar_number?: string
  pan_number?: string
  passport_number?: string
  current_address?: Address
  permanent_address?: Address
  bank_details?: BankDetails
}

export interface DriverProfileForm {
  license_number: string
  license_types: string[]
  license_issue_date: string
  license_expiry_date: string
  license_issuing_authority: string
  badge_number?: string
  badge_expiry_date?: string
  vehicle_preferences?: string[]
  preferred_routes?: string[]
  experience_years?: number
}

export interface BranchManagerProfileForm {
  managed_branch_id?: string
  can_create_quotes?: boolean
  can_approve_discounts?: boolean
  max_discount_percentage?: number
  can_manage_inventory?: boolean
  can_manage_vehicles?: boolean
  staff_management_permissions?: {
    hire?: boolean
    terminate?: boolean
    approve_leave?: boolean
    schedule_shifts?: boolean
    performance_reviews?: boolean
    salary_adjustments?: boolean
  }
}

export interface FinanceManagerProfileForm {
  can_approve_payments?: boolean
  max_approval_amount?: number
  can_manage_payroll?: boolean
  can_view_financial_reports?: boolean
  can_create_invoices?: boolean
  can_manage_expenses?: boolean
  access_levels?: {
    can_view_all_branches?: boolean
    can_access_bank_accounts?: boolean
    can_handle_tax_compliance?: boolean
    can_audit_transactions?: boolean
  }
}

export interface LogisticsManagerProfileForm {
  managed_zones?: string[]
  can_assign_drivers?: boolean
  can_approve_overtime?: boolean
  can_plan_routes?: boolean
  vehicle_management_permissions?: {
    can_dispatch_vehicles?: boolean
    can_manage_drivers?: boolean
    can_track_shipments?: boolean
    can_handle_emergency_dispatch?: boolean
    can_maintain_vehicles?: boolean
    can_purchase_vehicles?: boolean
    can_sell_vehicles?: boolean
    can_monitor_fuel?: boolean
  }
}

// API response types
export interface ProfileCompletion {
  completion_percentage: number
  completed_sections: string[]
  missing_sections: string[]
  total_sections: number
  is_complete: boolean
}

export interface UserWithProfile extends User {
  profile_completion?: ProfileCompletion
}

export interface RoleData {
  role_id: string
  role_name: string
  role_display_name: string
  users: UserWithProfile[]
  total_count: number
  active_count: number
  inactive_count: number
}

export interface ProfilesByRoleResponse {
  roles: RoleData[]
  total_users: number
  total_active: number
  total_inactive: number
  completion_stats: {
    total_profiles: number
    fully_complete: number
    partially_complete: number
    not_started: number
    average_completion_percentage: number
  }
  generated_at: string
}

export interface ProfileStatsResponse {
  total_profiles: number
  active_profiles: number
  inactive_profiles: number
  profiles_by_type: {
    employee: number
    driver: number
    finance_manager: number
    branch_manager: number
    logistics_manager: number
  }
  profiles_by_branch: {
    branch_id: string
    branch_name: string
    total_profiles: number
    fully_complete: number
    partially_complete: number
    not_started: number
    average_completion: number
  }[]
  completion_metrics: {
    total_profiles: number
    fully_complete: number
    partially_complete: number
    not_started: number
    average_completion_percentage: number
  }
}

export const profileApi = createApi({
  reducerPath: 'profileApi',
  baseQuery: baseQuery,
  tagTypes: ['EmployeeProfile', 'DriverProfile', 'BranchManagerProfile', 'FinanceManagerProfile', 'LogisticsManagerProfile', 'ProfileStats'],
  endpoints: (builder) => ({
    // Get all profiles grouped by roles
    getProfilesByRole: builder.query<ProfilesByRoleResponse, { include_inactive?: boolean; include_completion_stats?: boolean }>({
      query: ({ include_inactive = false, include_completion_stats = true }) => {
        const params = new URLSearchParams()
        params.append('include_inactive', include_inactive.toString())
        params.append('include_completion_stats', include_completion_stats.toString())
        return `company/profiles/by-role?${params}`
      },
      providesTags: ['ProfileStats'],
    }),

    // Get profile statistics
    getProfileStats: builder.query<ProfileStatsResponse, void>({
      query: () => 'company/profiles/stats',
      providesTags: ['ProfileStats'],
    }),

    // Employee Profile endpoints
    getEmployeeProfile: builder.query<EmployeeProfile, string>({
      query: (userId) => `company/users/${userId}`,
      providesTags: ['EmployeeProfile'],
    }),
    createEmployeeProfile: builder.mutation<EmployeeProfile, { userId: string; profile: EmployeeProfileForm }>({
      query: ({ userId, profile }) => ({
        url: `company/users/${userId}`,
        method: 'PUT',  // Using PUT to update/create user with profile data
        body: profile,
      }),
      invalidatesTags: ['EmployeeProfile', 'ProfileStats'],
    }),
    updateEmployeeProfile: builder.mutation<EmployeeProfile, { userId: string; profile: Partial<EmployeeProfileForm> }>({
      query: ({ userId, profile }) => ({
        url: `company/users/${userId}`,
        method: 'PUT',
        body: profile,
      }),
      invalidatesTags: ['EmployeeProfile', 'ProfileStats'],
    }),
    deleteEmployeeProfile: builder.mutation<void, string>({
      query: (userId) => ({
        url: `company/users/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['EmployeeProfile', 'ProfileStats'],
    }),

    // Driver Profile endpoints
    getDriverProfile: builder.query<DriverProfile, string>({
      query: (driverId) => `company/profiles/drivers/${driverId}`,
      providesTags: ['DriverProfile'],
    }),
    getDriverProfileByUser: builder.query<DriverProfile, string>({
      query: (userId) => `company/profiles/drivers/by-user/${userId}`,
      providesTags: ['DriverProfile'],
    }),
    createDriverProfile: builder.mutation<DriverProfile, { userId: string; profile: DriverProfileForm }>({
      query: ({ userId, profile }) => ({
        url: `company/profiles/drivers`,
        method: 'POST',
        body: { employee_profile_id: userId, ...profile },
      }),
      invalidatesTags: ['DriverProfile', 'ProfileStats'],
    }),
    updateDriverProfile: builder.mutation<DriverProfile, { driverId: string; profile: Partial<DriverProfileForm> }>({
      query: ({ driverId, profile }) => ({
        url: `company/profiles/drivers/${driverId}`,
        method: 'PUT',
        body: profile,
      }),
      invalidatesTags: ['DriverProfile', 'ProfileStats'],
    }),
    deleteDriverProfile: builder.mutation<void, string>({
      query: (driverId) => ({
        url: `company/profiles/drivers/${driverId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['DriverProfile', 'ProfileStats'],
    }),

    // Branch Manager Profile endpoints
    getBranchManagerProfile: builder.query<BranchManagerProfileExtended, string>({
      query: (userId) => `company/profiles/branch-managers/${userId}`,
      providesTags: ['BranchManagerProfile'],
    }),
    getBranchManagerProfileByUser: builder.query<BranchManagerProfileExtended, string>({
      query: (userId) => `company/profiles/branch-managers/by-user/${userId}`,
      providesTags: ['BranchManagerProfile'],
    }),
    createBranchManagerProfile: builder.mutation<BranchManagerProfileExtended, { userId: string; profile: BranchManagerProfileForm }>({
      query: ({ userId, profile }) => ({
        url: `company/profiles/branch-managers`,
        method: 'POST',
        body: { employee_profile_id: userId, ...profile },
      }),
      invalidatesTags: ['BranchManagerProfile', 'ProfileStats'],
    }),
    updateBranchManagerProfile: builder.mutation<BranchManagerProfileExtended, { profileId: string; profile: Partial<BranchManagerProfileForm> }>({
      query: ({ profileId, profile }) => ({
        url: `company/profiles/branch-managers/${profileId}`,
        method: 'PUT',
        body: profile,
      }),
      invalidatesTags: ['BranchManagerProfile', 'ProfileStats'],
    }),
    deleteBranchManagerProfile: builder.mutation<void, string>({
      query: (profileId) => ({
        url: `company/profiles/branch-managers/${profileId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['BranchManagerProfile', 'ProfileStats'],
    }),

    // Finance Manager Profile endpoints
    getFinanceManagerProfile: builder.query<FinanceManagerProfile, string>({
      query: (userId) => `company/profiles/finance-managers/${userId}`,
      providesTags: ['FinanceManagerProfile'],
    }),
    getFinanceManagerProfileByUser: builder.query<FinanceManagerProfile, string>({
      query: (userId) => `company/profiles/finance-managers/by-user/${userId}`,
      providesTags: ['FinanceManagerProfile'],
    }),
    createFinanceManagerProfile: builder.mutation<FinanceManagerProfile, { userId: string; profile: FinanceManagerProfileForm }>({
      query: ({ userId, profile }) => ({
        url: `company/profiles/finance-managers`,
        method: 'POST',
        body: { employee_profile_id: userId, ...profile },
      }),
      invalidatesTags: ['FinanceManagerProfile', 'ProfileStats'],
    }),
    updateFinanceManagerProfile: builder.mutation<FinanceManagerProfile, { profileId: string; profile: Partial<FinanceManagerProfileForm> }>({
      query: ({ profileId, profile }) => ({
        url: `company/profiles/finance-managers/${profileId}`,
        method: 'PUT',
        body: profile,
      }),
      invalidatesTags: ['FinanceManagerProfile', 'ProfileStats'],
    }),
    deleteFinanceManagerProfile: builder.mutation<void, string>({
      query: (profileId) => ({
        url: `company/profiles/finance-managers/${profileId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['FinanceManagerProfile', 'ProfileStats'],
    }),

    // Logistics Manager Profile endpoints
    getLogisticsManagerProfile: builder.query<LogisticsManagerProfile, string>({
      query: (userId) => `company/profiles/logistics-managers/${userId}`,
      providesTags: ['LogisticsManagerProfile'],
    }),
    getLogisticsManagerProfileByUser: builder.query<LogisticsManagerProfile, string>({
      query: (userId) => `company/profiles/logistics-managers/by-user/${userId}`,
      providesTags: ['LogisticsManagerProfile'],
    }),
    createLogisticsManagerProfile: builder.mutation<LogisticsManagerProfile, { userId: string; profile: LogisticsManagerProfileForm }>({
      query: ({ userId, profile }) => ({
        url: `company/profiles/logistics-managers`,
        method: 'POST',
        body: { employee_profile_id: userId, ...profile },
      }),
      invalidatesTags: ['LogisticsManagerProfile', 'ProfileStats'],
    }),
    updateLogisticsManagerProfile: builder.mutation<LogisticsManagerProfile, { profileId: string; profile: Partial<LogisticsManagerProfileForm> }>({
      query: ({ profileId, profile }) => ({
        url: `company/profiles/logistics-managers/${profileId}`,
        method: 'PUT',
        body: profile,
      }),
      invalidatesTags: ['LogisticsManagerProfile', 'ProfileStats'],
    }),
    deleteLogisticsManagerProfile: builder.mutation<void, string>({
      query: (profileId) => ({
        url: `company/profiles/logistics-managers/${profileId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['LogisticsManagerProfile', 'ProfileStats'],
    }),

    // Bulk operations
    bulkCreateProfiles: builder.mutation<any, { profiles: Array<{ userId: string; profileType: string; profileData: any }> }>({
      query: ({ profiles }) => ({
        url: 'company/profiles/bulk-create',
        method: 'POST',
        body: { profiles },
      }),
      invalidatesTags: ['EmployeeProfile', 'DriverProfile', 'BranchManagerProfile', 'FinanceManagerProfile', 'LogisticsManagerProfile', 'ProfileStats'],
    }),

    // Export profiles
    exportProfiles: builder.mutation<Blob, {
      role_id?: number;
      profile_type?: string;
      completion_status?: 'completed' | 'in_progress' | 'not_started';
      format?: 'csv' | 'excel';
    }>({
      query: ({ role_id, profile_type, completion_status, format = 'excel' }) => {
        const params = new URLSearchParams()
        if (role_id) params.append('role_id', role_id.toString())
        if (profile_type) params.append('profile_type', profile_type)
        if (completion_status) params.append('completion_status', completion_status)
        params.append('format', format)
        return {
          url: `company/profiles/export?${params}`,
          method: 'GET',
          responseHandler: (response) => response.blob(),
        }
      },
    }),
  }),
})

// Export hooks
export const {
  useGetProfilesByRoleQuery,
  useGetProfileStatsQuery,
  // Employee Profile hooks
  useGetEmployeeProfileQuery,
  useCreateEmployeeProfileMutation,
  useUpdateEmployeeProfileMutation,
  useDeleteEmployeeProfileMutation,
  // Driver Profile hooks
  useGetDriverProfileQuery,
  useGetDriverProfileByUserQuery,
  useCreateDriverProfileMutation,
  useUpdateDriverProfileMutation,
  useDeleteDriverProfileMutation,
  // Branch Manager Profile hooks
  useGetBranchManagerProfileQuery,
  useGetBranchManagerProfileByUserQuery,
  useCreateBranchManagerProfileMutation,
  useUpdateBranchManagerProfileMutation,
  useDeleteBranchManagerProfileMutation,
  // Finance Manager Profile hooks
  useGetFinanceManagerProfileQuery,
  useGetFinanceManagerProfileByUserQuery,
  useCreateFinanceManagerProfileMutation,
  useUpdateFinanceManagerProfileMutation,
  useDeleteFinanceManagerProfileMutation,
  // Logistics Manager Profile hooks
  useGetLogisticsManagerProfileQuery,
  useGetLogisticsManagerProfileByUserQuery,
  useCreateLogisticsManagerProfileMutation,
  useUpdateLogisticsManagerProfileMutation,
  useDeleteLogisticsManagerProfileMutation,
  // Bulk operations
  useBulkCreateProfilesMutation,
  useExportProfilesMutation,
} = profileApi