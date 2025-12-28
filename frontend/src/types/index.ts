export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface KPICard {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "green" | "blue" | "yellow" | "red" | "purple";
}

export interface Order {
  id: string;
  customer: string;
  status: "pending" | "loading" | "on-route" | "completed";
  total: number;
  date: string;
  items: number;
}

export interface Trip {
  id: string;
  status:
    | "planning"
    | "loading"
    | "on-route"
    | "completed"
    | "cancelled"
    | "truck-malfunction";
  branch: string;
  origin?: string;
  destination?: string;
  distance?: number;
  estimatedDuration?: number;
  preTripTime?: number;
  postTripTime?: number;
  truck?: {
    plate: string;
    model: string;
    capacity: number;
  };
  driver?: {
    name: string;
    phone: string;
  };
  orders: OrderItem[];
  date: string;
  createdAt?: string;
  capacityUsed?: number;
  capacityTotal?: number;
}

export interface OrderItem {
  id: string;
  order_id?: string;
  customer: string;
  customerAddress?: string;
  status:
    | "approved"
    | "pending"
    | "assigned"
    | "loading"
    | "on-route"
    | "completed";
  total: number;
  weight: number;
  volume: number;
  date: string;
  priority: 'high' | 'medium' | 'low' | 'normal';
  items: number;
  quantity?: number;
  address?: string;
  originalOrderId?: string;
  originalItems?: number;
  originalWeight?: number;
  sequence_number?: number;
  delivery_status?: string;
}

export interface TripPlan {
  id: string;
  orders: OrderItem[];
  totalWeight: number;
  totalVolume: number;
  estimatedCapacity: number;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  distance?: number;
  estimatedTime?: number;
}

export interface Delivery {
  id: string;
  customer: string;
  orderIds: string[];
  status: "completed" | "on-route";
  date: string;
  address: string;
}

export interface Activity {
  id: string;
  type: "order" | "trip" | "delivery";
  action: string;
  description: string;
  timestamp: string;
  user: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  location: string;
  homeBranch: string;
  businessType: string;
  status: "active" | "inactive";
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  module: string;
  recordId: string;
  details?: string;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  location: string;
  manager: string;
  phone: string;
  status: "active" | "inactive";
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  status: "active" | "inactive";
}

export interface Truck {
  id: string;
  plate: string;
  model: string;
  capacity: number;
  driver?: string;
  status: "available" | "on-duty" | "maintenance";
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  license: string;
  experience: string;
  status: "available" | "on_trip" | "off_duty" | "on_leave" | "suspended";
  currentTruck?: string | null;
  branch_id?: string | null;
  user_id?: string | null;
}
