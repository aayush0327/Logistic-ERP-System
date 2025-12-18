import { NextResponse } from 'next/server';

// Dummy branches data - will come from other service in future
const dummyBranches = [
  {
    id: 'BR-001',
    code: 'NB001',
    name: 'North Branch',
    location: 'Cairo, Egypt',
    manager: 'Ahmed Ali',
    phone: '+201000000010',
    status: 'active',
  },
  {
    id: 'BR-002',
    code: 'SB001',
    name: 'South Branch',
    location: 'Giza, Egypt',
    manager: 'Mohamed Hassan',
    phone: '+201000000011',
    status: 'active',
  },
  {
    id: 'BR-003',
    code: 'EB001',
    name: 'East Branch',
    location: 'Suez, Egypt',
    manager: 'Khalid Omar',
    phone: '+201000000012',
    status: 'active',
  },
  {
    id: 'BR-004',
    code: 'WB001',
    name: 'West Branch',
    location: 'Alexandria, Egypt',
    manager: 'Sami Mahmoud',
    phone: '+201000000013',
    status: 'active',
  },
];

export async function GET() {
  try {
    // Filter only active branches
    const activeBranches = dummyBranches.filter(branch => branch.status === 'active');
    return NextResponse.json(activeBranches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branches' },
      { status: 500 }
    );
  }
}