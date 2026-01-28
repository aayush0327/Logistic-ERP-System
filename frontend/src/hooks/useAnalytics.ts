import { useState, useEffect, useCallback } from "react";
import {
  analyticsAPI,
  DateRange,
  DashboardSummary,
  OrderStatusCountsResponse,
  OrderStatusDurationsResponse,
  OrderLifecycleTimesResponse,
  OrderBottlenecksResponse,
  TripStatusCountsResponse,
  TripStatusDurationsResponse,
  TripLifecycleTimesResponse,
  TripInefficienciesResponse,
  DriverStatusCountsResponse,
  DriverUtilizationResponse,
  TruckStatusCountsResponse,
  TruckUtilizationResponse,
  EntityTimelineResponse,
  OrdersListResponse,
  TripsListResponse,
} from "@/services/analytics";

// Generic hook for API calls with loading and error states
function useAnalyticsData<T>(
  fetcher: (dateRange: DateRange) => Promise<T>,
  dateRange: DateRange,
  enabled: boolean = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Use JSON stringified dateRange for stable dependency
  const dateRangeKey = JSON.stringify(dateRange);

  useEffect(() => {
    if (!enabled) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetcher(dateRange);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRangeKey, enabled]);

  const refetch = useCallback(() => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    fetcher(dateRange)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "An error occurred"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRangeKey, enabled]);

  return { data, loading, error, refetch };
}

// Dashboard Summary Hook
export function useDashboardSummary(dateRange: DateRange) {
  return useAnalyticsData<DashboardSummary>(
    analyticsAPI.getDashboardSummary.bind(analyticsAPI),
    dateRange
  );
}

// Order Analytics Hooks
export function useOrderStatusCounts(dateRange: DateRange) {
  return useAnalyticsData<OrderStatusCountsResponse>(
    analyticsAPI.getOrderStatusCounts.bind(analyticsAPI),
    dateRange
  );
}

export function useOrderStatusDurations(dateRange: DateRange) {
  return useAnalyticsData<OrderStatusDurationsResponse>(
    analyticsAPI.getOrderStatusDurations.bind(analyticsAPI),
    dateRange
  );
}

export function useOrderLifecycleTimes(dateRange: DateRange) {
  return useAnalyticsData<OrderLifecycleTimesResponse>(
    analyticsAPI.getOrderLifecycleTimes.bind(analyticsAPI),
    dateRange
  );
}

export function useOrderBottlenecks(dateRange: DateRange, thresholdHours: number = 4) {
  const fetcher = useCallback(
    (dr: DateRange) =>
      analyticsAPI.getOrderBottlenecks(dr, thresholdHours),
    [thresholdHours]
  );
  return useAnalyticsData<OrderBottlenecksResponse>(fetcher, dateRange);
}

// Trip Analytics Hooks
export function useTripStatusCounts(dateRange: DateRange) {
  return useAnalyticsData<TripStatusCountsResponse>(
    analyticsAPI.getTripStatusCounts.bind(analyticsAPI),
    dateRange
  );
}

export function useTripStatusDurations(dateRange: DateRange) {
  return useAnalyticsData<TripStatusDurationsResponse>(
    analyticsAPI.getTripStatusDurations.bind(analyticsAPI),
    dateRange
  );
}

export function useTripLifecycleTimes(dateRange: DateRange) {
  return useAnalyticsData<TripLifecycleTimesResponse>(
    analyticsAPI.getTripLifecycleTimes.bind(analyticsAPI),
    dateRange
  );
}

export function useTripInefficiencies(dateRange: DateRange) {
  return useAnalyticsData<TripInefficienciesResponse>(
    analyticsAPI.getTripInefficiencies.bind(analyticsAPI),
    dateRange
  );
}

// Driver Analytics Hooks
export function useDriverStatusCounts(dateRange: DateRange) {
  return useAnalyticsData<DriverStatusCountsResponse>(
    analyticsAPI.getDriverStatusCounts.bind(analyticsAPI),
    dateRange
  );
}

export function useDriverUtilization(dateRange: DateRange) {
  return useAnalyticsData<DriverUtilizationResponse>(
    analyticsAPI.getDriverUtilization.bind(analyticsAPI),
    dateRange
  );
}

// Truck Analytics Hooks
export function useTruckStatusCounts(dateRange: DateRange) {
  return useAnalyticsData<TruckStatusCountsResponse>(
    analyticsAPI.getTruckStatusCounts.bind(analyticsAPI),
    dateRange
  );
}

export function useTruckUtilization(dateRange: DateRange) {
  return useAnalyticsData<TruckUtilizationResponse>(
    analyticsAPI.getTruckUtilization.bind(analyticsAPI),
    dateRange
  );
}

// Entity Timeline Hook
export function useEntityTimeline(
  entityType: "order" | "trip" | "driver" | "truck",
  entityId: string,
  enabled: boolean = false
) {
  const [data, setData] = useState<EntityTimelineResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !entityId) return;

    const fetchTimeline = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await analyticsAPI.getEntityTimeline(entityType, entityId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [entityType, entityId, enabled]);

  const refetch = useCallback(() => {
    if (!enabled || !entityId) return;

    setLoading(true);
    setError(null);

    analyticsAPI.getEntityTimeline(entityType, entityId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "An error occurred"))
      .finally(() => setLoading(false));
  }, [entityType, entityId, enabled]);

  return { data, loading, error, refetch };
}

// Recent Orders Hook (for dashboard preview)
export function useRecentOrders(limit: number = 3) {
  const [data, setData] = useState<OrdersListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentOrders = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await analyticsAPI.getOrdersList(1, limit);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchRecentOrders();
  }, [limit]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);

    analyticsAPI.getOrdersList(1, limit)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "An error occurred"))
      .finally(() => setLoading(false));
  }, [limit]);

  return { data, loading, error, refetch };
}

// Recent Trips Hook (for dashboard preview)
export function useRecentTrips(limit: number = 3) {
  const [data, setData] = useState<TripsListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentTrips = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await analyticsAPI.getTripsList(1, limit);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchRecentTrips();
  }, [limit]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);

    analyticsAPI.getTripsList(1, limit)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "An error occurred"))
      .finally(() => setLoading(false));
  }, [limit]);

  return { data, loading, error, refetch };
}

// Combined hook for all dashboard data
export function useAnalyticsDashboard(dateRange: DateRange) {
  const summary = useDashboardSummary(dateRange);
  const orderStatuses = useOrderStatusCounts(dateRange);
  const tripStatuses = useTripStatusCounts(dateRange);
  const orderBottlenecks = useOrderBottlenecks(dateRange);
  const driverUtil = useDriverUtilization(dateRange);
  const truckUtil = useTruckUtilization(dateRange);

  return {
    summary: summary.data,
    orderStatuses: orderStatuses.data,
    tripStatuses: tripStatuses.data,
    orderBottlenecks: orderBottlenecks.data,
    driverUtilization: driverUtil.data,
    truckUtilization: truckUtil.data,
    loading:
      summary.loading ||
      orderStatuses.loading ||
      tripStatuses.loading ||
      orderBottlenecks.loading ||
      driverUtil.loading ||
      truckUtil.loading,
    error:
      summary.error ||
      orderStatuses.error ||
      tripStatuses.error ||
      orderBottlenecks.error ||
      driverUtil.error ||
      truckUtil.error,
    refetch: () => {
      summary.refetch();
      orderStatuses.refetch();
      tripStatuses.refetch();
      orderBottlenecks.refetch();
      driverUtil.refetch();
      truckUtil.refetch();
    },
  };
}
