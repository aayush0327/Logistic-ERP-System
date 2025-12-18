import { NextRequest, NextResponse } from 'next/server';

// POST create new admin user
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
    const tenantId = body.tenant_id;

    // Call backend API to create user for tenant
    const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/v1/tenants/${tenantId}/users`, {
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
    console.error('Failed to create admin user:', error);
    return NextResponse.json(
      { detail: 'Failed to create admin user' },
      { status: 500 }
    );
  }
}