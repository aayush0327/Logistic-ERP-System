/**
 * Proxy API route for marketing person assignments
 * Forwards requests to the company service
 */
import { NextRequest } from 'next/server'
import { proxyRequest } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_COMPANY_API_URL || 'http://localhost:8002'

// Create the API route handlers
export async function GET(request: NextRequest) {
  return proxyRequest(request, COMPANY_API_URL, 'api/v1/marketing-person-assignments/')
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, COMPANY_API_URL, 'api/v1/marketing-person-assignments/')
}
