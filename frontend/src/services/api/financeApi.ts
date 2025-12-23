import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { RootState } from '@/store/index';

// Types for Finance API
export interface FinanceOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer?: {
    name: string;
    phone?: string;
    email?: string;
  };
  branch_id: string;
  status: string;
  total_amount?: number;
  payment_type?: string;
  priority?: string;
  created_at: string;
  submitted_at?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  finance_approved_at?: string;
  finance_approved_by?: string;
  approval_action_id?: string;
  approval_reason?: string;
}

export interface ApprovalAction {
  id: string;
  tenant_id: string;
  order_id: string;
  approval_type: 'finance' | 'logistics' | 'payment' | 'refund';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  order_amount?: number;
  approved_amount?: number;
  approver_id?: string;
  approver_name?: string;
  approval_reason?: string;
  rejection_reason?: string;
  customer_id?: string;
  customer_name?: string;
  order_priority?: string;
  payment_type?: string;
  requested_by: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  is_active: boolean;
}

export interface DashboardStats {
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  summary: {
    total_orders: number;
    total_amount: number;
    total_order_amount: number;
    total_approved_amount: number;
    pending_orders: number;
    pending_amount: number;
    approved_orders: number;
    approved_amount: number;
    rejected_orders: number;
    rejected_amount: number;
    approval_rate: number;
  };
  daily_trends: Array<{
    date: string;
    status: string;
    count: number;
    amount: number;
  }>;
  top_approvers: Array<{
    approver_name: string;
    approvals_count: number;
    total_amount: number;
  }>;
  current_pending: {
    count: number;
    amount: number;
  };
}

export interface ApprovalRequest {
  approved: boolean;
  reason?: string;
  notes?: string;
  approved_amount?: number;
  payment_type?: string;
}

export interface BulkApprovalRequest {
  order_ids: string[];
  approved: boolean;
  reason?: string;
  notes?: string;
}

export interface BulkApprovalResponse {
  total_orders: number;
  approved_orders: number;
  rejected_orders: number;
  failed_orders: Array<{
    order_id: string;
    error: string;
  }>;
  approval_actions: ApprovalAction[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface OrdersQueryParams {
  page?: number;
  per_page?: number;
  status?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface ApprovalQueryParams {
  page?: number;
  per_page?: number;
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approval_type?: 'finance' | 'logistics' | 'payment' | 'refund';
  approver_id?: string;
  order_id?: string;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface FinancialReportParams {
  customer_id?: string;
  payment_type?: string;
  date_from?: string;
  date_to?: string;
  group_by?: 'day' | 'week' | 'month' | 'quarter';
}

export interface PerformanceReportParams {
  approver_id?: string;
  date_from?: string;
  date_to?: string;
}

// Create the API slice
export const financeApi = createApi({
  reducerPath: 'financeApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/finance',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['FinanceOrder', 'ApprovalAction', 'DashboardStats', 'Reports'],
  endpoints: (builder) => ({
    // Orders endpoints
    getOrders: builder.query<PaginatedResponse<FinanceOrder>, OrdersQueryParams>({
      query: (params) => ({
        url: '/orders',
        params: {
          page: params.page || 1,
          per_page: params.per_page || 20,
          ...(params.status && { status: params.status }),
          ...(params.customer_id && { customer_id: params.customer_id }),
          ...(params.date_from && { date_from: params.date_from }),
          ...(params.date_to && { date_to: params.date_to }),
          ...(params.search && { search: params.search }),
        },
      }),
      providesTags: ['FinanceOrder'],
    }),

    getOrderById: builder.query<FinanceOrder, string>({
      query: (orderId) => `/orders/${orderId}`,
      providesTags: (result, error, orderId) => [{ type: 'FinanceOrder', id: orderId }],
    }),

    getPendingApprovalsSummary: builder.query<{
      total_pending_orders: number;
      total_pending_amount: number;
      priority_breakdown: Record<string, { count: number; amount: number }>;
      last_updated: string;
    }, void>({
      query: () => '/orders/pending/summary',
      providesTags: ['DashboardStats'],
    }),

    // Approval endpoints
    approveOrder: builder.mutation<ApprovalAction, { orderId: string; approvalData: ApprovalRequest }>({
      query: ({ orderId, approvalData }) => ({
        url: `/approvals/order/${orderId}`,
        method: 'POST',
        body: approvalData,
      }),
      invalidatesTags: (result, error, { orderId }) => [
        { type: 'FinanceOrder', id: orderId },
        { type: 'ApprovalAction' },
        { type: 'DashboardStats' },
      ],
    }),

    bulkApproveOrders: builder.mutation<BulkApprovalResponse, BulkApprovalRequest>({
      query: (bulkData) => ({
        url: '/approvals/bulk',
        method: 'POST',
        body: bulkData,
      }),
      invalidatesTags: ['FinanceOrder', 'ApprovalAction', 'DashboardStats'],
    }),

    getApprovalActions: builder.query<PaginatedResponse<ApprovalAction>, ApprovalQueryParams>({
      query: (params) => ({
        url: '/approvals',
        params: {
          page: params.page || 1,
          per_page: params.per_page || 20,
          ...(params.status && { status: params.status }),
          ...(params.approval_type && { approval_type: params.approval_type }),
          ...(params.approver_id && { approver_id: params.approver_id }),
          ...(params.order_id && { order_id: params.order_id }),
          ...(params.customer_id && { customer_id: params.customer_id }),
          ...(params.date_from && { date_from: params.date_from }),
          ...(params.date_to && { date_to: params.date_to }),
        },
      }),
      providesTags: ['ApprovalAction'],
    }),

    getApprovalAuditTrail: builder.query<Array<{
      approval_action_id: string;
      action: string;
      old_status?: string;
      new_status?: string;
      user_id: string;
      user_name?: string;
      user_role?: string;
      reason?: string;
      notes?: string;
      ip_address?: string;
      user_agent?: string;
      created_at: string;
    }>, string>({
      query: (approvalId) => `/approvals/${approvalId}/audit`,
      providesTags: (result, error, approvalId) => [{ type: 'ApprovalAction', id: auditId }],
    }),

    // Reports endpoints
    getDashboardSummary: builder.query<DashboardStats, { days?: number }>({
      query: ({ days = 30 }) => ({
        url: '/reports/dashboard/summary',
        params: { days },
      }),
      providesTags: ['DashboardStats'],
    }),

    getApprovalPerformanceReport: builder.query<{
      performance_metrics: Array<{
        approver_id: string;
        approver_name: string;
        total_approvals: number;
        avg_approval_time_minutes: number;
        min_approval_time_minutes: number;
        max_approval_time_minutes: number;
      }>;
      status_breakdown: Array<{
        status: string;
        count: number;
        total_amount: number;
      }>;
      daily_volume: Array<{
        date: string;
        total: number;
        approved: number;
        rejected: number;
      }>;
    }, PerformanceReportParams>({
      query: (params) => ({
        url: '/reports/approvals/performance',
        params: {
          ...(params.approver_id && { approver_id: params.approver_id }),
          ...(params.date_from && { date_from: params.date_from }),
          ...(params.date_to && { date_to: params.date_to }),
        },
      }),
      providesTags: ['Reports'],
    }),

    getFinancialSummaryReport: builder.query<{
      summary: {
        total_orders: number;
        total_order_amount: number;
        total_approved_amount: number;
      };
      customer_breakdown: Array<{
        customer_id: string;
        customer_name: string;
        order_count: number;
        total_amount: number;
      }>;
      payment_type_breakdown: Array<{
        payment_type: string;
        order_count: number;
        total_amount: number;
      }>;
      time_series: Array<{
        period: string;
        order_count: number;
        total_amount: number;
      }>;
      filters: FinancialReportParams;
    }, FinancialReportParams>({
      query: (params) => ({
        url: '/reports/financial/summary',
        params: {
          ...(params.customer_id && { customer_id: params.customer_id }),
          ...(params.payment_type && { payment_type: params.payment_type }),
          ...(params.date_from && { date_from: params.date_from }),
          ...(params.date_to && { date_to: params.date_to }),
          ...(params.group_by && { group_by: params.group_by }),
        },
      }),
      providesTags: ['Reports'],
    }),
  }),
});

// Export hooks
export const {
  useGetOrdersQuery,
  useGetOrderByIdQuery,
  useGetPendingApprovalsSummaryQuery,
  useApproveOrderMutation,
  useBulkApproveOrdersMutation,
  useGetApprovalActionsQuery,
  useGetApprovalAuditTrailQuery,
  useGetDashboardSummaryQuery,
  useGetApprovalPerformanceReportQuery,
  useGetFinancialSummaryReportQuery,
} = financeApi;