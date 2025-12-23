import { NextRequest, NextResponse } from 'next/server';

// TMS service URL
const TMS_SERVICE_URL = process.env.NEXT_PUBLIC_TMS_API_URL || 'http://localhost:8004';

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
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tenant_id = searchParams.get('tenant_id') || 'default-tenant';
    const branch_id = searchParams.get('branch_id');

    // Get auth token
    const token = getAuthToken(request);

    // Determine which endpoint to call based on parameters
    let url = `${TMS_SERVICE_URL}/api/v1/resources/trucks?tenant_id=${tenant_id}`;

    // If branch_id is provided, get trucks for that specific branch
    if (branch_id) {
      url = `${TMS_SERVICE_URL}/api/v1/resources/branches/${branch_id}/trucks?tenant_id=${tenant_id}`;
    }

    // Call TMS service trucks endpoint
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      console.error('TMS service error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Failed to fetch trucks from TMS service: ${response.statusText}` },
        { status: response.status }
      );
    }

    const trucks = await response.json();
    return NextResponse.json(trucks);
  } catch (error) {
    console.error('Error fetching trucks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch trucks' },
      { status: 500 }
    );
  }
}