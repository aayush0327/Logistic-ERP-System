import { NextRequest, NextResponse } from 'next/server';

// Driver Service URL from environment
const NEXT_PUBLIC_DRIVER_SERVICE_URL = process.env.NEXT_PUBLIC_DRIVER_SERVICE_URL || 'http://localhost:8005';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; order_id: string }> }
) {
  try {
    // Await the params promise (Next.js 15+)
    const { id: tripId, order_id } = await params;

    // Validate trip and order IDs
    if (!tripId || tripId === 'undefined' || tripId.trim() === '') {
      console.log('Invalid trip ID received:', tripId);
      return NextResponse.json(
        { error: 'Invalid trip ID' },
        { status: 400 }
      );
    }
    if (!order_id || order_id === 'undefined' || order_id.trim() === '') {
      console.log('Invalid order ID received:', order_id);
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    console.log('Marking order as delivered:', { tripId, order_id });
    const url = `${NEXT_PUBLIC_DRIVER_SERVICE_URL}/api/v1/driver/trips/${tripId}/orders/${order_id}/deliver`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to mark order as delivered: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error marking order as delivered:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark order as delivered' },
      { status: 500 }
    );
  }
}