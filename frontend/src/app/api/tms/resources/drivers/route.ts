import { NextResponse } from 'next/server';

// Dummy drivers data - will come from other service in future
const dummyDrivers = [
  {
    id: 'DRV-001',
    name: 'Mike Johnson',
    phone: '+201234567890',
    license: 'DL-001234',
    experience: '5 years',
    status: 'active',
    currentTruck: null,
  },
  {
    id: 'DRV-002',
    name: 'Sarah Ahmed',
    phone: '+201112223333',
    license: 'DL-002345',
    experience: '3 years',
    status: 'active',
    currentTruck: null,
  },
  {
    id: 'DRV-003',
    name: 'Ali Hassan',
    phone: '+201445556666',
    license: 'DL-003456',
    experience: '7 years',
    status: 'active',
    currentTruck: null,
  },
  {
    id: 'DRV-004',
    name: 'Mohamed Ali',
    phone: '+201556667778',
    license: 'DL-004567',
    experience: '4 years',
    status: 'active',
    currentTruck: null,
  },
];

export async function GET() {
  try {
    // Filter only active drivers without current truck assignment
    const availableDrivers = dummyDrivers.filter(
      driver => driver.status === 'active' && !driver.currentTruck
    );
    return NextResponse.json(availableDrivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drivers' },
      { status: 500 }
    );
  }
}