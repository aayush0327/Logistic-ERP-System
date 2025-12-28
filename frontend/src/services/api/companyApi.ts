import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './baseApi'
import { getProductCategoryResponse, getRoleAPIResponse } from '@/types/common'

// Types
export interface Branch {
  id: string
  tenant_id: string
  code: string
  name: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  phone?: string
  email?: string
  manager_id?: string
  is_active: boolean
  created_at: string
  updated_at?: string
  home_branch?: any
  customers?: any[]
  vehicles?: any[]
}

// User Management Types
export interface User {
  id: string
  tenant_id: string
  user_id?: string
  email: string
  first_name: string
  last_name: string
  phone_number?: string
  phone?: string
  profile_type: 'staff' | 'driver' | 'admin'
  role_id: number | string
  branch_id?: string // Deprecated: Use branch_ids for multiple branches
  branch_ids?: string[] // New: Multiple branch assignments
  is_active: boolean
  is_superuser: boolean
  last_login?: string
  created_at: string
  updated_at?: string
  role?: Role
  branch?: Branch
  branches?: Branch[] // New: All assigned branches
  profile?: UserProfile
  documents?: UserDocument[]

  // Employee profile fields (from backend EmployeeProfile)
  employee_code?: string
  employee_id?: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other'
  blood_group?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_number?: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  hire_date?: string
  date_of_joining?: string
  employment_type?: string
  department?: string
  designation?: string
  reports_to?: string
  salary?: number
  bank_account_number?: string
  bank_name?: string
  bank_ifsc?: string
  pan_number?: string
  aadhaar_number?: string
  aadhar_number?: string
  passport_number?: string
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed'
  nationality?: string
  reporting_manager_id?: string
  // Nested address objects
  current_address?: Address
  permanent_address?: Address
  // Nested bank details
  bank_details?: BankDetails
}

export interface Role {
  id: number
  name: string
  role_name?: string  // Alternative field name from auth service
  description?: string
  tenant_id: string
  permissions: Permission[]
  is_system_role: boolean
  created_at: string
  updated_at?: string
}

export interface Permission {
  id: number
  name: string
  resource: string
  action: string
  description?: string
}

export interface UserProfile {
  id: string
  user_id: string
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
  driving_license?: DrivingLicense
  branch_manager_profile?: BranchManagerProfile
  created_at: string
  updated_at?: string
}

export interface BranchManagerProfile {
  id?: string
  employee_profile_id?: string
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
  created_at?: string
  updated_at?: string
}

export interface Address {
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
}

export interface BankDetails {
  bank_name: string
  account_number: string
  ifsc_code: string
  branch_name: string
  account_type: 'savings' | 'current'
}

export interface DrivingLicense {
  license_number: string
  license_type: string[]
  issue_date: string
  expiry_date: string
  issuing_authority: string
}

export interface UserDocument {
  id: string
  user_id: string
  document_type: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  is_verified: boolean
  uploaded_at: string
  verified_at?: string
  verified_by?: string
}

export interface Customer {
  id: string
  tenant_id: string
  home_branch_id?: string
  code: string
  name: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  business_type?: string  // Deprecated - old enum
  business_type_id?: string  // New foreign key to business_types table
  credit_limit: number
  pricing_tier: string
  is_active: boolean
  created_at: string
  updated_at?: string
  home_branch?: Branch
  business_type_relation?: BusinessTypeModel
}

export interface Vehicle {
  id: string
  tenant_id: string
  branch_id?: string
  plate_number: string
  make?: string
  model?: string
  year?: number
  vehicle_type?: string
  vehicle_type_id?: string
  capacity_weight?: number
  capacity_volume?: number
  status: string
  last_maintenance?: string
  next_maintenance?: string
  is_active: boolean
  created_at: string
  updated_at?: string
  branch?: Branch
  vehicle_type_relation?: VehicleTypeModel
}

export interface ProductCategory {
  id: string
  tenant_id: string
  name: string
  description?: string
  parent_id?: string
  is_active: boolean
  created_at: string
  updated_at?: string
  parent?: ProductCategory
  children?: ProductCategory[]
}

export interface BusinessTypeModel {
  id: string
  tenant_id: string
  name: string
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at?: string
}

// Union type for business types API response (handles both array and paginated formats)
export type BusinessTypesListResponse = BusinessTypeModel[] | {
  items: BusinessTypeModel[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
};

export interface VehicleTypeModel {
  id: string
  tenant_id: string
  name: string
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface Product {
  id: string
  tenant_id: string
  category_id?: string
  code: string
  name: string
  description?: string
  unit_price: number
  special_price?: number
  // Weight configuration - supports fixed and variable weight types
  weight_type?: 'fixed' | 'variable'
  weight?: number  // Deprecated - use fixed_weight
  fixed_weight?: number  // For FIXED weight type
  weight_unit?: string  // Weight unit (kg, lb, g, etc.)
  length?: number
  width?: number
  height?: number
  volume?: number
  handling_requirements?: string[]
  min_stock_level: number
  max_stock_level?: number
  current_stock: number
  is_active: boolean
  created_at: string
  updated_at?: string
  category?: ProductCategory
  available_for_all_branches?:boolean
  branches?:object[]
}

export interface PricingRule {
  id: string
  tenant_id: string
  name: string
  service_type?: string
  zone_origin?: string
  zone_destination?: string
  base_price: number
  price_per_km: number
  price_per_kg: number
  fuel_surcharge_percent: number
  is_active: boolean
  created_at: string
  updated_at?: string
}

// Form Types
export interface BranchCreate {
  code: string
  name: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  phone?: string
  email?: string
  manager_id?: string
  is_active?: boolean
}

export interface CustomerCreate {
  home_branch_id?: string
  code: string
  name: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  postal_code?: string
  business_type?: string  // Deprecated - old enum
  business_type_id?: string  // New foreign key to business_types table
  credit_limit?: number
  pricing_tier?: string
  is_active?: boolean
}

export interface VehicleCreate {
  branch_id?: string
  plate_number: string
  make?: string
  model?: string
  year?: number
  vehicle_type?: string
  capacity_weight?: number
  capacity_volume?: number
  status?: string
  last_maintenance?: string
  next_maintenance?: string
  is_active?: boolean
}

export interface ProductCreate {
  category_id?: string
  code: string
  name: string
  description?: string
  unit_price: number
  special_price?: number
  // Weight configuration - supports fixed and variable weight types
  weight_type?: 'fixed' | 'variable'
  weight?: number  // Deprecated - use fixed_weight
  fixed_weight?: number  // For FIXED weight type
  weight_unit?: string  // Weight unit (kg, lb, g, etc.)
  length?: number
  width?: number
  height?: number
  volume?: number
  handling_requirements?: string[]
  min_stock_level?: number
  max_stock_level?: number
  current_stock?: number
  is_active?: boolean
  available_for_all_branches?:boolean
}

export interface ProductCategoryCreate {
  name: string
  description?: string
  parent_id?: string
  is_active?: boolean
}

export interface BusinessTypeModelCreate {
  name: string
  code: string
  description?: string
  is_active?: boolean
}

export interface VehicleTypeModelCreate {
  name: string
  code: string
  description?: string
  is_active?: boolean
}

export interface PricingRuleCreate {
  name: string
  service_type?: string
  zone_origin?: string
  zone_destination?: string
  base_price: number
  price_per_km?: number
  price_per_kg?: number
  fuel_surcharge_percent?: number
  is_active?: boolean
}

// User Management Form Types
export interface UserCreate {
  user_id: string  // Auth user ID
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  profile_type?: 'staff' | 'driver' | 'admin'
  role_id?: string
  branch_id?: string // Deprecated: Use branch_ids for multiple branches
  branch_ids?: string[] // New: Multiple branch assignments
  is_active?: boolean
  send_invitation?: boolean
}

export interface UserUpdate {
  email?: string
  first_name?: string
  last_name?: string
  phone_number?: string
  role_id?: number
  branch_id?: string
  is_active?: boolean
}

export interface UserInvitation {
  email: string
  first_name: string
  last_name: string
  role_id: number
  branch_id?: string
  message?: string
}

export interface RoleCreate {
  name: string
  description?: string
  permission_ids: number[]
}

export interface RoleUpdate {
  name?: string
  description?: string
  permission_ids?: number[]
}

// Auth service Role type (from roles table in auth database)
export interface AuthRole {
  id: number
  name: string
  description?: string
  is_system: boolean
  tenant_id: string
  created_at: string
  updated_at?: string
}

export interface UserProfileCreate {
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
  driving_license?: DrivingLicense
  branch_manager_profile?: BranchManagerProfile
}

export interface UserProfileUpdate {
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
  driving_license?: DrivingLicense
  branch_manager_profile?: BranchManagerProfile
}

// Create API slice using base query with auth
export const companyApi = createApi({
  reducerPath: 'companyApi',
  baseQuery: baseQuery,
  tagTypes: ['Branch', 'Customer', 'Vehicle', 'VehicleTypeModel', 'Product', 'ProductCategory', 'BusinessTypeModel', 'PricingRule', 'User', 'Role', 'UserProfile', 'UserDocument'],
  endpoints: (builder) => ({
    // Branch endpoints
    getBranches: builder.query<{ items: Branch[]; total: number; page: number; per_page: number; pages: number }, { page?: number; per_page?: number; search?: string; is_active?: boolean }>({
      query: ({ page = 1, per_page = 20, search, is_active }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        if (search) params.append('search', search)
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        return `company/branches?${params}`
      },
      providesTags: ['Branch'],
    }),
    getBranch: builder.query<Branch, string>({
      query: (id) => `company/branches/${id}`,
      providesTags: ['Branch'],
    }),
    createBranch: builder.mutation<Branch, BranchCreate>({
      query: (branch) => ({
        url: 'company/branches',
        method: 'POST',
        body: branch,
      }),
      invalidatesTags: ['Branch'],
    }),
    updateBranch: builder.mutation<Branch, { id: string; branch: Partial<BranchCreate> }>({
      query: ({ id, branch }) => ({
        url: `company/branches/${id}`,
        method: 'PUT',
        body: branch,
      }),
      invalidatesTags: ['Branch'],
    }),
    deleteBranch: builder.mutation<void, string>({
      query: (id) => ({
        url: `company/branches/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Branch'],
    }),
    getBranchMetrics: builder.query<any, string>({
      query: (id) => `company/branches/${id}/metrics`,
      providesTags: ['Branch'],
    }),

    // Customer endpoints
    getCustomers: builder.query<{ items: Customer[]; total: number; page: number; per_page: number; pages: number }, { page?: number; per_page?: number; search?: string; business_type?: string; home_branch_id?: string; is_active?: boolean }>({
      query: ({ page = 1, per_page = 20, search, business_type, home_branch_id, is_active }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        if (search) params.append('search', search)
        if (business_type) params.append('business_type', business_type)
        if (home_branch_id) params.append('home_branch_id', home_branch_id)
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        return `company/customers?${params}`
      },
      providesTags: ['Customer'],
    }),
    getCustomer: builder.query<Customer, string>({
      query: (id) => `company/customers/${id}`,
      providesTags: ['Customer'],
    }),
    createCustomer: builder.mutation<Customer, CustomerCreate>({
      query: (customer) => ({
        url: 'company/customers/',
        method: 'POST',
        body: customer,
      }),
      invalidatesTags: ['Customer'],
    }),
    updateCustomer: builder.mutation<Customer, { id: string; customer: Partial<CustomerCreate> }>({
      query: ({ id, customer }) => ({
        url: `company/customers/${id}`,
        method: 'PUT',
        body: customer,
      }),
      invalidatesTags: ['Customer'],
    }),
    deleteCustomer: builder.mutation<void, string>({
      query: (id) => ({
        url: `company/customers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Customer'],
    }),

    // Vehicle endpoints
    getVehicles: builder.query<{ items: Vehicle[]; total: number; page: number; per_page: number; pages: number }, { page?: number; per_page?: number; search?: string; vehicle_type?: string; vehicle_type_id?: string; status?: string; branch_id?: string; is_active?: boolean }>({
      query: ({ page = 1, per_page = 20, search, vehicle_type, vehicle_type_id, status, branch_id, is_active }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        if (search) params.append('search', search)
        if (vehicle_type) params.append('vehicle_type', vehicle_type)
        if (vehicle_type_id) params.append('vehicle_type_id', vehicle_type_id)
        if (status) params.append('status', status)
        if (branch_id) params.append('branch_id', branch_id)
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        return `company/vehicles?${params}`
      },
      providesTags: ['Vehicle'],
    }),
    getVehicle: builder.query<Vehicle, string>({
      query: (id) => `company/vehicles/${id}`,
      providesTags: ['Vehicle'],
    }),
    createVehicle: builder.mutation<Vehicle, VehicleCreate>({
      query: (vehicle) => ({
        url: 'company/vehicles/',
        method: 'POST',
        body: vehicle,
      }),
      invalidatesTags: ['Vehicle'],
    }),
    updateVehicle: builder.mutation<Vehicle, { id: string; vehicle: Partial<VehicleCreate> }>({
      query: ({ id, vehicle }) => ({
        url: `company/vehicles/${id}`,
        method: 'PUT',
        body: vehicle,
      }),
      invalidatesTags: ['Vehicle'],
    }),
    deleteVehicle: builder.mutation<void, string>({
      query: (id) => ({
        url: `company/vehicles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Vehicle'],
    }),
    updateVehicleStatus: builder.mutation<Vehicle, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `company/vehicles/${id}/status`,
        method: 'PUT',
        body: { status },
      }),
      invalidatesTags: ['Vehicle'],
    }),
    getAvailableVehicles: builder.query<Vehicle[], { page?: number; per_page?: number; vehicle_type?: string; branch_id?: string }>({
      query: ({ page = 1, per_page = 20, vehicle_type, branch_id }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        if (vehicle_type) params.append('vehicle_type', vehicle_type)
        if (branch_id) params.append('branch_id', branch_id)
        return `company/vehicles/available?${params}`
      },
      providesTags: ['Vehicle'],
    }),
    getVehicleStatusOptions: builder.query<string[], void>({
      query: () => 'company/vehicles/status-options',
      providesTags: ['Vehicle'],
    }),

    // Product Category endpoints
    getProductCategories: builder.query<getProductCategoryResponse, { page?: number; per_page?: number; search?: string; parent_id?: string; is_active?: boolean; include_children?: boolean }>({
      query: ({ page = 1, per_page = 20, search, parent_id, is_active, include_children = true }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        if (search) params.append('search', search)
        if (parent_id) params.append('parent_id', parent_id)
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        params.append('include_children', include_children.toString())
        return `company/product-categories?${params}`
      },
      providesTags: ['ProductCategory'],
    }),
    getProductCategoryTree: builder.query<ProductCategory[], void>({
      query: () => 'company/product-categories/tree',
      providesTags: ['ProductCategory'],
    }),
    getProductCategory: builder.query<ProductCategory, string>({
      query: (id) => `company/product-categories/${id}`,
      providesTags: ['ProductCategory'],
    }),
    createProductCategory: builder.mutation<ProductCategory, ProductCategoryCreate>({
      query: (category) => ({
        url: 'company/product-categories/',
        method: 'POST',
        body: category,
      }),
      invalidatesTags: ['ProductCategory'],
    }),
    updateProductCategory: builder.mutation<ProductCategory, { id: string; category: Partial<ProductCategoryCreate> }>({
      query: ({ id, category }) => ({
        url: `company/product-categories/${id}`,
        method: 'PUT',
        body: category,
      }),
      invalidatesTags: ['ProductCategory'],
    }),
    deleteProductCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `company/product-categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ProductCategory'],
    }),

    // BusinessType endpoints
    getBusinessTypes: builder.query<{ items: BusinessTypeModel[]; total: number; page: number; per_page: number; pages: number }, { page?: number; per_page?: number; search?: string; is_active?: boolean }>({
      query: ({ page = 1, per_page = 20, search, is_active }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        if (search) params.append('search', search)
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        return `company/business-types?${params}`
      },
      providesTags: ['BusinessTypeModel'],
    }),
    getAllBusinessTypes: builder.query<BusinessTypesListResponse, { is_active?: boolean }>({
      query: ({ is_active = true }) => {
        const params = new URLSearchParams()
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        return `company/business-types/all?${params}`
      },
      providesTags: ['BusinessTypeModel'],
    }),
    getBusinessType: builder.query<BusinessTypeModel, string>({
      query: (id) => `company/business-types/${id}`,
      providesTags: ['BusinessTypeModel'],
    }),
    createBusinessType: builder.mutation<BusinessTypeModel, BusinessTypeModelCreate>({
      query: (businessType) => ({
        url: 'company/business-types/',
        method: 'POST',
        body: businessType,
      }),
      invalidatesTags: ['BusinessTypeModel', 'Customer'],
    }),
    updateBusinessType: builder.mutation<BusinessTypeModel, { id: string; businessType: Partial<BusinessTypeModelCreate> }>({
      query: ({ id, businessType }) => ({
        url: `company/business-types/${id}`,
        method: 'PUT',
        body: businessType,
      }),
      invalidatesTags: ['BusinessTypeModel', 'Customer'],
    }),
    deleteBusinessType: builder.mutation<void, string>({
      query: (id) => ({
        url: `company/business-types/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['BusinessTypeModel', 'Customer'],
    }),

    // VehicleType endpoints
    getVehicleTypes: builder.query<{ items: VehicleTypeModel[]; total: number; page: number; per_page: number; pages: number }, { page?: number; per_page?: number; search?: string; is_active?: boolean }>({
      query: ({ page = 1, per_page = 20, search, is_active }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        if (search) params.append('search', search)
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        return `company/vehicle-types?${params}`
      },
      providesTags: ['VehicleTypeModel'],
    }),
    getAllVehicleTypes: builder.query<VehicleTypeModel[], { is_active?: boolean }>({
      query: ({ is_active = true }) => {
        const params = new URLSearchParams()
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        return `company/vehicle-types/all?${params}`
      },
      providesTags: ['VehicleTypeModel'],
    }),
    getVehicleType: builder.query<VehicleTypeModel, string>({
      query: (id) => `company/vehicle-types/${id}`,
      providesTags: ['VehicleTypeModel'],
    }),
    createVehicleType: builder.mutation<VehicleTypeModel, VehicleTypeModelCreate>({
      query: (vehicleType) => ({
        url: 'company/vehicle-types/',
        method: 'POST',
        body: vehicleType,
      }),
      invalidatesTags: ['VehicleTypeModel', 'Vehicle'],
    }),
    updateVehicleType: builder.mutation<VehicleTypeModel, { id: string; vehicleType: Partial<VehicleTypeModelCreate> }>({
      query: ({ id, vehicleType }) => ({
        url: `company/vehicle-types/${id}`,
        method: 'PUT',
        body: vehicleType,
      }),
      invalidatesTags: ['VehicleTypeModel', 'Vehicle'],
    }),
    deleteVehicleType: builder.mutation<void, string>({
      query: (id) => ({
        url: `company/vehicle-types/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['VehicleTypeModel', 'Vehicle'],
    }),

    // Product endpoints
    getProducts: builder.query<{ items: Product[]; total: number; page: number; per_page: number; pages: number }, { page?: number; per_page?: number;branch_id?: string; search?: string; category_id?: string; min_price?: number; max_price?: number; is_active?: boolean; low_stock?: boolean }>({
      query: ({ page = 1, per_page = 20, search, category_id, min_price, max_price, is_active, low_stock }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        if (search) params.append('search', search)
        if (category_id) params.append('category_id', category_id)
        if (min_price) params.append('min_price', min_price.toString())
        if (max_price) params.append('max_price', max_price.toString())
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        if (low_stock) params.append('low_stock', 'true')
        return `company/products?${params}`
      },
      providesTags: ['Product'],
    }),
    getProduct: builder.query<Product, string>({
      query: (id) => `company/products/${id}`,
      providesTags: ['Product'],
    }),
    createProduct: builder.mutation<Product, ProductCreate>({
      query: (product) => ({
        url: 'company/products/',
        method: 'POST',
        body: product,
      }),
      invalidatesTags: ['Product'],
    }),
    updateProduct: builder.mutation<Product, { id: string; product: Partial<ProductCreate> }>({
      query: ({ id, product }) => ({
        url: `company/products/${id}`,
        method: 'PUT',
        body: product,
      }),
      invalidatesTags: ['Product'],
    }),
    deleteProduct: builder.mutation<void, string>({
      query: (id) => ({
        url: `company/products/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Product'],
    }),
    getLowStockProducts: builder.query<{ items: Product[]; total: number; page: number; per_page: number; pages: number }, { page?: number; per_page?: number }>({
      query: ({ page = 1, per_page = 20 }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        return `company/products/low-stock?${params}`
      },
      providesTags: ['Product'],
    }),
    bulkUpdateProducts: builder.mutation<Product[], { updates: Array<{ id: string; [key: string]: any }> }>({
      query: (updates) => ({
        url: 'company/products/bulk-update',
        method: 'POST',
        body: updates,
      }),
      invalidatesTags: ['Product'],
    }),
    getProductStockHistory: builder.query<any, string>({
      query: (id) => `company/products/${id}/stock-history`,
      providesTags: ['Product'],
    }),

    // Pricing Rule endpoints
    getPricingRules: builder.query<PricingRule[], void>({
      query: () => 'company/pricing/rules',
      providesTags: ['PricingRule'],
    }),
    createPricingRule: builder.mutation<PricingRule, PricingRuleCreate>({
      query: (rule) => ({
        url: 'company/pricing/rules',
        method: 'POST',
        body: rule,
      }),
      invalidatesTags: ['PricingRule'],
    }),
    updatePricingRule: builder.mutation<PricingRule, { id: string; rule: Partial<PricingRuleCreate> }>({
      query: ({ id, rule }) => ({
        url: `company/pricing/rules/${id}`,
        method: 'PUT',
        body: rule,
      }),
      invalidatesTags: ['PricingRule'],
    }),
    deletePricingRule: builder.mutation<void, string>({
      query: (id) => ({
        url: `company/pricing/rules/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PricingRule'],
    }),

    // User Management endpoints
    getUsers: builder.query<{ items: User[]; total: number; page: number; per_page: number; pages: number }, {
      page?: number;
      per_page?: number;
      search?: string;
      role_id?: number;
      branch_id?: string;
      profile_type?: 'staff' | 'driver' | 'admin';
      is_active?: boolean;
      include_profile?: boolean;
    }>({
      query: ({
        page = 1,
        per_page = 20,
        search,
        role_id,
        branch_id,
        profile_type,
        is_active,
        include_profile = true
      }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        if (search) params.append('search', search)
        if (role_id) params.append('role_id', role_id.toString())
        if (branch_id) params.append('branch_id', branch_id)
        if (profile_type) params.append('profile_type', profile_type)
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        params.append('include_profile', include_profile.toString())
        return `company/users?${params}`
      },
      providesTags: ['User'],
    }),
    getUser: builder.query<User, string>({
      query: (id) => `company/users/${id}?include_profile=true`,
      providesTags: ['User'],
    }),
    createUser: builder.mutation<User, UserCreate>({
      query: (userData) => ({
        url: 'company/users/',
        method: 'POST',
        body: userData,
      }),
      invalidatesTags: ['User'],
    }),
    updateUser: builder.mutation<User, { id: string; user: Partial<UserUpdate> }>({
      query: ({ id, user }) => ({
        url: `company/users/${id}`,
        method: 'PUT',
        body: user,
      }),
      invalidatesTags: ['User', 'UserProfile'],
    }),
    deleteUser: builder.mutation<void, string>({
      queryFn: async (id, _queryApi, _extraOptions, baseQuery) => {
        // First, get the user from company service to find the auth user_id
        const userResponse = await baseQuery({
          url: `company/users/${id}`,
          method: 'GET',
        })

        if (userResponse.error) {
          return { error: userResponse.error }
        }

        const user = userResponse.data as User
        const authUserId = user.user_id

        if (!authUserId) {
          return { error: { status: 400, data: { message: 'User does not have an associated auth account' } } }
        }

        // Delete from auth service (this will cascade to company service)
        const deleteResponse = await baseQuery({
          url: `auth/users/${authUserId}`,
          method: 'DELETE',
        })

        if (deleteResponse.error) {
          return { error: deleteResponse.error }
        }

        return { data: undefined }
      },
      invalidatesTags: ['User'],
    }),
    inviteUser: builder.mutation<void, UserInvitation>({
      query: (invitation) => ({
        url: 'company/users/invite',
        method: 'POST',
        body: invitation,
      }),
    }),
    bulkInviteUsers: builder.mutation<void, { invitations: UserInvitation[] }>({
      query: ({ invitations }) => ({
        url: 'company/users/bulk-invite',
        method: 'POST',
        body: { invitations },
      }),
    }),
    updateUserStatus: builder.mutation<User, { id: string; is_active: boolean }>({
      query: ({ id, is_active }) => ({
        url: `company/users/${id}/status`,
        method: 'PUT',
        body: { is_active },
      }),
      invalidatesTags: ['User'],
    }),
    resetUserPassword: builder.mutation<void, { id: string; new_password: string }>({
      query: ({ id, new_password }) => ({
        url: `company/users/${id}/reset-password`,
        method: 'POST',
        body: { new_password },
      }),
    }),
    bulkUpdateUsers: builder.mutation<User[], { updates: Array<{ id: string; [key: string]: any }> }>({
      query: ({ updates }) => ({
        url: 'company/users/bulk-update',
        method: 'POST',
        body: updates,
      }),
      invalidatesTags: ['User'],
    }),
    exportUsers: builder.mutation<Blob, {
      role_id?: number;
      branch_id?: string;
      profile_type?: 'staff' | 'driver' | 'admin';
      is_active?: boolean;
      format?: 'csv' | 'excel';
    }>({
      query: ({ role_id, branch_id, profile_type, is_active, format = 'excel' }) => {
        const params = new URLSearchParams()
        if (role_id) params.append('role_id', role_id.toString())
        if (branch_id) params.append('branch_id', branch_id)
        if (profile_type) params.append('profile_type', profile_type)
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        params.append('format', format)
        return {
          url: `company/users/export?${params}`,
          method: 'GET',
          responseHandler: (response) => response.blob(),
        }
      },
    }),

    // Role Management endpoints
    getRoles: builder.query<getRoleAPIResponse, { include_permissions?: boolean }>({
      query: ({ include_permissions = true }) => {
        // Now uses auth service roles via company service proxy
        return 'company/roles/auth-roles'
      },
      providesTags: ['Role'],
    }),
    getRole: builder.query<Role, string>({
      query: (id) => `company/roles/${id}?include_permissions=true`,
      providesTags: ['Role'],
    }),
    createRole: builder.mutation<Role, RoleCreate>({
      query: (roleData) => ({
        url: 'company/roles/',
        method: 'POST',
        body: roleData,
      }),
      invalidatesTags: ['Role'],
    }),
    updateRole: builder.mutation<Role, { id: string; role: Partial<RoleUpdate> }>({
      query: ({ id, role }) => ({
        url: `company/roles/${id}`,
        method: 'PUT',
        body: role,
      }),
      invalidatesTags: ['Role'],
    }),
    deleteRole: builder.mutation<void, string>({
      query: (id) => ({
        url: `company/roles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Role'],
    }),
    getPermissions: builder.query<Permission[], void>({
      query: () => 'company/roles/permissions',
      providesTags: ['Role'],
    }),

    // Get roles from auth service (via company service proxy)
    getAuthRoles: builder.query<AuthRole[], void>({
      query: () => 'company/roles/auth-roles',
      providesTags: ['Role'],
    }),

    // User Profile endpoints
    getUserProfile: builder.query<UserProfile, string>({
      query: (userId) => `company/profiles/employee/${userId}`,
      providesTags: ['UserProfile'],
    }),
    createUserProfile: builder.mutation<UserProfile, { userId: string; profile: UserProfileCreate }>({
      query: ({ userId, profile }) => ({
        url: `company/profiles/employee`,
        method: 'POST',
        body: { ...profile, user_id: userId },
      }),
      invalidatesTags: ['UserProfile'],
    }),
    updateUserProfile: builder.mutation<UserProfile, { userId: string; profile: Partial<UserProfileUpdate> }>({
      query: ({ userId, profile }) => ({
        url: `company/profiles/employee/${userId}`,
        method: 'PUT',
        body: profile,
      }),
      invalidatesTags: ['UserProfile', 'User'],
    }),
    getProfileCompletion: builder.query<{ percentage: number; missing_sections: string[] }, string>({
      query: (userId) => `company/profiles/employee/${userId}/completion`,
      providesTags: ['UserProfile'],
    }),

    // Driver Profile endpoints
    getDriverProfile: builder.query<any, string>({
      query: (driverId) => `company/profiles/drivers/${driverId}`,
      providesTags: ['UserProfile'],
    }),
    createDriverProfile: builder.mutation<any, { userId: string; profile: any }>({
      query: ({ userId, profile }) => ({
        url: `company/profiles/drivers`,
        method: 'POST',
        body: { employee_id: userId, ...profile },
      }),
      invalidatesTags: ['UserProfile'],
    }),
    updateDriverProfile: builder.mutation<any, { driverId: string; profile: Partial<any> }>({
      query: ({ driverId, profile }) => ({
        url: `company/profiles/drivers/${driverId}`,
        method: 'PUT',
        body: profile,
      }),
      invalidatesTags: ['UserProfile'],
    }),

    // User Documents endpoints
    getUserDocuments: builder.query<UserDocument[], { profileId: string; document_type?: string }>({
      query: ({ profileId, document_type }) => {
        const params = new URLSearchParams()
        if (document_type) params.append('document_type', document_type)
        return `company/profiles/${profileId}/documents?${params}`
      },
      providesTags: ['UserDocument'],
    }),
    uploadUserDocument: builder.mutation<UserDocument, {
      profileId: string;
      document_type: string;
      document_name: string;
      file: File;
    }>({
      query: ({ profileId, document_type, document_name, file }) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('document_type', document_type)
        formData.append('document_name', document_name)
        return {
          url: `company/profiles/documents`,
          method: 'POST',
          body: formData,
          formData: true,
        }
      },
      invalidatesTags: ['UserDocument'],
    }),
    verifyUserDocument: builder.mutation<UserDocument, { documentId: string }>({
      query: ({ documentId }) => ({
        url: `company/profiles/documents/${documentId}/verify`,
        method: 'POST',
      }),
      invalidatesTags: ['UserDocument'],
    }),
    deleteUserDocument: builder.mutation<void, { documentId: string }>({
      query: ({ documentId }) => ({
        url: `company/profiles/documents/${documentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['UserDocument'],
    }),
  }),
})

// Export hooks for components
export const {
  useGetBranchesQuery,
  useLazyGetBranchesQuery,
  useGetBranchQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
  useGetBranchMetricsQuery,
  useGetCustomersQuery,
  useLazyGetCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useGetVehiclesQuery,
  useLazyGetVehiclesQuery,
  useGetVehicleQuery,
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useDeleteVehicleMutation,
  useUpdateVehicleStatusMutation,
  useGetAvailableVehiclesQuery,
  useGetVehicleStatusOptionsQuery,
  useGetProductCategoriesQuery,
  useGetProductCategoryTreeQuery,
  useGetProductCategoryQuery,
  useCreateProductCategoryMutation,
  useUpdateProductCategoryMutation,
  useDeleteProductCategoryMutation,
  useGetBusinessTypesQuery,
  useGetAllBusinessTypesQuery,
  useGetBusinessTypeQuery,
  useCreateBusinessTypeMutation,
  useUpdateBusinessTypeMutation,
  useDeleteBusinessTypeMutation,
  useGetVehicleTypesQuery,
  useGetAllVehicleTypesQuery,
  useGetVehicleTypeQuery,
  useCreateVehicleTypeMutation,
  useUpdateVehicleTypeMutation,
  useDeleteVehicleTypeMutation,
  useGetProductsQuery,
  useLazyGetProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useGetLowStockProductsQuery,
  useBulkUpdateProductsMutation,
  useGetProductStockHistoryQuery,
  useGetPricingRulesQuery,
  useCreatePricingRuleMutation,
  useUpdatePricingRuleMutation,
  useDeletePricingRuleMutation,
  // User Management hooks
  useGetUsersQuery,
  useLazyGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useInviteUserMutation,
  useBulkInviteUsersMutation,
  useUpdateUserStatusMutation,
  useResetUserPasswordMutation,
  useBulkUpdateUsersMutation,
  useExportUsersMutation,
  // Role Management hooks
  useGetRolesQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useGetAuthRolesQuery,  // Get roles from auth service via company service
  useGetPermissionsQuery,
  // User Profile hooks
  useGetUserProfileQuery,
  useCreateUserProfileMutation,
  useUpdateUserProfileMutation,
  useGetProfileCompletionQuery,
  // Driver Profile hooks
  useGetDriverProfileQuery,
  useCreateDriverProfileMutation,
  useUpdateDriverProfileMutation,
  // User Documents hooks
  useGetUserDocumentsQuery,
  useUploadUserDocumentMutation,
  useVerifyUserDocumentMutation,
  useDeleteUserDocumentMutation,
} = companyApi