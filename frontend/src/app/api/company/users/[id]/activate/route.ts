/**
 * Proxy API route for user activation operations
 * Forwards requests to the company service
 */
import { NextRequest, NextResponse } from 'next/server'

const COMPANY_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params

    // Forward authorization header from request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    const response = await fetch(`${COMPANY_API_URL}/users/${userId}/activate`, {
      method: 'POST',
      headers,
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Backend API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to activate user', details: errorData },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in user activate API route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
