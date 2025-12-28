"use client";

import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page Header Skeleton */}
      <div>
        <Skeleton variant="line" height="2.25rem" width="12rem" />
        <Skeleton variant="line" height="1rem" width="24rem" className="mt-2" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <Skeleton variant="rectangle" width="3.5rem" height="3.5rem" />
                <div className="text-right space-y-2">
                  <Skeleton
                    variant="line"
                    height="2rem"
                    width="4rem"
                    className="ml-auto"
                  />
                  <Skeleton variant="line" height="0.875rem" width="6rem" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton variant="line" height="1.5rem" width="8rem" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                variant="rectangle"
                height="5rem"
                width="100%"
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton variant="line" height="1.5rem" width="8rem" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
              >
                <Skeleton variant="circle" width="0.5rem" height="0.5rem" />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="line" height="0.875rem" width="40%" />
                  <Skeleton variant="line" height="0.75rem" width="60%" />
                </div>
                <Skeleton variant="line" height="0.75rem" width="4rem" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
