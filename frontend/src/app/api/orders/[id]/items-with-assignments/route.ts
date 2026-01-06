import { NextRequest, NextResponse } from 'next/server';

const ORDERS_SERVICE_URL = process.env.NEXT_PUBLIC_ORDERS_API_URL || 'http://localhost:8003';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();

    console.log('[items-with-assignments] Called with id:', id);

    // Forward the request to the orders service for items with assignments
    const response = await fetch(`${ORDERS_SERVICE_URL}/api/v1/orders/${id}/items-with-assignments${searchParams ? `?${searchParams}` : ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward authentication headers if any
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
    });

    console.log('[items-with-assignments] Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[items-with-assignments] Backend error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch order items with assignments' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[items-with-assignments] Success, data keys:', Object.keys(data));
    return NextResponse.json(data);
  } catch (error) {
    console.error('Order items-with-assignments API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
