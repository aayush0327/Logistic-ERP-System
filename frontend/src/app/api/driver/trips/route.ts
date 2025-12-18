import { NextRequest, NextResponse } from 'next/server';

// Driver Service URL from environment
const NEXT_PUBLIC_DRIVER_SERVICE_URL = process.env.NEXT_PUBLIC_DRIVER_SERVICE_URL || 'http://localhost:8005';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const trip_date = searchParams.get('trip_date');

    // Build query string for driver service
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    if (trip_date) queryParams.append('trip_date', trip_date);

    const url = `${NEXT_PUBLIC_DRIVER_SERVICE_URL}/api/v1/driver/trips${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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