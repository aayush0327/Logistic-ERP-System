import { NextRequest, NextResponse } from 'next/server';

// Driver Service URL from environment
const NEXT_PUBLIC_DRIVER_SERVICE_URL = process.env.NEXT_PUBLIC_DRIVER_SERVICE_URL || 'http://localhost:8005';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; order_id: string } }
) {
  try {
    const { id: tripId, order_id } = params;

    const url = `${NEXT_PUBLIC_DRIVER_SERVICE_URL}/api/v1/driver/trips/${tripId}/orders/${order_id}/status`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch order status: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching order status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order status' },
      { status: 500 }
    );
  }
}