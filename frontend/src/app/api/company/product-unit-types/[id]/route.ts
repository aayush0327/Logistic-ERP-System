/**
 * Proxy API route for individual product unit type operations
 * Forwards requests to the company service
 */
import { createApiRoute } from '@/utils/apiProxy'
import { NextRequest } from 'next/server'

const COMPANY_API_URL = process.env.NEXT_PUBLIC_COMPANY_API_URL || 'http://localhost:8002'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return createApiRoute(COMPANY_API_URL, `product-unit-types/${id}`)(request)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return createApiRoute(COMPANY_API_URL, `product-unit-types/${id}`)(request)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return createApiRoute(COMPANY_API_URL, `product-unit-types/${id}`)(request)
}
