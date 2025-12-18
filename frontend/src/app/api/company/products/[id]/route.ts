/**
 * Proxy API route for individual product operations
 * Forwards requests to the company service
 */
import { createApiRoute } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_COMPANY_API_URL || 'http://localhost:8002/api/v1'

// Create the API route handler with dynamic ID
export const GET = createApiRoute(COMPANY_API_URL, 'products/[id]/')
export const PUT = createApiRoute(COMPANY_API_URL, 'products/[id]/')
export const DELETE = createApiRoute(COMPANY_API_URL, 'products/[id]/')