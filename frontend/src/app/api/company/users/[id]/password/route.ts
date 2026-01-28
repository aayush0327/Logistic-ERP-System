/**
 * Proxy API route for changing user password
 * Forwards requests to the company service
 */
import { NextRequest } from 'next/server'
import { proxyRequest } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

// Create the API route handler
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const { id } = resolvedParams
  return proxyRequest(request, COMPANY_API_URL, `users/${id}/password`)
}
