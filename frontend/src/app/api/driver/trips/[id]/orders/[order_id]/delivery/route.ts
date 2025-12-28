import { NextRequest, NextResponse } from 'next/server';

// Driver Service URL from environment
const NEXT_PUBLIC_DRIVER_SERVICE_URL = process.env.NEXT_PUBLIC_DRIVER_SERVICE_URL || 'http://localhost:8005';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; order_id: string }> }
) {
  try {
    const { id: tripId, order_id } = await params;
    const body = await request.json();

    const url = `${NEXT_PUBLIC_DRIVER_SERVICE_URL}/api/v1/driver/trips/${tripId}/orders/${order_id}/delivery`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        // Forward authorization headers if any
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update delivery status: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error updating delivery status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update delivery status' },
      { status: 500 }
    );
  }
}