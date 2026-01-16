/**
 * Proxy API route for getting all product unit types
 */
import { createApiRoute } from '@/utils/apiProxy'

const COMPANY_API_URL = process.env.NEXT_PUBLIC_COMPANY_API_URL || 'http://localhost:8002'

export const GET = createApiRoute(COMPANY_API_URL, 'product-unit-types/all')
