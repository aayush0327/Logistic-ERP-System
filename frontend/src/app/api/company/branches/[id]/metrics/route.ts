/**
 * Proxy API route for branch metrics
 * Forwards requests to the company service for branch metrics
 */
import { NextRequest } from 'next/server'
import { proxyRequest } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_COMPANY_API_URL || "http://localhost:8002"

// Create the API route handler for branch metrics
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyRequest(request, COMPANY_API_URL, `branches/${id}/metrics`)
}
