import { NextRequest, NextResponse } from 'next/server';

// TMS Service URL from environment
const TMS_SERVICE_URL = process.env.NEXT_PUBLIC_TMS_API_URL || 'http://localhost:8004';

// Helper function to get auth token from request
function getAuthToken(request: NextRequest): string | null {
  // Try to get token from Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try to get token from cookies (if using httpOnly cookies)
  const tokenCookie = request.cookies.get('access_token');
  return tokenCookie?.value || null;
}

// Dummy drivers data as fallback
const dummyDrivers = [
  {
    id: 'DRV-001',
    name: 'Mike Johnson',
    phone: '+201234567890',
    license: 'DL-001234',
    experience: '5 years',
    status: 'available',
    currentTruck: null,
  },
  {
    id: 'DRV-002',
    name: 'Sarah Ahmed',
    phone: '+201112223333',
    license: 'DL-002345',
    experience: '3 years',
    status: 'available',
    currentTruck: null,
  },
  {
    id: 'DRV-003',
    name: 'Ali Hassan',
    phone: '+201445556666',
    license: 'DL-003456',
    experience: '7 years',
    status: 'available',
    currentTruck: null,
  },
  {
    id: 'DRV-004',
    name: 'Mohamed Ali',
    phone: '+201556667778',
    license: 'DL-004567',
    experience: '4 years',
    status: 'available',
    currentTruck: null,
  },
];

export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const token = getAuthToken(request);
    console.log("FRONTEND API - Fetching drivers, token present:", !!token);

    // Try to fetch from resource service first
    try {
      const response = await fetch(`${TMS_SERVICE_URL}/api/v1/resources/drivers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      console.log("FRONTEND API - TMS service response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("FRONTEND API - driver data from backend:", data);
        console.log("FRONTEND API - Total drivers received:", data?.length || 0);

        // Log each driver status for debugging
        if (Array.isArray(data)) {
          data.forEach((driver: any) => {
            console.log(`FRONTEND API - Driver: ${driver.name}, status: ${driver.status}, currentTruck: ${driver.currentTruck}`);
          });
        }

        // Filter only available drivers without current truck assignment
        const availableDrivers = data.filter(
          (driver: any) => driver.status === 'available' && !driver.currentTruck
        );
        console.log("FRONTEND API - filtered drivers:", availableDrivers);
        console.log("FRONTEND API - Available drivers count:", availableDrivers.length);
        return NextResponse.json(availableDrivers);
      } else {
        const errorText = await response.text();
        console.error("FRONTEND API - TMS service error:", response.status, errorText);
      }
    } catch (error) {
      console.warn('FRONTEND API - Resource service not available, using dummy data:', error);
    }

    // Fallback to dummy data
    const availableDrivers = dummyDrivers.filter(
      driver => driver.status === 'available' && !driver.currentTruck
    );
    console.log("FRONTEND API - Using dummy drivers, count:", availableDrivers.length);
    return NextResponse.json(availableDrivers);

  } catch (error) {
    console.error('FRONTEND API - Error fetching drivers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch drivers' },
      { status: 500 }
    );
  }
}