import { NextRequest, NextResponse } from 'next/server';

// Driver Service URL
const DRIVER_SERVICE_URL = process.env.NEXT_PUBLIC_DRIVER_SERVICE_URL || 'http://localhost:8005';

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
    const trip_date = searchParams.get('trip_date');
    const driver_id = searchParams.get('driver_id');

    // Build query string for driver service
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    if (trip_date) queryParams.append('trip_date', trip_date);
    if (driver_id) queryParams.append('driver_id', driver_id);

    // Get auth token
    const token = getAuthToken(request);

    const url = `${DRIVER_SERVICE_URL}/api/v1/driver/trips${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch driver trips: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching driver trips:', error);
    return NextResponse.json(
      { error: 'Failed to fetch driver trips' },
      { status: 500 }
    );
  }
}