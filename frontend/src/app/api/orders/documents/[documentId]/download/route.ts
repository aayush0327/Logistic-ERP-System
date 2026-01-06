import { NextRequest, NextResponse } from 'next/server';

// Orders Service URL from environment
const NEXT_PUBLIC_ORDERS_SERVICE_URL = process.env.NEXT_PUBLIC_ORDERS_SERVICE_URL || 'http://localhost:8003';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    // Await the params promise (Next.js 15+)
    const { documentId } = await params;

    // Validate document ID
    if (!documentId || documentId === 'undefined' || documentId.trim() === '') {
      console.error('Invalid document ID:', documentId);
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    console.log('=== PROXY DOWNLOAD ===');
    console.log('Document ID:', documentId);
    console.log('Auth header present:', !!request.headers.get('authorization'));

    const url = `${NEXT_PUBLIC_ORDERS_SERVICE_URL}/api/v1/orders/documents/${documentId}/download`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // Forward authorization headers if any - use same pattern as other working APIs
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to download document:', errorData);
      return NextResponse.json(
        { error: errorData.detail || 'Failed to download document' },
        { status: response.status }
      );
    }

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    console.log('Content-Type:', contentType);

    // Get the file blob
    const blob = await response.blob();
    console.log('Blob size:', blob.size);

    // Return the file with proper headers
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': response.headers.get('content-disposition') || 'attachment',
      },
    });

  } catch (error) {
    console.error('=== DOWNLOAD ERROR ===');
    console.error('Error downloading document:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download document' },
      { status: 500 }
    );
  }
}
