import { NextRequest, NextResponse } from 'next/server';

const ORDERS_SERVICE_URL = process.env.NEXT_PUBLIC_ORDERS_API_URL || 'http://localhost:8003';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();

    // Forward the request to the orders service branches endpoint
    const response = await fetch(`${ORDERS_SERVICE_URL}/api/v1/resources/branches${searchParams ? `?${searchParams}` : ''}`, {
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
      return NextResponse.json(
        { error: 'Failed to fetch branches' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Branches API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}