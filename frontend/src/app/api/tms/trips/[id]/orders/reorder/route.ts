import { NextRequest, NextResponse } from 'next/server';

const NEXT_PUBLIC_TMS_API_URL = process.env.NEXT_PUBLIC_TMS_API_URL || 'http://localhost:8004';

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

    // Forward the reorder request to TMS service
    const reorderUrl = `${NEXT_PUBLIC_TMS_API_URL}/api/v1/trips/${id}/orders/reorder?${queryParams.toString()}`;

    const response = await fetch(reorderUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to reorder orders: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error reordering orders:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder orders' },
      { status: 500 }
    );
  }
}