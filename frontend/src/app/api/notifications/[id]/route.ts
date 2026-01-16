import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_NOTIFICATIONS_API_URL || 'http://localhost:8007';

// Helper function to get token from cookie or authorization header
function getToken(request: NextRequest): string | null {
  return request.cookies.get('access_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
}

// GET /api/notifications/[id] - Get a specific notification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getToken(request);

    if (!token) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/api/notifications/${id}?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    console.error('Get notification proxy error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/[id] - Delete a notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getToken(request);

    if (!token) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${API_URL}/api/notifications/${id}?token=${encodeURIComponent(token)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 204 No Content - successful delete
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    // 404 Not Found - notification might already be deleted, treat as success
    if (response.status === 404) {
      return new NextResponse(null, { status: 204 });
    }

    return new NextResponse(null, {
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    console.error('Delete notification proxy error:', error);
    return NextResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    );
  }
}
