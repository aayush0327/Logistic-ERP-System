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
  due_days?: number;
  due_days_marked_created?: boolean;
  items: OrderItem[];
  items_count: number;  // Number of items (backward compatibility)
  documents?: OrderDocument[];
  // Time in current status fields
  current_status_since?: string;  // ISO timestamp of when current status was set
  time_in_current_status_minutes?: number;  // Duration in minutes
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
  weight?: number;  // Weight per unit (in kg) or total weight depending on context
  weight_type?: 'fixed' | 'variable';  // Product weight type
  fixed_weight?: number;  // Fixed weight for fixed weight products (in kg)
  weight_unit?: string;  // Weight unit (kg, lb, g, etc.)
  volume?: number;
  total_weight?: number;  // Total weight for the item (weight * quantity)
  // Assignment fields
  original_quantity?: number;
  assigned_quantity?: number;
  remaining_quantity?: number;
  is_fully_assigned?: boolean;
  is_partially_assigned?: boolean;
  is_available?: boolean;
  assignments?: OrderItemAssignment[];
}

export interface OrderItemAssignment {
  trip_id: string;
  assigned_quantity: number;
  item_status: string;
  assigned_at?: string;
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
  due_days?: number;
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
  weight?: number;  // Deprecated - use fixed_weight
  fixed_weight?: number;  // Fixed weight for FIXED type products (in kg)
  weight_type?: 'fixed' | 'variable';  // Type of weight: fixed or variable
  weight_unit?: string;  // Weight unit (kg, lb, g, etc.)
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

// Due Days types
export interface DueDaysOrder {
  id: string;
  order_number: string;
  customer_id: string;
  branch_id: string;
  due_days: number;
  created_at: string;
  delivery_date: string;
  days_remaining: number;
  due_status: 'overdue' | 'due_soon' | 'pending';
  status: string;
  total_amount: number;
  order_type: string;
  priority: string;
}

export interface DueDaysData {
  overdue_count: number;
  due_soon_count: number;
  total_count: number;
  reference_date: string;
  threshold_date: string;
  orders: DueDaysOrder[];
}

export interface DueDaysStatistics {
  overdue_count: number;
  due_soon_count: number;
  total_due_count: number;
}

export interface MarkAsCreatedRequest {
  order_ids: string[];
}

export interface MarkAsCreatedResponse {
  message: string;
  count: number;
}

// Create API slice
export const ordersApi = createApi({
  reducerPath: 'ordersApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      // Get token from Redux store
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Order', 'Branch', 'Product', 'Customer', 'DueDays'],
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
        url: '/orders/',
        params: params,
      }),
      providesTags: ['Order'],
    }),

    getOrderById: builder.query<Order, string>({
      query: (id) => ({
        url: `/orders/${id}`,
      }),
      providesTags: (result, error, id) => [{ type: 'Order', id }],
    }),

    getOrderItemsWithAssignments: builder.query<{
      order_id: string;
      order_number: string;
      status: string;
      tms_order_status: string;
      items: Array<OrderItem & {
        original_quantity: number;
        assigned_quantity: number;
        remaining_quantity: number;
        is_fully_assigned: boolean;
        is_partially_assigned: boolean;
        is_available: boolean;
        assignments: OrderItemAssignment[];
      }>;
      summary: {
        total_original_quantity: number;
        total_assigned_quantity: number;
        total_remaining_quantity: number;
        is_fully_assigned: boolean;
        is_partially_assigned: boolean;
        is_available: boolean;
      };
    }, string>({
      query: (id) => ({
        url: `/orders/${id}/items-with-assignments`,
      }),
      providesTags: (result, error, id) => [{ type: 'Order', id }],
    }),

    createOrder: builder.mutation<Order, OrderCreate>({
      query: (order) => ({
        url: '/orders/',
        method: 'POST',
        body: order,
      }),
      invalidatesTags: ['Order'],
    }),

    updateOrder: builder.mutation<Order, { id: string; data: Partial<OrderCreate> }>({
      query: ({ id, data }) => ({
        url: `/orders/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Order', id }],
    }),

    submitOrder: builder.mutation<Order, string>({
      query: (id) => ({
        url: `/orders/${id}/submit`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Order', id }],
    }),

    cancelOrder: builder.mutation<Order, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/orders/${id}/cancel`,
        method: 'POST',
        params: reason ? { reason } : undefined,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Order', id }],
    }),

    deleteOrder: builder.mutation<void, string>({
      query: (id) => ({
        url: `/orders/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Order'],
    }),

    // Resource endpoints (fetching from company service)
    getBranches: builder.query<Branch[], void>({
      query: () => ({
        url: '/orders/resources/branches',
      }),
      providesTags: ['Branch'],
    }),

    getProducts: builder.query<Product[], {
      branch_id?: string;
      is_active?: boolean;
      include_branches?: boolean;
    }>({
      query: (params) => ({
        url: '/orders/resources/products',
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
        url: '/orders/resources/products/by-category',
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
        url: '/orders/resources/customers',
        params: {
          is_active: true,
          ...params,
        },
      }),
      providesTags: ['Customer'],
    }),

    // Due Days endpoints
    getDueDaysOrders: builder.query<DueDaysData, {
      days_threshold?: number;
      filter_date?: string;
      status_filter?: string;
    }>({
      query: (params) => ({
        url: '/due-days/orders',
        params: {
          days_threshold: 3,
          ...params,
        },
      }),
      providesTags: ['DueDays'],
    }),

    getDueDaysStatistics: builder.query<DueDaysStatistics, void>({
      query: () => ({
        url: '/due-days/statistics',
      }),
      providesTags: ['DueDays'],
    }),

    markOrdersAsCreated: builder.mutation<MarkAsCreatedResponse, MarkAsCreatedRequest>({
      query: (data) => ({
        url: '/due-days/mark-created',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['DueDays'],
    }),
  }),
});

// Export hooks
export const {
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useGetOrderItemsWithAssignmentsQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useSubmitOrderMutation,
  useCancelOrderMutation,
  useDeleteOrderMutation,
  useGetBranchesQuery,
  useGetProductsQuery,
  useGetProductsByCategoryQuery,
  useGetCustomersQuery,
  useGetDueDaysOrdersQuery,
  useGetDueDaysStatisticsQuery,
  useMarkOrdersAsCreatedMutation,
} = ordersApi;