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
    const headers: Record<string, string> = {}

    // Forward authorization header if present (critical for authentication)
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    // Forward content-type if present
    const contentType = request.headers.get('content-type')
    if (contentType) {
      headers['Content-Type'] = contentType
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

    // Handle 204 No Content responses (must be before JSON parsing)
    if (response.status === 204) {
      return new NextResponse(null, {
        status: 204,
        statusText: response.statusText,
      })
    }

    // Handle non-JSON responses
    const responseContentType = response.headers.get('content-type')
    if (!responseContentType || !responseContentType.includes('application/json')) {
      // For non-JSON responses, return as text
      const text = await response.text()
      return new NextResponse(text, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'content-type': responseContentType || 'text/plain',
        }
      })
    }

    // Parse JSON response
    let data
    try {
      data = await response.json()
    } catch (e) {
      // If JSON parsing fails, return the raw response
      const text = await response.text()
      return new NextResponse(text, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          'content-type': 'text/plain',
        }
      })
    }

    // Return response with same status and data
    return NextResponse.json(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        // Forward important response headers
        'content-type': responseContentType || 'application/json',
        // Forward any custom headers from the backend
        ...getResponseHeaders(response, ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'])
      }
    })
  } catch (error) {
    console.error(`API proxy error for ${path}:`, error)

    // Check if it's a network/connectivity error
    if (error instanceof Error) {
      if (error.name === 'FetchError' || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Backend service is currently unavailable',
              details: process.env.NODE_ENV === 'development' ? error.message : undefined
            }
          },
          { status: 503 }
        )
      }
    }

    // Return generic error response
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An internal server error occurred',
          details: process.env.NODE_ENV === 'development' ?
            (error instanceof Error ? error.message : 'Unknown error') : undefined
        }
      },
      { status: 500 }
    )
  }
}

/**
 * Helper to extract specific response headers
 */
function getResponseHeaders(response: Response, headerNames: string[]): Record<string, string> {
  const headers: Record<string, string> = {}
  headerNames.forEach(name => {
    const value = response.headers.get(name)
    if (value) {
      headers[name] = value
    }
  })
  return headers
}

/**
 * Create a standardized API route handler
 */
export function createApiRoute(
  serviceUrl: string,
  path: string = ''
) {
  return async (request: NextRequest, { params }: { params?: Promise<Record<string, string>> } = {}) => {
    // Extract route parameters from the path
    let finalPath = path
    if (params) {
      const resolvedParams = await params
      Object.entries(resolvedParams).forEach(([key, value]) => {
        finalPath = finalPath.replace(`[${key}]`, value)
      })
    }

    return proxyRequest(request, serviceUrl, finalPath)
  }
}

/**
 * Create a dynamic API route handler for resources with IDs
 */
export function createDynamicApiRoute(
  serviceUrl: string,
  basePath: string
) {
  return async (request: NextRequest, { params }: { params: Record<string, string> }) => {
    // Construct path with dynamic ID
    const { id } = params
    const path = `${basePath}${id ? `${id}/` : ''}`

    return proxyRequest(request, serviceUrl, path)
  }
}