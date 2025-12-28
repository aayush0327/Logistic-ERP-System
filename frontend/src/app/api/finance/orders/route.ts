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

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();

    // Forward the request to the Finance Service orders endpoint
    const response = await fetch(`${FINANCE_SERVICE_URL}/api/v1/orders${searchParams ? `?${searchParams}` : ''}`, {
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

      // Return the actual error
      return NextResponse.json(
        { error: `Failed to fetch orders from Finance service: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("finance data",data)
    return NextResponse.json(data);
  } catch (error) {
    console.error('Finance Orders API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}