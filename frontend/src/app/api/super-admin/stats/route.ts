import { NextRequest, NextResponse } from 'next/server';

// GET companies statistics
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
    const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/v1/admin/stats`, {
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
    console.error('Failed to fetch stats:', error);
    return NextResponse.json(
      { detail: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}