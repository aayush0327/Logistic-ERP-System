import { NextRequest, NextResponse } from 'next/server';

// TMS Service URL from environment
const NEXT_PUBLIC_TMS_API_URL = process.env.NEXT_PUBLIC_TMS_API_URL || 'http://localhost:8004';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const branch = searchParams.get('branch');
    const date = searchParams.get('date');

    // Hardcoded user and company values (in production, get from authentication)
    const HARDCODED_USER_ID = "user-001";
    const HARDCODED_COMPANY_ID = "company-001";

    // Build query string for TMS service
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    if (branch) queryParams.append('branch', branch);
    if (date) queryParams.append('date', date);
    queryParams.append('user_id', HARDCODED_USER_ID);
    queryParams.append('company_id', HARDCODED_COMPANY_ID);

    const url = `${NEXT_PUBLIC_TMS_API_URL}/api/v1/trips${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch trips: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching trips:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trips' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Hardcoded user and company values (in production, get from authentication)
    const HARDCODED_USER_ID = "user-001";
    const HARDCODED_COMPANY_ID = "company-001";

    // Add user_id and company_id to the request body
    const tripData = {
      ...body,
      user_id: HARDCODED_USER_ID,
      company_id: HARDCODED_COMPANY_ID,
    };

    const response = await fetch(`${NEXT_PUBLIC_TMS_API_URL}/api/v1/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tripData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to create trip: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('Error creating trip:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create trip' },
      { status: 500 }
    );
  }
}