/**
 * Proxy API route for getting finance manager profile by user ID
 * Forwards requests to the company service
 */
import { createApiRoute } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

// Create the API route handler for by-user endpoint
// Note: path includes [userId] which will be replaced by createApiRoute
export const GET = createApiRoute(COMPANY_API_URL, 'profiles/finance-managers/by-user/[userId]')
