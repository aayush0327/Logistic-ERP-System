/**
 * Utility for proxying API requests to backend services
 */
import { NextRequest, NextResponse } from 'next/server'

export async function proxyRequest(
  request: NextRequest,
  serviceUrl: string,
  path: string = ''
) {
  try {
    // Build the target URL
    const url = new URL(path, serviceUrl)

    // Forward query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value)
    })

    // Get request body for non-GET requests
    let body: string | undefined
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.text()
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Forward authorization header if present
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    // Forward other important headers
    const importantHeaders = ['accept', 'accept-language', 'user-agent']
    importantHeaders.forEach(headerName => {
      const value = request.headers.get(headerName)
      if (value) {
        headers[headerName] = value
      }
    })

    // Make the request to the backend service
    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
    })

    // Get response data
    const data = await response.json()

    // Return response with same status and data
    return NextResponse.json(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        // Forward important response headers
        'content-type': response.headers.get('content-type') || 'application/json',
      }
    })
  } catch (error) {
    console.error(`API proxy error for ${path}:`, error)

    // Return appropriate error response
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Create a standardized API route handler
 */
export function createApiRoute(
  serviceUrl: string,
  path: string = ''
) {
  return async (request: NextRequest, { params }: { params?: Record<string, string> } = {}) => {
    // Extract route parameters from the path
    let finalPath = path
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        finalPath = finalPath.replace(`[${key}]`, value)
      })
    }

    return proxyRequest(request, serviceUrl, finalPath)
  }
}