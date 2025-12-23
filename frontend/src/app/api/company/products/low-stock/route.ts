/**
 * Proxy API route for low stock products
 * Forwards requests to the company service
 */
import { NextRequest } from 'next/server'
import { proxyRequest } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_COMPANY_API_URL || 'http://localhost:8002'

// Create the API route handler
export async function GET(request: NextRequest) {
  // Forward query parameters
  const url = new URL(request.url)
  const params = url.searchParams.toString()
  const path = `products/low-stock${params ? '?' + params : ''}`

  return proxyRequest(request, COMPANY_API_URL, path)
}