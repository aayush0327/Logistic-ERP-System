/**
 * API route for pausing a trip (Under Maintenance)
 * Proxies POST requests to the Driver Service
 */

import { NextRequest } from 'next/server'
import { proxyRequest } from '@/utils/apiProxy'

const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || 'http://localhost:8005'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const path = `/api/v1/driver/trips/${id}/pause`
  return proxyRequest(request, DRIVER_SERVICE_URL, path)
}
