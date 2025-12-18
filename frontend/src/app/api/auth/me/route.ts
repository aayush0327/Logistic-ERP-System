import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:8001';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header from the incoming request
    const authHeader = request.headers.get('authorization');

    // Forward the request to the backend auth service
    const response = await fetch(`${API_URL}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    const data = await response.json();

    // Return the response with the same status
    return NextResponse.json(data, {
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    console.error('Get current user proxy error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}