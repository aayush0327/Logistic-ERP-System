import { NextRequest, NextResponse } from 'next/server';

// TMS Service URL from environment
const TMS_SERVICE_URL = process.env.NEXT_PUBLIC_TMS_API_URL || 'http://localhost:8004';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();

    // Forward the request to the TMS service orders endpoint
    const response = await fetch(`${TMS_SERVICE_URL}/api/v1/resources/orders${searchParams ? `?${searchParams}` : ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward authentication headers if any
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
    });

    if (!response.ok) {
      console.error('TMS service error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);

      // Don't fall back to dummy data - return the actual error
      return NextResponse.json(
        { error: `Failed to fetch orders from TMS service: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter out rejected orders, but show all other orders including drafts
    // This allows TMS to see draft orders and handle them appropriately
    const filteredOrders = data.filter((order: { status: string }) =>
      order.status !== 'finance_rejected' &&
      order.status !== 'logistics_rejected'
    );
    return NextResponse.json(filteredOrders);

  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}