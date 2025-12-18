import { NextResponse } from 'next/server';

// Dummy orders data - will come from other service in future
const dummyOrders = [
  {
    id: 'ORD-001',
    customer: "John's Farm",
    customerAddress: '123 Farm Road, Rural Area, Cairo',
    status: 'approved',
    total: 2500,
    weight: 850,
    volume: 1200,
    date: '2024-12-13',
    priority: 'high',
    items: 15,
    address: '123 Farm Road, Rural Area, Cairo'
  },
  {
    id: 'ORD-002',
    customer: 'Green Valley Store',
    customerAddress: '456 Market St, City Center',
    status: 'approved',
    total: 1800,
    weight: 650,
    volume: 950,
    date: '2024-12-13',
    priority: 'medium',
    items: 8,
    address: '456 Market St, City Center'
  },
  {
    id: 'ORD-003',
    customer: 'City Mart',
    customerAddress: '789 Main St, Downtown',
    status: 'approved',
    total: 3200,
    weight: 1200,
    volume: 1800,
    date: '2024-12-14',
    priority: 'high',
    items: 22,
    address: '789 Main St, Downtown'
  },
  {
    id: 'ORD-004',
    customer: 'SuperStore Chain',
    customerAddress: '321 Commercial Ave, Industrial Zone',
    status: 'approved',
    total: 4500,
    weight: 1800,
    volume: 2400,
    date: '2024-12-14',
    priority: 'low',
    items: 35,
    address: '321 Commercial Ave, Industrial Zone'
  },
  {
    id: 'ORD-005',
    customer: 'Local Pharmacy',
    customerAddress: '555 Health St, Medical District',
    status: 'approved',
    total: 1500,
    weight: 300,
    volume: 450,
    date: '2024-12-14',
    priority: 'high',
    items: 12,
    address: '555 Health St, Medical District'
  },
  {
    id: 'ORD-006',
    customer: 'Heavy Industry Corp',
    customerAddress: '789 Industrial Blvd, Manufacturing Zone',
    status: 'approved',
    total: 50000,
    weight: 10000,
    volume: 2500,
    date: '2024-12-15',
    priority: 'high',
    items: 50,
    address: '789 Industrial Blvd, Manufacturing Zone'
  },
];

export async function GET() {
  try {
    // Filter only approved orders
    const approvedOrders = dummyOrders.filter(order => order.status === 'approved');
    return NextResponse.json(approvedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}