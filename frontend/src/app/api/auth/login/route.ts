import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:8001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headersList = headers();

    // Forward the request to the backend auth service
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward any other headers if needed
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Return the response with the same status
    return NextResponse.json(data, {
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    console.error('Login proxy error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}