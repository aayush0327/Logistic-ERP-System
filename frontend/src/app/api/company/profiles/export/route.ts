/**
 * Proxy API route for profile export
 * Forwards requests to the company service
 */
import { createApiRoute } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

// Create the API route handler
export const POST = createApiRoute(COMPANY_API_URL, 'profiles/export')