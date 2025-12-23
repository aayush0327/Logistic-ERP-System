import { NextRequest, NextResponse } from 'next/server';

const TMS_SERVICE_URL = process.env.NEXT_PUBLIC_TMS_API_URL || 'http://localhost:8004';

// Helper function to get auth token from request
function getAuthToken(request: NextRequest): string | null {
  // Try to get token from Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try to get token from cookies (if using httpOnly cookies)
  const tokenCookie = request.cookies.get('access_token');
  return tokenCookie?.value || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Unwrap the params Promise

    // Get auth token
    const token = getAuthToken(request);

    const response = await fetch(`${TMS_SERVICE_URL}/api/v1/trips/${id}/orders`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Trip not found' },
          { status: 404 }
        );
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to fetch trip orders: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching trip orders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch trip orders' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Unwrap the params Promise
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');

    if (!orderId) {
      return NextResponse.json(
        { error: 'order_id parameter is required' },
        { status: 400 }
      );
    }

    // Get auth token
    const token = getAuthToken(request);

    // The backend will handle user_id and company_id from JWT token
    const response = await fetch(`${TMS_SERVICE_URL}/api/v1/trips/${id}/orders/remove?order_id=${orderId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to remove order: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error removing order:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove order' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await params; // Unwrap the params Promise

    // Get auth token
    const token = getAuthToken(request);

    // The backend will handle user_id and company_id from JWT token
    // So we don't need to add them here
    const ordersData = {
      orders: body.orders || body, // Handle both wrapped and unwrapped formats
    };

    const response = await fetch(`${TMS_SERVICE_URL}/api/v1/trips/${id}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(ordersData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Failed to assign orders: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('Error assigning orders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign orders' },
      { status: 500 }
    );
  }
}

