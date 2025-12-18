import {
  Order,
  Trip,
  Delivery,
  Activity,
  Customer,
  AuditLog,
  Branch,
  Product,
  Truck,
  Driver,
  KPICard,
  OrderItem,
  Location
} from '@/types';

export const mockKPIs: KPICard[] = [
  { title: 'Available Trucks', value: 12, color: 'green' },
  { title: 'Overdue Customers', value: 5, subtitle: '3 days+', color: 'red' },
  { title: 'Today Deliveries', value: 24, subtitle: '18 completed', color: 'blue' },
];

export const mockOrders: Order[] = [
  {
    id: 'ORD-001',
    customer: 'John\'s Farm',
    status: 'completed',
    total: 2500,
    date: '2024-01-10',
    items: 15,
  },
  {
    id: 'ORD-002',
    customer: 'Green Valley Store',
    status: 'on-route',
    total: 1800,
    date: '2024-01-10',
    items: 8,
  },
  {
    id: 'ORD-003',
    customer: 'City Mart',
    status: 'loading',
    total: 3200,
    date: '2024-01-11',
    items: 22,
  },
];

export const mockOrderItems: OrderItem[] = [
  {
    id: 'ORD-001',
    customer: 'John\'s Farm',
    customerAddress: '123 Farm Road, Rural Area, Cairo',
    status: 'approved',
    total: 2500,
    weight: 850,
    volume: 1200,
    date: '2024-01-10',
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
    date: '2024-01-10',
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
    date: '2024-01-11',
    priority: 'high',
    items: 22,
    address: '789 Main St, Downtown'
  },
  {
    id: 'ORD-004',
    customer: 'SuperStore Chain',
    customerAddress: '321 Commercial Ave, Industrial Zone',
    status: 'pending',
    total: 4500,
    weight: 1800,
    volume: 2400,
    date: '2024-01-11',
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
    date: '2024-01-11',
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
    date: '2024-01-12',
    priority: 'high',
    items: 50,
    address: '789 Industrial Blvd, Manufacturing Zone'
  },
];

export const mockLocations: Location[] = [
  {
    id: 'LOC-001',
    name: 'North Branch',
    address: 'North Industrial Area, Cairo',
    distance: 0,
    estimatedTime: 0
  },
  {
    id: 'LOC-002',
    name: 'South Branch',
    address: 'South Commercial Zone, Giza',
    distance: 0,
    estimatedTime: 0
  },
  {
    id: 'LOC-003',
    name: 'East Branch',
    address: 'East Logistics Hub, Suez',
    distance: 0,
    estimatedTime: 0
  },
  {
    id: 'LOC-004',
    name: 'Cairo Downtown',
    address: 'Downtown Cairo, Egypt',
    distance: 15,
    estimatedTime: 45
  },
  {
    id: 'LOC-005',
    name: 'Giza City Center',
    address: 'Giza, Egypt',
    distance: 22,
    estimatedTime: 65
  },
  {
    id: 'LOC-006',
    name: 'Alexandria Port',
    address: 'Alexandria, Egypt',
    distance: 225,
    estimatedTime: 180
  },
];

export const mockTrips: Trip[] = [
  {
    id: 'TRIP-001',
    status: 'on-route',
    branch: 'North Branch',
    origin: 'North Branch',
    destination: 'Cairo Downtown',
    distance: 15,
    estimatedDuration: 90,
    preTripTime: 30,
    postTripTime: 15,
    truck: {
      plate: 'ABC-1234',
      model: 'Ford Transit',
      capacity: 2000,
    },
    driver: {
      name: 'Mike Johnson',
      phone: '+201234567890',
    },
    orders: [
      mockOrderItems[0], // ORD-001 - John's Farm
      mockOrderItems[1], // ORD-002 - Green Valley Store
    ],
    date: '2024-01-10',
    createdAt: '2024-01-10T08:00:00Z',
    capacityUsed: 1500,
    capacityTotal: 2000,
  },
  {
    id: 'TRIP-002',
    status: 'planning',
    branch: 'South Branch',
    origin: 'South Branch',
    destination: 'Giza City Center',
    distance: 22,
    estimatedDuration: 120,
    preTripTime: 30,
    postTripTime: 20,
    truck: {
      plate: 'XYZ-5678',
      model: 'Mercedes Sprinter',
      capacity: 3000,
    },
    driver: {
      name: 'Sarah Ahmed',
      phone: '+201112223333',
    },
    orders: [
      mockOrderItems[2], // ORD-003 - City Mart
      mockOrderItems[4], // ORD-005 - Local Pharmacy
    ],
    date: '2024-01-11',
    createdAt: '2024-01-11T06:00:00Z',
    capacityUsed: 1500,
    capacityTotal: 3000,
  },
  {
    id: 'TRIP-003',
    status: 'completed',
    branch: 'East Branch',
    origin: 'East Branch',
    destination: 'Alexandria Port',
    distance: 225,
    estimatedDuration: 240,
    preTripTime: 45,
    postTripTime: 30,
    truck: {
      plate: 'DEF-9012',
      model: 'Iveco Daily',
      capacity: 5000,
    },
    driver: {
      name: 'Ali Hassan',
      phone: '+201445556666',
    },
    orders: [],
    date: '2024-01-09',
    createdAt: '2024-01-09T05:00:00Z',
    capacityUsed: 0,
    capacityTotal: 5000,
  },
  {
    id: 'TRIP-004',
    status: 'truck-malfunction',
    branch: 'North Branch',
    origin: 'North Branch',
    destination: 'Cairo Downtown',
    distance: 15,
    estimatedDuration: 90,
    preTripTime: 30,
    postTripTime: 15,
    truck: {
      plate: 'GHI-3456',
      model: 'Isuzu NPR',
      capacity: 2500,
    },
    driver: {
      name: 'Mohamed Ali',
      phone: '+201556667778',
    },
    orders: [
      mockOrderItems[3], // ORD-004 - SuperStore Chain
    ],
    date: '2024-01-11',
    createdAt: '2024-01-11T07:30:00Z',
    capacityUsed: 1800,
    capacityTotal: 2500,
  },
];

export const mockDeliveries: Delivery[] = [
  {
    id: 'DEL-001',
    customer: 'John\'s Farm',
    orderIds: ['ORD-001'],
    status: 'completed',
    date: '2024-01-10 14:30',
    address: '123 Farm Road, Rural Area',
  },
  {
    id: 'DEL-002',
    customer: 'Green Valley Store',
    orderIds: ['ORD-002'],
    status: 'on-route',
    date: '2024-01-10 16:00',
    address: '456 Market St, City Center',
  },
];

export const mockActivities: Activity[] = [
  {
    id: 'ACT-001',
    type: 'order',
    action: 'Order Created',
    description: 'Order ORD-003 created for City Mart',
    timestamp: '2024-01-11 09:00',
    user: 'Admin User',
  },
  {
    id: 'ACT-002',
    type: 'trip',
    action: 'Trip Started',
    description: 'Trip TRIP-001 started from North Branch',
    timestamp: '2024-01-10 08:00',
    user: 'Mike Johnson',
  },
  {
    id: 'ACT-003',
    type: 'delivery',
    action: 'Delivery Completed',
    description: 'Delivery DEL-001 completed at John\'s Farm',
    timestamp: '2024-01-10 14:30',
    user: 'Mike Johnson',
  },
];

export const mockCustomers: Customer[] = [
  {
    id: 'CUST-001',
    code: 'CUST001',
    name: 'John\'s Farm',
    phone: '+201000000001',
    location: 'Cairo, Egypt',
    homeBranch: 'North Branch',
    businessType: 'Agriculture',
    status: 'active',
    createdAt: '2024-01-01',
  },
  {
    id: 'CUST-002',
    code: 'CUST002',
    name: 'Green Valley Store',
    phone: '+201000000002',
    location: 'Giza, Egypt',
    homeBranch: 'South Branch',
    businessType: 'Retail',
    status: 'active',
    createdAt: '2024-01-02',
  },
  {
    id: 'CUST-003',
    code: 'CUST003',
    name: 'City Mart',
    phone: '+201000000003',
    location: 'Alexandria, Egypt',
    homeBranch: 'East Branch',
    businessType: 'Retail',
    status: 'inactive',
    createdAt: '2024-01-03',
  },
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'LOG-001',
    timestamp: '2024-01-11 10:30:00',
    user: 'Salah (Admin)',
    action: 'CREATE',
    module: 'Orders',
    recordId: 'ORD-003',
    details: 'Created new order for City Mart',
  },
  {
    id: 'LOG-002',
    timestamp: '2024-01-11 10:25:00',
    user: 'Salah (Admin)',
    action: 'UPDATE',
    module: 'Customers',
    recordId: 'CUST-001',
    details: 'Updated customer phone number',
  },
  {
    id: 'LOG-003',
    timestamp: '2024-01-11 10:20:00',
    user: 'Salah (Admin)',
    action: 'LOGIN',
    module: 'Authentication',
    recordId: 'N/A',
    details: 'User logged in successfully',
  },
];

export const mockBranches: Branch[] = [
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

export const mockProducts: Product[] = [
  {
    id: 'PROD-001',
    code: 'FEED001',
    name: 'Animal Feed Premium',
    category: 'Feed',
    unit: 'kg',
    price: 15.5,
    status: 'active',
  },
  {
    id: 'PROD-002',
    code: 'MED001',
    name: 'Vitamin Supplement',
    category: 'Medicine',
    unit: 'bottle',
    price: 120.0,
    status: 'active',
  },
];

export const mockTrucks: Truck[] = [
  {
    id: 'TRK-001',
    plate: 'ABC-1234',
    model: 'Ford Transit',
    capacity: 2000,
    driver: 'Mike Johnson',
    status: 'on-duty',
  },
  {
    id: 'TRK-002',
    plate: 'XYZ-5678',
    model: 'Mercedes Sprinter',
    capacity: 3000,
    status: 'available',
  },
];

export const mockDrivers: Driver[] = [
  {
    id: 'DRV-001',
    name: 'Mike Johnson',
    phone: '+201234567890',
    license: 'DL-001234',
    experience: '5 years',
    status: 'active',
    currentTruck: 'ABC-1234',
  },
  {
    id: 'DRV-002',
    name: 'Sarah Ahmed',
    phone: '+201112223333',
    license: 'DL-002345',
    experience: '3 years',
    status: 'active',
  },
];