/**
 * Proxy API route for individual document operations
 * Forwards requests to the company service
 */
import { createApiRoute } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

// Create the API route handler
export const GET = createApiRoute(COMPANY_API_URL, 'profiles/documents/[documentId]/')
export const PUT = createApiRoute(COMPANY_API_URL, 'profiles/documents/[documentId]/')
export const DELETE = createApiRoute(COMPANY_API_URL, 'profiles/documents/[documentId]/')