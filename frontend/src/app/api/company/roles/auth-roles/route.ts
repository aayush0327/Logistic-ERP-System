/**
 * Proxy API route for auth-roles operations
 * Forwards requests to the company service's auth-roles endpoint
 */
import { createApiRoute } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

// Create the API route handler
// Note: path should be 'roles/auth-roles' to match the company service endpoint
export const GET = createApiRoute(COMPANY_API_URL, 'roles/auth-roles')
