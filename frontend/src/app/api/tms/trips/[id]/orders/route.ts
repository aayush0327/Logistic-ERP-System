import { NextRequest, NextResponse } from 'next/server';

const NEXT_PUBLIC_TMS_API_URL = process.env.NEXT_PUBLIC_TMS_API_URL || 'http://localhost:8004';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Unwrap the params Promise

    // Hardcoded user and company values (in production, get from authentication)
    const HARDCODED_USER_ID = "user-001";
    const HARDCODED_COMPANY_ID = "company-001";

    const queryParams = new URLSearchParams();
    queryParams.append('user_id', HARDCODED_USER_ID);
    queryParams.append('company_id', HARDCODED_COMPANY_ID);

    const response = await fetch(`${NEXT_PUBLIC_TMS_API_URL}/api/v1/trips/${id}/orders?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Trip not found' },
          { status: 404 }
        );
      }
      throw new Error(`Failed to fetch trip orders: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching trip orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trip orders' },
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

    // Hardcoded user and company values (in production, get from authentication)
    const HARDCODED_USER_ID = "user-001";
    const HARDCODED_COMPANY_ID = "company-001";

    // Add user_id and company_id to each order in the request
    const ordersData = {
      orders: body.orders.map((order: any) => ({
        ...order,
        user_id: HARDCODED_USER_ID,
        company_id: HARDCODED_COMPANY_ID,
      })),
    };

    const queryParams = new URLSearchParams();
    queryParams.append('user_id', HARDCODED_USER_ID);
    queryParams.append('company_id', HARDCODED_COMPANY_ID);

    const url = `${NEXT_PUBLIC_TMS_API_URL}/api/v1/trips/${id}/orders?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ordersData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to assign orders: ${response.statusText}`);
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

