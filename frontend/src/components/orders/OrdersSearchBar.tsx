/**
 * Orders Search Bar Section
 * Search input for filtering orders
 */
'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { Search } from 'lucide-react';

interface OrdersSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
}

export function OrdersSearchBar({ 
  searchQuery, 
  onSearchChange,
  placeholder = "Search orders by customer, ID, or status..."
}: OrdersSearchBarProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="
              w-full pl-10 pr-4 py-2
              text-gray-900 placeholder-gray-400
              border border-gray-300 rounded-lg
              outline-none
              transition-all duration-200 ease-in-out
              focus:border-blue-500
              focus:ring-1 focus:ring-blue-500/40
              focus:shadow-md
            "
          />
        </div>
      </CardContent>
    </Card>
  );
}

