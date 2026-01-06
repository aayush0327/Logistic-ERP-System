import { NextRequest, NextResponse } from 'next/server';

// Orders Service URL from environment
const NEXT_PUBLIC_ORDERS_SERVICE_URL = process.env.NEXT_PUBLIC_ORDERS_SERVICE_URL || 'http://localhost:8003';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params promise (Next.js 15+)
    const { id } = await params;

    // Validate order ID
    if (!id || id === 'undefined' || id.trim() === '') {
      console.log('Invalid order ID received:', id);
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    console.log('Fetching delivery documents for order:', id);

    const url = `${NEXT_PUBLIC_ORDERS_SERVICE_URL}/api/v1/orders/${id}/documents/delivery-proof`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // Forward authorization headers if any
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to fetch documents: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching delivery documents:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch delivery documents', documents: [], total: 0 },
      { status: 500 }
    );
  }
}
