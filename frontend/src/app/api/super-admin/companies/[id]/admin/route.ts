import { NextRequest, NextResponse } from 'next/server';

// PUT update tenant admin
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: tenantId } = await params;

    // Call backend API to update tenant admin
    const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/v1/companies/${tenantId}/admin`, {
      method: 'PUT',
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
    console.error('Failed to update admin:', error);
    return NextResponse.json(
      { detail: 'Failed to update admin' },
      { status: 500 }
    );
  }
}