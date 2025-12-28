'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';

interface ProfileCompletionProps {
  percentage: number;
  missing_fields?: string[];
}

export function ProfileCompletion({ percentage, missing_fields = [] }: ProfileCompletionProps) {
  const getStatusColor = () => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = () => {
    if (percentage >= 80) return <CheckCircle className="w-5 h-5" />;
    if (percentage >= 50) return <AlertCircle className="w-5 h-5" />;
    return <Circle className="w-5 h-5" />;
  };

  const getStatusText = () => {
    if (percentage >= 80) return 'Excellent';
    if (percentage >= 50) return 'Good';
    if (percentage >= 30) return 'Fair';
    return 'Poor';
  };

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="p-4">
        <div className="flex items-center space-x-3">
          <div className={getStatusColor()}>
            {getStatusIcon()}
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-medium text-gray-700">Profile Completion</span>
              <span className={`text-sm font-bold ${getStatusColor()}`}>
                {percentage}%
              </span>
            </div>
            <Progress value={percentage} className="h-2 mb-2" />
            <div className="flex justify-between items-center">
              <span className={`text-xs font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
          </div>
        </div>

        {missing_fields.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs font-medium text-gray-700 mb-2">
              Missing Information ({missing_fields.length} items):
            </p>
            <div className="space-y-1">
              {missing_fields.slice(0, 5).map((field, index) => (
                <div key={index} className="flex items-center text-xs text-gray-600">
                  <Circle className="w-2 h-2 mr-2 fill-current" />
                  {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
              ))}
              {missing_fields.length > 5 && (
                <p className="text-xs text-gray-500 italic">
                  ...and {missing_fields.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}