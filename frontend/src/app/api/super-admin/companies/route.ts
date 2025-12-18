import { NextRequest, NextResponse } from 'next/server';

// GET all companies (tenants)
export async function GET(request: NextRequest) {
  try {
    // Get token from request header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { detail: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // Call backend API
    const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/v1/companies/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch companies:', error);
    return NextResponse.json(
      { detail: 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}

// POST create new company (without admin)
export async function POST(request: NextRequest) {
  try {
    // Get token from request header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { detail: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const body = await request.json();

    // Call backend API
    const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/v1/companies/create_tenant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to create company:', error);
    return NextResponse.json(
      { detail: 'Failed to create company' },
      { status: 500 }
    );
  }
}