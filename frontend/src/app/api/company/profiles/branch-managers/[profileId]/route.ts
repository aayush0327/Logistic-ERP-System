/**
 * Proxy API route for branch manager profile by ID
 * Forwards requests to the company service
 */
import { createApiRoute } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

// Create the API route handler for PUT (update) and DELETE
export const PUT = createApiRoute(COMPANY_API_URL, 'profiles/branch-managers/[profileId]')
export const DELETE = createApiRoute(COMPANY_API_URL, 'profiles/branch-managers/[profileId]')
