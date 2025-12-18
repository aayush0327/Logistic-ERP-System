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

    const response = await fetch(`${NEXT_PUBLIC_TMS_API_URL}/api/v1/trips/${id}?${queryParams.toString()}`, {
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
      throw new Error(`Failed to fetch trip: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching trip:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trip' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await params; // Unwrap the params Promise

    // Hardcoded user and company values (in production, get from authentication)
    const HARDCODED_USER_ID = "user-001";
    const HARDCODED_COMPANY_ID = "company-001";

    const queryParams = new URLSearchParams();
    queryParams.append('user_id', HARDCODED_USER_ID);
    queryParams.append('company_id', HARDCODED_COMPANY_ID);

    const response = await fetch(`${NEXT_PUBLIC_TMS_API_URL}/api/v1/trips/${id}?${queryParams.toString()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update trip: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error updating trip:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update trip' },
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

    // Hardcoded user and company values (in production, get from authentication)
    const HARDCODED_USER_ID = "user-001";
    const HARDCODED_COMPANY_ID = "company-001";

    const queryParams = new URLSearchParams();
    queryParams.append('user_id', HARDCODED_USER_ID);
    queryParams.append('company_id', HARDCODED_COMPANY_ID);

    const response = await fetch(`${NEXT_PUBLIC_TMS_API_URL}/api/v1/trips/${id}?${queryParams.toString()}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to delete trip: ${response.statusText}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting trip:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete trip' },
      { status: 500 }
    );
  }
}