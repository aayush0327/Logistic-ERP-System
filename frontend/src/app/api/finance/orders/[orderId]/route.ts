import { NextRequest, NextResponse } from 'next/server';

// Finance Service URL from environment
const FINANCE_SERVICE_URL = process.env.NEXT_PUBLIC_FINANCE_API_URL || 'http://localhost:8006';

// Helper function to get auth token from request
function getAuthToken(request: NextRequest): string | null {
  // Try to get token from Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try to get token from cookies (if using httpOnly cookies)
  const tokenCookie = request.cookies.get('access_token');
  return tokenCookie?.value || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params; // Unwrap the params Promise

    // Forward the request to the Finance Service
    const response = await fetch(`${FINANCE_SERVICE_URL}/api/v1/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward authentication headers if any
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
    });

    if (!response.ok) {
      console.error('Finance service error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);

      return NextResponse.json(
        { error: `Failed to fetch order from Finance service: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Finance Order API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}