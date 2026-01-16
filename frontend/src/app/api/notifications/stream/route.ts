import { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_NOTIFICATIONS_API_URL || 'http://localhost:8007';

// GET /api/notifications/stream - SSE endpoint for real-time notifications
export async function GET(request: NextRequest) {
  // Get token from cookie or authorization header
  const token = request.cookies.get('access_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Create a new readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Connect to the notification service SSE endpoint
        try {
          const response = await fetch(`${API_URL}/api/notifications/stream?token=${encodeURIComponent(token)}`, {
            method: 'GET',
            headers: {
              'Accept': 'text/event-stream',
            },
          });

          if (!response.ok) {
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          // Forward SSE events from the notification service to the client
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Forward the data chunk to the client
            controller.enqueue(value);
          }
        } catch (error) {
          console.error('SSE stream error:', error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('SSE endpoint error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
