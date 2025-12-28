/**
 * Proxy API route for user operations
 * Forwards requests to the company service
 */
import { NextRequest } from 'next/server'
import { proxyRequest } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

// Create the API route handler (with trailing slash to avoid 307 redirect)
export async function GET(request: NextRequest) {
  return proxyRequest(request, COMPANY_API_URL, 'users/')
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, COMPANY_API_URL, 'users/')
}