import { NextRequest, NextResponse } from 'next/server';

// Driver Service URL from environment
const NEXT_PUBLIC_DRIVER_SERVICE_URL = process.env.NEXT_PUBLIC_DRIVER_SERVICE_URL || 'http://localhost:8005';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; order_id: string }> }
) {
  try {
    // Await the params promise (Next.js 15+)
    const { id: tripId, order_id } = await params;

    // Validate trip and order IDs
    if (!tripId || tripId === 'undefined' || tripId.trim() === '') {
      console.log('Invalid trip ID received:', tripId);
      return NextResponse.json(
        { error: 'Invalid trip ID' },
        { status: 400 }
      );
    }

    if (!order_id || order_id === 'undefined' || order_id.trim() === '') {
      console.log('Invalid order ID received:', order_id);
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('document_type') as string | null;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('Uploading delivery proof document for order:', order_id, 'in trip:', tripId);

    // Create a new FormData for the driver service
    const driverFormData = new FormData();
    driverFormData.append('file', file);
    driverFormData.append('document_type', documentType || 'delivery_proof');
    driverFormData.append('title', title || 'Delivery Proof');
    driverFormData.append('description', description || 'Document uploaded by driver upon delivery');

    const url = `${NEXT_PUBLIC_DRIVER_SERVICE_URL}/api/v1/driver/trips/${tripId}/orders/${order_id}/upload-document`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        // Forward authorization headers if any
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
      body: driverFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to upload delivery proof: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error uploading delivery proof:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload delivery proof' },
      { status: 500 }
    );
  }
}
