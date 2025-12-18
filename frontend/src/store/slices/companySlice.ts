import { createSlice, PayloadAction } from '@reduxjs/toolkit'

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
  home_branch?: {
    id: string
    name: string
  }
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

export interface CompanyState {
  // Data
  branches: Branch[]
  customers: Customer[]
  vehicles: Vehicle[]
  products: Product[]
  productCategories: ProductCategory[]
  pricingRules: PricingRule[]

  // UI State
  loading: boolean
  error: string | null

  // Pagination
  branchesPagination: {
    page: number
    per_page: number
    total: number
    pages: number
  }
  customersPagination: {
    page: number
    per_page: number
    total: number
    pages: number
  }
  vehiclesPagination: {
    page: number
    per_page: number
    total: number
    pages: number
  }
  productsPagination: {
    page: number
    per_page: number
    total: number
    pages: number
  }
}

const initialState: CompanyState = {
  branches: [],
  customers: [],
  vehicles: [],
  products: [],
  productCategories: [],
  pricingRules: [],

  loading: false,
  error: null,

  branchesPagination: {
    page: 1,
    per_page: 20,
    total: 0,
    pages: 0,
  },
  customersPagination: {
    page: 1,
    per_page: 20,
    total: 0,
    pages: 0,
  },
  vehiclesPagination: {
    page: 1,
    per_page: 20,
    total: 0,
    pages: 0,
  },
  productsPagination: {
    page: 1,
    per_page: 20,
    total: 0,
    pages: 0,
  },
}

const companySlice = createSlice({
  name: 'company',
  initialState,
  reducers: {
    // Branches
    setBranches: (state, action: PayloadAction<{ items: Branch[]; total: number; page: number; per_page: number; pages: number }>) => {
      state.branches = action.payload.items
      state.branchesPagination = {
        page: action.payload.page,
        per_page: action.payload.per_page,
        total: action.payload.total,
        pages: action.payload.pages,
      }
      state.loading = false
    },
    addBranch: (state, action: PayloadAction<Branch>) => {
      state.branches.push(action.payload)
    },
    updateBranch: (state, action: PayloadAction<Branch>) => {
      const index = state.branches.findIndex(b => b.id === action.payload.id)
      if (index !== -1) {
        state.branches[index] = action.payload
      }
    },
    removeBranch: (state, action: PayloadAction<string>) => {
      state.branches = state.branches.filter(b => b.id !== action.payload)
    },

    // Customers
    setCustomers: (state, action: PayloadAction<{ items: Customer[]; total: number; page: number; per_page: number; pages: number }>) => {
      state.customers = action.payload.items
      state.customersPagination = {
        page: action.payload.page,
        per_page: action.payload.per_page,
        total: action.payload.total,
        pages: action.payload.pages,
      }
      state.loading = false
    },
    addCustomer: (state, action: PayloadAction<Customer>) => {
      state.customers.push(action.payload)
    },
    updateCustomer: (state, action: PayloadAction<Customer>) => {
      const index = state.customers.findIndex(c => c.id === action.payload.id)
      if (index !== -1) {
        state.customers[index] = action.payload
      }
    },
    removeCustomer: (state, action: PayloadAction<string>) => {
      state.customers = state.customers.filter(c => c.id !== action.payload)
    },

    // Vehicles
    setVehicles: (state, action: PayloadAction<{ items: Vehicle[]; total: number; page: number; per_page: number; pages: number }>) => {
      state.vehicles = action.payload.items
      state.vehiclesPagination = {
        page: action.payload.page,
        per_page: action.payload.per_page,
        total: action.payload.total,
        pages: action.payload.pages,
      }
      state.loading = false
    },
    addVehicle: (state, action: PayloadAction<Vehicle>) => {
      state.vehicles.push(action.payload)
    },
    updateVehicle: (state, action: PayloadAction<Vehicle>) => {
      const index = state.vehicles.findIndex(v => v.id === action.payload.id)
      if (index !== -1) {
        state.vehicles[index] = action.payload
      }
    },
    removeVehicle: (state, action: PayloadAction<string>) => {
      state.vehicles = state.vehicles.filter(v => v.id !== action.payload)
    },

    // Products
    setProducts: (state, action: PayloadAction<{ items: Product[]; total: number; page: number; per_page: number; pages: number }>) => {
      state.products = action.payload.items
      state.productsPagination = {
        page: action.payload.page,
        per_page: action.payload.per_page,
        total: action.payload.total,
        pages: action.payload.pages,
      }
      state.loading = false
    },
    addProduct: (state, action: PayloadAction<Product>) => {
      state.products.push(action.payload)
    },
    updateProduct: (state, action: PayloadAction<Product>) => {
      const index = state.products.findIndex(p => p.id === action.payload.id)
      if (index !== -1) {
        state.products[index] = action.payload
      }
    },
    removeProduct: (state, action: PayloadAction<string>) => {
      state.products = state.products.filter(p => p.id !== action.payload)
    },

    // Product Categories
    setProductCategories: (state, action: PayloadAction<ProductCategory[]>) => {
      state.productCategories = action.payload
      state.loading = false
    },
    addProductCategory: (state, action: PayloadAction<ProductCategory>) => {
      state.productCategories.push(action.payload)
    },
    updateProductCategory: (state, action: PayloadAction<ProductCategory>) => {
      const index = state.productCategories.findIndex(pc => pc.id === action.payload.id)
      if (index !== -1) {
        state.productCategories[index] = action.payload
      }
    },
    removeProductCategory: (state, action: PayloadAction<string>) => {
      state.productCategories = state.productCategories.filter(pc => pc.id !== action.payload)
    },

    // Pricing Rules
    setPricingRules: (state, action: PayloadAction<PricingRule[]>) => {
      state.pricingRules = action.payload
      state.loading = false
    },
    addPricingRule: (state, action: PayloadAction<PricingRule>) => {
      state.pricingRules.push(action.payload)
    },
    updatePricingRule: (state, action: PayloadAction<PricingRule>) => {
      const index = state.pricingRules.findIndex(pr => pr.id === action.payload.id)
      if (index !== -1) {
        state.pricingRules[index] = action.payload
      }
    },
    removePricingRule: (state, action: PayloadAction<string>) => {
      state.pricingRules = state.pricingRules.filter(pr => pr.id !== action.payload)
    },

    // UI State
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },

    // Pagination updates
    setBranchesPagination: (state, action: PayloadAction<Partial<typeof initialState.branchesPagination>>) => {
      state.branchesPagination = { ...state.branchesPagination, ...action.payload }
    },
    setCustomersPagination: (state, action: PayloadAction<Partial<typeof initialState.customersPagination>>) => {
      state.customersPagination = { ...state.customersPagination, ...action.payload }
    },
    setVehiclesPagination: (state, action: PayloadAction<Partial<typeof initialState.vehiclesPagination>>) => {
      state.vehiclesPagination = { ...state.vehiclesPagination, ...action.payload }
    },
    setProductsPagination: (state, action: PayloadAction<Partial<typeof initialState.productsPagination>>) => {
      state.productsPagination = { ...state.productsPagination, ...action.payload }
    },
  },
})

export const {
  setBranches,
  addBranch,
  updateBranch,
  removeBranch,
  setCustomers,
  addCustomer,
  updateCustomer,
  removeCustomer,
  setVehicles,
  addVehicle,
  updateVehicle,
  removeVehicle,
  setProducts,
  addProduct,
  updateProduct,
  removeProduct,
  setProductCategories,
  addProductCategory,
  updateProductCategory,
  removeProductCategory,
  setPricingRules,
  addPricingRule,
  updatePricingRule,
  removePricingRule,
  setLoading,
  setError,
  setBranchesPagination,
  setCustomersPagination,
  setVehiclesPagination,
  setProductsPagination,
} = companySlice.actions

export default companySlice.reducer