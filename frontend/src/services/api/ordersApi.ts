import { RootState } from '@/store';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Types for API
export interface Order {
  id: string;
  order_number: string;
  status: 'draft' | 'submitted' | 'finance_approved' | 'finance_rejected' | 'logistics_approved' | 'logistics_rejected' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  customer_id: string;
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  branch_id: string;
  branch?: {
    id: string;
    name: string;
    code: string;
    city: string;
  };
  order_type: 'pickup' | 'delivery' | 'both';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  total_amount: number;
  total_weight: number;
  total_volume: number;
  package_count: number;
  special_instructions?: string;
  delivery_instructions?: string;
  pickup_date?: string;
  delivery_date?: string;
  payment_type: 'cod' | 'prepaid' | 'credit';
  created_at: string;
  updated_at?: string;
  items: OrderItem[];
  items_count: number;  // Number of items (backward compatibility)
  documents?: OrderDocument[];
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code?: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  total_price?: number;
  weight?: number;
  total_weight?: number;
  volume?: number;
}

export interface OrderDocument {
  id: string;
  document_type: string;
  title: string;
  description?: string;
  file_url: string;
  file_name: string;
  file_size: number;
  is_verified: boolean;
  is_required: boolean;
  created_at: string;
}

export interface OrderCreate {
  order_number: string;
  tenant_id: string;
  customer_id: string;
  branch_id: string;
  order_type: 'pickup' | 'delivery' | 'both';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  pickup_info?: {
    contact_name: string;
    contact_phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  delivery_info?: {
    contact_name: string;
    contact_phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  total_weight?: number;
  total_volume?: number;
  package_count: number;
  total_amount: number;
  payment_type?: 'cod' | 'prepaid' | 'credit';
  special_instructions?: string;
  delivery_instructions?: string;
  pickup_date?: string;
  delivery_date?: string;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    weight?: number;
  }[];
}

export interface PaginatedOrderResponse {
  items: Order[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  address?: string;
  phone?: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category_id?: string;
  category?: {
    id: string;
    name: string;
  };
  unit_price: number;
  special_price?: number;
  weight?: number;
  current_stock: number;
  is_active: boolean;
  available_for_all_branches: boolean;
  branches?: Array<{
    branch_id: string;
    branch?: Branch;
  }>;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  credit_limit?: number;
  is_active: boolean;
  created_at: string;
}

// Create API slice
export const ordersApi = createApi({
  reducerPath: 'ordersApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/orders',
    prepareHeaders: (headers, { getState }) => {
      // Get token from Redux store
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Order', 'Branch', 'Product', 'Customer'],
  endpoints: (builder) => ({
    // Order endpoints
    getOrders: builder.query<PaginatedOrderResponse, {
      page?: number;
      per_page?: number;
      status?: string;
      customer_id?: string;
      branch_id?: string;
      order_type?: string;
      priority?: string;
      payment_type?: string;
      date_from?: string;
      date_to?: string;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
      search?: string;
    }>({
      query: (params) => ({
        url: '/',
        params: params,
      }),
      providesTags: ['Order'],
    }),

    getOrderById: builder.query<Order, string>({
      query: (id) => ({
        url: `/${id}`,
      }),
      providesTags: (result, error, id) => [{ type: 'Order', id }],
    }),

    createOrder: builder.mutation<Order, OrderCreate>({
      query: (order) => ({
        url: '/',
        method: 'POST',
        body: order,
      }),
      invalidatesTags: ['Order'],
    }),

    updateOrder: builder.mutation<Order, { id: string; data: Partial<OrderCreate> }>({
      query: ({ id, data }) => ({
        url: `/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Order', id }],
    }),

    submitOrder: builder.mutation<Order, string>({
      query: (id) => ({
        url: `/${id}/submit`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Order', id }],
    }),

    cancelOrder: builder.mutation<Order, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/${id}/cancel`,
        method: 'POST',
        params: reason ? { reason } : undefined,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Order', id }],
    }),

    deleteOrder: builder.mutation<void, string>({
      query: (id) => ({
        url: `/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Order'],
    }),

    // Resource endpoints (fetching from company service)
    getBranches: builder.query<Branch[], void>({
      query: () => ({
        url: '/resources/branches',
      }),
      providesTags: ['Branch'],
    }),

    getProducts: builder.query<Product[], {
      branch_id?: string;
      is_active?: boolean;
      include_branches?: boolean;
    }>({
      query: (params) => ({
        url: '/resources/products',
        params: {
          is_active: true,
          ...params,
        },
      }),
      providesTags: ['Product'],
    }),

    getProductsByCategory: builder.query<Record<string, Product[]>, {
      category_id?: string;
      branch_id?: string;
    }>({
      query: (params) => ({
        url: '/resources/products/by-category',
        params: params,
      }),
      providesTags: ['Product'],
    }),

    getCustomers: builder.query<Customer[], {
      branch_id?: string;
      search?: string;
      is_active?: boolean;
    }>({
      query: (params) => ({
        url: '/resources/customers',
        params: {
          is_active: true,
          ...params,
        },
      }),
      providesTags: ['Customer'],
    }),
  }),
});

// Export hooks
export const {
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useSubmitOrderMutation,
  useCancelOrderMutation,
  useDeleteOrderMutation,
  useGetBranchesQuery,
  useGetProductsQuery,
  useGetProductsByCategoryQuery,
  useGetCustomersQuery,
} = ordersApi;