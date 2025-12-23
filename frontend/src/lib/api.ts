// Client-side API helper functions

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface User {
  id: string;
  email: string;
  role_id: number;
  tenant_id?: string | null;  // Nullable for super admins
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
  login_attempts?: number;
  locked_until?: string;
  role?: {
    id: number;
    name: string;
    description?: string;
  };
  tenant?: {
    id: string;
    name: string;
    domain?: string;
  };
}

class ApiHelper {
  private isRefreshing = false;
  private refreshSubscribers: ((token: string | null) => void)[] = [];
  private latestAccessToken: string | null = null;
  private latestRefreshToken: string | null = null;

  // Get the stored token from localStorage and verify with cookies
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      // First check if we have a recently refreshed token
      if (this.latestAccessToken) {
        return this.latestAccessToken;
      }

      // Get token from localStorage
      const token = localStorage.getItem('access_token');

      if (!token) {
        return null;
      }

      // For requests made immediately after refresh, skip cookie validation
      // The cookie might not be updated yet due to async nature
      const isRecentRefresh = this.latestAccessToken !== null;

      if (!isRecentRefresh) {
        // Verify token exists in cookie (server-side validation)
        const cookies = document.cookie.split(';');
        let cookieToken = null;
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'access_token') {
            cookieToken = value;
            break;
          }
        }

        // If token doesn't exist in cookie or doesn't match, logout
        if (!cookieToken || cookieToken !== token) {
          this.logout();
          return null;
        }
      }

      return token;
    }
    return null;
  }

  // Get refresh token from localStorage
  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      // First check if we have a recently refreshed token
      if (this.latestRefreshToken) {
        return this.latestRefreshToken;
      }

      return localStorage.getItem('refresh_token');
    }
    return null;
  }

  // Add subscriber to wait for token refresh
  private addRefreshSubscriber(callback: (token: string | null) => void): void {
    this.refreshSubscribers.push(callback);
  }

  // Notify all subscribers that refresh is complete
  private notifyRefreshSubscribers(token: string | null): void {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  // Make authenticated requests with automatic token refresh
  public async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Make the initial request
    let response = await fetch(url, {
      ...options,
      headers,
    });

    // If we get a 401 Unauthorized, try to refresh the token
    if (response.status === 401 && !url.includes('/api/auth/me') && !url.includes('/api/auth/refresh')) {
      try {
        // Check if already refreshing
        if (this.isRefreshing) {
          // Wait for the refresh to complete
          const newToken = await new Promise<string | null>((resolve) => {
            this.addRefreshSubscriber(resolve);
          });

          if (newToken) {
            // Update the latest token and retry
            headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, {
              ...options,
              headers,
            });
          } else {
            // Refresh failed, logout user
            this.logout();
            window.location.href = '/login';
            return response;
          }
        } else {
          // This is the first request encountering 401, handle the refresh
          this.isRefreshing = true;

          // Try to refresh the token
          const refreshed = await this.refreshToken();

          // Get the new tokens from the refresh operation
          const newToken = this.latestAccessToken;

          // Clear the temporary token storage after use
          this.latestAccessToken = null;
          this.latestRefreshToken = null;

          // Notify all waiting requests
          this.notifyRefreshSubscribers(newToken);
          this.isRefreshing = false;

          if (refreshed && newToken) {
            // Retry the original request with the new token
            headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, {
              ...options,
              headers,
            });
          } else {
            // Refresh failed, logout user
            this.logout();
            window.location.href = '/login';
            return response;
          }
        }
      } catch (error) {
        this.notifyRefreshSubscribers(null);
        this.isRefreshing = false;
        this.latestAccessToken = null;
        this.latestRefreshToken = null;
        this.logout();
        window.location.href = '/login';
        return response;
      }
    }

    return response;
  }

  // Refresh access token using refresh token
  private async refreshToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data: LoginResponse = await response.json();

      // Store the new tokens
      this.setTokens(data.access_token, data.refresh_token);

      // Also store the new tokens in temporary variables for immediate use
      // This avoids the race condition with cookie updates
      this.latestAccessToken = data.access_token;
      this.latestRefreshToken = data.refresh_token;

      return true;
    } catch (error) {
      return false;
    }
  }

  // Login
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  }

  // Get current user
  async getCurrentUser(): Promise<User> {
    const response = await this.authenticatedFetch('/api/auth/me');

    if (!response.ok) {
      const error = await response.json();
      // If we get authentication errors, clear tokens and force logout
      if (response.status === 401 || response.status === 500) {
        this.logout();
        window.location.href = '/login';
      }
      throw new Error(error.detail || 'Failed to get user info');
    }

    return response.json();
  }

  // Super Admin: Get all tenants/companies
  async getAllTenants(): Promise<any[]> {
    const response = await this.authenticatedFetch('/api/super-admin/companies');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch companies');
    }

    return response.json();
  }

  // Super Admin: Create new company with admin
  async createCompanyWithAdmin(companyData: any): Promise<any> {
    const response = await this.authenticatedFetch('/api/super-admin/companies', {
      method: 'POST',
      body: JSON.stringify(companyData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create company');
    }

    return response.json();
  }

  // Super Admin: Create admin user for tenant
  async createAdminUser(userData: any): Promise<any> {
    const response = await this.authenticatedFetch('/api/super-admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create admin user');
    }

    return response.json();
  }

  // Super Admin: Get companies statistics
  async getCompaniesStats(): Promise<any> {
    const response = await this.authenticatedFetch('/api/super-admin/stats');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch statistics');
    }

    return response.json();
  }

  // Super Admin: Update tenant status
  async updateTenantStatus(tenantId: string, isActive: boolean): Promise<any> {
    const response = await this.authenticatedFetch(`/api/super-admin/companies/${tenantId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update company status');
    }

    return response.json();
  }

  // Super Admin: Update tenant details (name, domain, settings)
  async updateTenant(tenantId: string, updateData: any): Promise<any> {
    const response = await this.authenticatedFetch(`/api/super-admin/companies/${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update company');
    }

    return response.json();
  }

  // Super Admin: Get tenant by ID
  async getTenantById(tenantId: string): Promise<any> {
    const response = await this.authenticatedFetch(`/api/super-admin/companies/${tenantId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch company details');
    }

    return response.json();
  }

  // Super Admin: Delete/Deactivate tenant
  async deleteTenant(tenantId: string): Promise<any> {
    const response = await this.authenticatedFetch(`/api/super-admin/companies/${tenantId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete company');
    }

    return response.json();
  }

  // Super Admin: Get users for a tenant
  async getTenantUsers(tenantId: string): Promise<any[]> {
    const response = await this.authenticatedFetch(`/api/super-admin/companies/${tenantId}/users`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch company users');
    }

    return response.json();
  }


  // Logout
  logout(): void {
    if (typeof window !== 'undefined') {
      // Clear temporary token storage
      this.latestAccessToken = null;
      this.latestRefreshToken = null;

      // Remove from localStorage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

      // Remove from cookies
      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
  }

  // Set both access and refresh tokens in localStorage and cookies
  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window !== 'undefined') {
      // Store in localStorage for client-side access
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);

      // Store access token in cookie for server-side middleware access
      // Set cookie to expire in 24 hours (same as JWT token)
      const expires = new Date();
      expires.setTime(expires.getTime() + 24 * 60 * 60 * 1000);
      document.cookie = `access_token=${accessToken}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;

      // Store refresh token in cookie (httpOnly for security)
      const refreshExpires = new Date();
      refreshExpires.setTime(refreshExpires.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      document.cookie = `refresh_token=${refreshToken}; expires=${refreshExpires.toUTCString()}; path=/; SameSite=Strict; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
    }
  }

  // Set token in both localStorage and cookies (for backward compatibility)
  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        this.setTokens(token, refreshToken);
      } else {
        // Fallback to old behavior
        localStorage.setItem('access_token', token);
        const expires = new Date();
        expires.setTime(expires.getTime() + 24 * 60 * 60 * 1000);
        document.cookie = `access_token=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; ${window.location.protocol === 'https:' ? 'Secure;' : ''}`;
      }
    }
  }

  // Check if authenticated
  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const api = new ApiHelper();

// TMS (Transport Management System) API functions
const TMS_BASE = '/api/tms';

// Helper function to fetch with error handling
async function fetchWithError(url: string, options?: RequestInit) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Types for TMS API
export interface TripCreateData {
  user_id?: string;  // Optional since backend will extract from JWT
  company_id?: string;  // Optional since backend will extract from JWT
  branch: string;
  truck_plate: string;
  truck_model: string;
  truck_capacity: number;
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  capacity_total: number;
  trip_date: string;
  origin?: string;
  destination?: string | null;
}

interface TripUpdateData {
  status?: string;
  destination?: string;
  capacity_used?: number;
  distance?: number;
  estimated_duration?: number;
}

export interface OrderAssignData {
  user_id?: string;  // Optional since backend will extract from JWT
  company_id?: string;  // Optional since backend will extract from JWT
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
}

// Trip API functions
export const tmsAPI = {
  // Get all trips with optional filters
  async getAllTrips(filters?: {
    status?: string;
    branch?: string;
    date?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.branch) params.append('branch', filters.branch);
    if (filters?.date) params.append('trip_date', filters.date);
    // Note: user_id and company_id will be extracted from JWT token by the backend

    const url = `${TMS_BASE}/trips${params.toString() ? `?${params.toString()}` : ''}`;
    const data = await fetchWithError(url);

    // Transform API response to match frontend Trip type
    return data.map((trip: any) => ({
      id: trip.id,
      status: trip.status,
      branch: trip.branch,
      origin: trip.origin,
      destination: trip.destination,
      distance: trip.distance,
      estimatedDuration: trip.estimated_duration,
      preTripTime: trip.pre_trip_time,
      postTripTime: trip.post_trip_time,
      truck: {
        plate: trip.truck_plate,
        model: trip.truck_model,
        capacity: trip.truck_capacity
      },
      driver: {
        name: trip.driver_name,
        phone: trip.driver_phone
      },
      orders: trip.orders || [],
      date: trip.trip_date,
      createdAt: trip.created_at,
      capacityUsed: trip.capacity_used,
      capacityTotal: trip.capacity_total
    }));
  },

  // Get single trip by ID
  async getTripById(id: string) {
    // Note: user_id and company_id will be extracted from JWT token by the backend
    return fetchWithError(`${TMS_BASE}/trips/${id}`);
  },

  // Create new trip
  async createTrip(tripData: TripCreateData) {
    // Note: user_id and company_id will be extracted from JWT token by the backend
    return fetchWithError(`${TMS_BASE}/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripData),
    });
  },

  // Update trip
  async updateTrip(id: string, tripData: Partial<TripUpdateData>) {
    // Note: user_id and company_id will be extracted from JWT token by the backend
    return fetchWithError(`${TMS_BASE}/trips/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripData),
    });
  },

  // Get trip orders
  async getTripOrders(tripId: string) {
    // Note: user_id and company_id will be extracted from JWT token by the backend
    return fetchWithError(`${TMS_BASE}/trips/${tripId}/orders`);
  },

  // Assign orders to trip
  async assignOrdersToTrip(tripId: string, orders: OrderAssignData[]) {
    // Note: user_id and company_id will be extracted from JWT token by the backend
    return fetchWithError(`${TMS_BASE}/trips/${tripId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    });
  },

  // Reorder orders within a trip
  async reorderTripOrders(tripId: string, orderSequences: { order_sequences: { order_id: string; sequence_number: number }[] }) {
    // Use Next.js API route instead of direct TMS service
    const response = await fetch(`/api/tms/trips/${tripId}/orders/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderSequences),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to reorder orders: ${response.statusText}`);
    }

    return response.json();
  },

  // Remove order from trip
  async removeOrderFromTrip(tripId: string, orderId: string) {
    // Use Next.js API route instead of direct TMS service
    return fetchWithError(`${TMS_BASE}/trips/${tripId}/orders/remove?order_id=${orderId}`, {
      method: 'DELETE',
    });
  },
};

// Resources API functions
export const tmsResourcesAPI = {
  async getTrucks(tenantId: string = "default-tenant") {
    return fetchWithError(`${TMS_BASE}/resources/trucks?tenant_id=${tenantId}`);
  },

  async getDrivers() {
    return fetchWithError(`${TMS_BASE}/resources/drivers`);
  },

  async getOrders() {
    return fetchWithError(`${TMS_BASE}/resources/orders`);
  },

  async getBranches(tenantId: string = "default-tenant") {
    return fetchWithError(`${TMS_BASE}/resources/branches?tenant_id=${tenantId}`);
  },

  async getTrucksByBranch(branchId: string, tenantId: string = "default-tenant") {
    return fetchWithError(`${TMS_BASE}/resources/branches/${branchId}/trucks?tenant_id=${tenantId}`);
  },
};

// Driver Service API functions
const DRIVER_BASE = '/api/driver';

export const driverAPI = {
  // Get all trips for the driver
  async getDriverTrips(filters?: {
    status?: string;
    trip_date?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.trip_date) params.append('trip_date', filters.trip_date);

    const url = `${DRIVER_BASE}/trips${params.toString() ? `?${params.toString()}` : ''}`;
    return fetchWithError(url);
  },

  // Get current active trip
  async getCurrentTrip() {
    return fetchWithError(`${DRIVER_BASE}/trips/current`);
  },

  // Get trip details with orders
  async getTripDetail(tripId: string) {
    return fetchWithError(`${DRIVER_BASE}/trips/${tripId}`);
  },

  // Update order delivery status
  async updateOrderDeliveryStatus(
    tripId: string,
    orderId: string,
    deliveryStatus: string,
    notes?: string
  ) {
    return fetchWithError(`${DRIVER_BASE}/trips/${tripId}/orders/${orderId}/delivery`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delivery_status: deliveryStatus,
        notes: notes
      }),
    });
  },

  // Mark order as delivered (convenience endpoint)
  async markOrderDelivered(tripId: string, orderId: string) {
    return fetchWithError(`${DRIVER_BASE}/trips/${tripId}/orders/${orderId}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  },

  // Get order status
  async getOrderStatus(tripId: string, orderId: string) {
    return fetchWithError(`${DRIVER_BASE}/trips/${tripId}/orders/${orderId}/status`);
  },

  // Report truck maintenance
  async reportTruckMaintenance(
    tripId: string,
    maintenanceType: string,
    reason: string
  ) {
    return fetchWithError(`${DRIVER_BASE}/trips/${tripId}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maintenance_type: maintenanceType,
        reason: reason
      }),
    });
  },
};