import { NextRequest, NextResponse } from 'next/server';

// Driver Service URL from environment
const DRIVER_SERVICE_URL = process.env.NEXT_PUBLIC_DRIVER_SERVICE_URL || 'http://localhost:8005';

export async function GET(request: NextRequest) {
  try {
    const url = `${DRIVER_SERVICE_URL}/api/v1/driver/trips/current`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward authorization headers if any
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch current trip: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching current trip:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current trip' },
      { status: 500 }
    );
  }
}