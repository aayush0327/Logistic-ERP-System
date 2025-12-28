/**
 * Proxy API route for user export operations
 * Forwards requests to the company service
 */
import { NextRequest } from 'next/server'
import { proxyRequest } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

// Create the API route handler for GET (export)
export async function GET(request: NextRequest) {
  return proxyRequest(request, COMPANY_API_URL, 'users/export')
}
