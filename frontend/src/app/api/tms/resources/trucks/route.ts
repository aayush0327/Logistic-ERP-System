import { NextResponse } from 'next/server';

// Dummy trucks data - will come from other service in future
const dummyTrucks = [
  {
    id: 'TRK-001',
    plate: 'ABC-1234',
    model: 'Ford Transit',
    capacity: 2000,
    status: 'available',
  },
  {
    id: 'TRK-002',
    plate: 'XYZ-5678',
    model: 'Mercedes Sprinter',
    capacity: 3000,
    status: 'available',
  },
  {
    id: 'TRK-003',
    plate: 'DEF-9012',
    model: 'Iveco Daily',
    capacity: 5000,
    status: 'available',
  },
  {
    id: 'TRK-004',
    plate: 'GHI-3456',
    model: 'Isuzu NPR',
    capacity: 2500,
    status: 'available',
  },
  {
    id: 'TRK-005',
    plate: 'JKL-7890',
    model: 'Ford Transit',
    capacity: 2000,
    status: 'available',
  },
];

export async function GET() {
  try {
    // Filter only available trucks
    const availableTrucks = dummyTrucks.filter(truck => truck.status === 'available');
    return NextResponse.json(availableTrucks);
  } catch (error) {
    console.error('Error fetching trucks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trucks' },
      { status: 500 }
    );
  }
}