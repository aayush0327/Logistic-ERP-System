import { NextResponse } from 'next/server';

// TMS service URL
const TMS_SERVICE_URL = process.env.NEXT_PUBLIC_TMS_API_URL || 'http://localhost:8004';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const tenant_id = searchParams.get('tenant_id') || 'default-tenant';
    const { branchId } = await params;

    // Call TMS service branch-specific trucks endpoint
    const url = `${TMS_SERVICE_URL}/api/v1/resources/branches/${branchId}/trucks?tenant_id=${tenant_id}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward authorization headers if any
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
    });

    if (!response.ok) {
      console.error('TMS service error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return NextResponse.json(
        { error: `Failed to fetch trucks from TMS service: ${response.statusText}` },
        { status: response.status }
      );
    }

    const trucks = await response.json();
    return NextResponse.json(trucks);
  } catch (error) {
    console.error('Error fetching trucks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trucks' },
      { status: 500 }
    );
  }
}