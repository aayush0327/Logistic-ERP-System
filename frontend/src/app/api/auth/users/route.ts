import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Get auth token from request headers (if any)
    const authHeader = request.headers.get('authorization')

    // Forward the request to the auth service
    // When running in Docker, use the service name; otherwise use localhost
    const authUrl = process.env.NODE_ENV === 'production'
      ? 'http://auth-service:8001'
      : 'http://localhost:8001'
    const response = await fetch(`${authUrl}/api/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward auth header if present
        ...(authHeader && { authorization: authHeader }),
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    // Return the response with the same status code
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Auth proxy error:', error)
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')

    // Forward the request to the auth service
    // When running in Docker, use the service name; otherwise use localhost
    const authUrl = process.env.NODE_ENV === 'production'
      ? 'http://auth-service:8001'
      : 'http://localhost:8001'
    const response = await fetch(`${authUrl}/api/v1/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { authorization: authHeader }),
      },
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Auth proxy error:', error)
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    )
  }
}