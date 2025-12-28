/**
 * Orders Summary Cards Section
 * Displays statistics for orders (total, pending, loading, on-route, completed)
 */
'use client';

import { Card, CardContent } from '@/components/ui/Card';

export interface OrderStats {
  total: number;
  pending: number;
  loading: number;
  onRoute: number;
  completed: number;
}

interface OrdersSummaryCardsProps {
  stats: OrderStats;
}

export function OrdersSummaryCards({ stats }: OrdersSummaryCardsProps) {
  const summaryCards = [
    {
      label: 'Total Orders',
      value: stats.total,
      color: 'text-gray-900',
    },
    {
      label: 'Pending',
      value: stats.pending,
      color: 'text-yellow-600',
    },
    {
      label: 'Loading',
      value: stats.loading,
      color: 'text-blue-600',
    },
    {
      label: 'On Route',
      value: stats.onRoute,
      color: 'text-purple-600',
    },
    {
      label: 'Completed',
      value: stats.completed,
      color: 'text-green-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {summaryCards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <p className={`text-2xl font-bold ${card.color}`}>
              {card.value}
            </p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

