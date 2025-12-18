import { NextRequest, NextResponse } from 'next/server';

// Driver Service URL from environment
const NEXT_PUBLIC_DRIVER_SERVICE_URL = process.env.NEXT_PUBLIC_DRIVER_SERVICE_URL || 'http://localhost:8005';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params promise
    const { id } = await params;

    // Validate and use the provided trip ID
    if (!id || id === 'undefined' || id.trim() === '') {
      console.log('Invalid trip ID received:', id);
      return NextResponse.json(
        { error: 'Invalid trip ID' },
        { status: 400 }
      );
    }

    const tripIdToUse = id;
    console.log('Fetching trip with ID:', tripIdToUse);

    const url = `${NEXT_PUBLIC_DRIVER_SERVICE_URL}/api/v1/driver/trips/${tripIdToUse}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch trip details: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching trip details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trip details' },
      { status: 500 }
    );
  }
}