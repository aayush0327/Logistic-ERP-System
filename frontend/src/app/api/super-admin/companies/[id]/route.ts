import { NextRequest, NextResponse } from 'next/server';

// PUT update tenant status or details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params to get the id
    const { id: tenantId } = await params;

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
    const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/v1/companies/${tenantId}`, {
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
    console.error('Failed to update tenant:', error);
    return NextResponse.json(
      { detail: 'Failed to update company' },
      { status: 500 }
    );
  }
}

// DELETE deactivate tenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params to get the id
    const { id: tenantId } = await params;

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
    const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/v1/companies/${tenantId}`, {
      method: 'DELETE',
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
    console.error('Failed to delete tenant:', error);
    return NextResponse.json(
      { detail: 'Failed to delete company' },
      { status: 500 }
    );
  }
}