/**
 * Orders Page Header Section
 * Displays page title, description, and action button
 */
'use client';

import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';

interface OrdersPageHeaderProps {
  onCreateOrder: () => void;
}

export function OrdersPageHeader({ onCreateOrder }: OrdersPageHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 mt-2">
          Manage and track all customer orders
        </p>
      </div>
      <Button 
        variant="primary"
        className="flex items-center gap-2" 
        onClick={onCreateOrder}
      >
        <Plus className="w-5 h-5" />
        New Order
      </Button>
    </div>
  );
}

