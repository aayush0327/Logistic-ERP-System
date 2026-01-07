import { ProductCategory, Role } from "@/services/api/companyApi";

export interface OrderAssignData {
  //   user_id: string;
  //   company_id: string;
  order_id: string;
  customer: string;
  customerAddress?: string;
  total: number;
  weight: number;
  volume: number;
  items: number;
  priority: string;
  address?: string;
  original_order_id?: string;
  original_items?: number;
  original_weight?: number;
  items_json?: any[];
  remaining_items_json?: any[];
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  experience: string;
  license: string;
  status: string;
  currentTruck?: string | null;
  branch_id?: string | null;
  user_id?: string | null;
}

export interface Trip {
  id: string;
  status: string;
  date: string;
  origin: string;
  destination: string;
  truck?: {
    plate: string;
    model: string;
  };
  driver?: {
    name: string;
    phone: string;
  };
  capacityTotal: number;
  capacityUsed: number;
  orders: TripOrder[];
  maintenanceNote?: string;
}

export interface TripOrder {
  id: string;
  customer: string;
  priority: string;
  items: number;
  weight: number;
  items_data?: OrderItem[];
  items_count?: number;
  customerAddress?: string;
  address?: string;
  total?: number;
  volume?: number;
  status?: string;
  delivery_status?: string;
  sequence_number?: number;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code?: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price?: number;
  total_price?: number;
  weight?: number;
  total_weight?: number;
  volume?: number;
  weight_type?: string;
  fixed_weight?: number;
  weight_unit?: string;
}

export interface getProductCategoryResponse{
  items:ProductCategory[],
  page:number,
  pages:number,
  per_Page:number,
  total:number,
}

export interface getRoleAPIResponse{
  items:Role[],
  page:number,
  pages:number,
  per_page:number,
  total:number,
}