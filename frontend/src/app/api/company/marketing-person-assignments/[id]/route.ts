/**
 * Proxy API route for individual marketing person assignment
 * Forwards requests to the company service
 */
import { NextRequest } from 'next/server'
import { proxyRequest } from '@/utils/apiProxy'

// Get the company service URL from environment variables
const COMPANY_API_URL = process.env.NEXT_PUBLIC_COMPANY_API_URL || 'http://localhost:8002'

// Create the API route handlers
// Next.js 15: params is now a Promise and must be awaited
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyRequest(request, COMPANY_API_URL, `api/v1/marketing-person-assignments/${id}/`)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyRequest(request, COMPANY_API_URL, `api/v1/marketing-person-assignments/${id}/`)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyRequest(request, COMPANY_API_URL, `api/v1/marketing-person-assignments/${id}/`)
}
