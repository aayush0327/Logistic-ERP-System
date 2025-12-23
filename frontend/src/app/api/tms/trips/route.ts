import { NextRequest, NextResponse } from 'next/server';

// TMS Service URL from environment
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const branch = searchParams.get('branch');
    const trip_date = searchParams.get('trip_date');
    const user_id = searchParams.get('user_id');
    const company_id = searchParams.get('company_id');

    // Get auth token
    const token = getAuthToken(request);

    // Build query string for TMS service
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    if (branch) queryParams.append('branch', branch);
    if (trip_date) queryParams.append('trip_date', trip_date);
    if (user_id) queryParams.append('user_id', user_id);
    if (company_id) queryParams.append('company_id', company_id);

    const url = `${TMS_SERVICE_URL}/api/v1/trips${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to fetch trips: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching trips:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch trips' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get auth token
    const token = getAuthToken(request);

    // The backend will handle user_id and company_id from JWT token
    // So we don't need to add them here
    const tripData = {
      ...body,
    };

    const response = await fetch(`${TMS_SERVICE_URL}/api/v1/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(tripData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to create trip: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('Error creating trip:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create trip' },
      { status: 500 }
    );
  }
}