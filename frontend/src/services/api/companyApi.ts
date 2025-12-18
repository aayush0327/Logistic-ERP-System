import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './baseApi'

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
  business_type?: string
  credit_limit: number
  pricing_tier: string
  is_active: boolean
  created_at: string
  updated_at?: string
  home_branch?: Branch
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
  capacity_weight?: number
  capacity_volume?: number
  status: string
  last_maintenance?: string
  next_maintenance?: string
  is_active: boolean
  created_at: string
  updated_at?: string
  branch?: Branch
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

export interface Product {
  id: string
  tenant_id: string
  category_id?: string
  code: string
  name: string
  description?: string
  unit_price: number
  special_price?: number
  weight?: number
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
  business_type?: string
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
  weight?: number
  length?: number
  width?: number
  height?: number
  volume?: number
  handling_requirements?: string[]
  min_stock_level?: number
  max_stock_level?: number
  current_stock?: number
  is_active?: boolean
}

export interface ProductCategoryCreate {
  name: string
  description?: string
  parent_id?: string
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

// Create API slice using base query with auth
export const companyApi = createApi({
  reducerPath: 'companyApi',
  baseQuery: baseQuery,
  tagTypes: ['Branch', 'Customer', 'Vehicle', 'Product', 'ProductCategory', 'PricingRule'],
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
    getBusinessTypes: builder.query<string[], void>({
      query: () => 'company/customers/business-types/',
      providesTags: ['Customer'],
    }),

    // Vehicle endpoints
    getVehicles: builder.query<{ items: Vehicle[]; total: number; page: number; per_page: number; pages: number }, { page?: number; per_page?: number; search?: string; vehicle_type?: string; status?: string; branch_id?: string; is_active?: boolean }>({
      query: ({ page = 1, per_page = 20, search, vehicle_type, status, branch_id, is_active }) => {
        const params = new URLSearchParams()
        params.append('page', page.toString())
        params.append('per_page', per_page.toString())
        if (search) params.append('search', search)
        if (vehicle_type) params.append('vehicle_type', vehicle_type)
        if (status) params.append('status', status)
        if (branch_id) params.append('branch_id', branch_id)
        if (is_active !== undefined) params.append('is_active', is_active.toString())
        return `company/vehicles?${params}`
      },
      providesTags: ['Vehicle'],
    }),
    getVehicle: builder.query<Vehicle, string>({
      query: (id) => `vehicles/${id}`,
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
    getVehicleTypes: builder.query<string[], void>({
      query: () => 'company/vehicles/vehicle-types',
      providesTags: ['Vehicle'],
    }),
    getVehicleStatusOptions: builder.query<string[], void>({
      query: () => 'company/vehicles/status-options',
      providesTags: ['Vehicle'],
    }),

    // Product Category endpoints
    getProductCategories: builder.query<ProductCategory[], { page?: number; per_page?: number; search?: string; parent_id?: string; is_active?: boolean; include_children?: boolean }>({
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
      query: (id) => `product-categories/${id}`,
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

    // Product endpoints
    getProducts: builder.query<{ items: Product[]; total: number; page: number; per_page: number; pages: number }, { page?: number; per_page?: number; search?: string; category_id?: string; min_price?: number; max_price?: number; is_active?: boolean; low_stock?: boolean }>({
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
      query: (id) => `products/${id}`,
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
  useGetBusinessTypesQuery,
  useGetVehiclesQuery,
  useLazyGetVehiclesQuery,
  useGetVehicleQuery,
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useDeleteVehicleMutation,
  useUpdateVehicleStatusMutation,
  useGetAvailableVehiclesQuery,
  useGetVehicleTypesQuery,
  useGetVehicleStatusOptionsQuery,
  useGetProductCategoriesQuery,
  useGetProductCategoryTreeQuery,
  useGetProductCategoryQuery,
  useCreateProductCategoryMutation,
  useUpdateProductCategoryMutation,
  useDeleteProductCategoryMutation,
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
} = companyApi