/**
 * Base API configuration for RTK Query
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '@/store'

// Base query configuration with authentication
export const baseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    // Get token from Redux state
    const token = (getState() as RootState).auth?.token

    // Add authorization header if token exists
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }

    // Ensure content type is set for POST/PUT requests
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }

    return headers
  },
})

// Enhanced base query with error handling
export const baseQueryWithAuth = async (args: any, api: any, extraOptions: any) => {
  // Run the base query
  const result = await baseQuery(args, api, extraOptions)

  // Handle authentication errors
  if (result.error && result.error.status === 401) {
    // Token is invalid or expired
    // You could dispatch a logout action here
    // api.dispatch(logout())
    console.error('Authentication error: Token is invalid or expired')
  }

  return result
}

// Create base API slice
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    // Auth
    'User',
    'Tenant',

    // Company Service
    'Branch',
    'Customer',
    'Vehicle',
    'Product',
    'ProductCategory',

    // Orders Service
    'Order',

    // TMS Service
    'Trip',
    'Driver',
    'Route',
  ],
  endpoints: () => ({}), // No endpoints defined here
})

// Export hooks for components
export const {
  util: { getRunningQueriesThunk, getRunningMutationsThunk },
} = api