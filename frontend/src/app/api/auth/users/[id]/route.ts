/**
 * Proxy API route for individual user operations in auth service
 * Forwards requests to the auth service
 */
import { NextRequest } from 'next/server'
import { proxyRequest } from '@/utils/apiProxy'

// Get the auth service URL
const getAuthUrl = () => {
  return process.env.NODE_ENV === 'production'
    ? 'http://auth-service:8001'
    : 'http://localhost:8001'
}

// Create the API route handler - dynamically handles the user ID in the path
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const authUrl = getAuthUrl()
  return proxyRequest(request, authUrl, `api/v1/users/${id}`)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const authUrl = getAuthUrl()
  return proxyRequest(request, authUrl, `api/v1/users/${id}`)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const authUrl = getAuthUrl()
  return proxyRequest(request, authUrl, `api/v1/users/${id}`)
}
