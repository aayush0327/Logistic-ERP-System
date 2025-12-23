// Company Service API helper functions
import { api } from './api';

// Branch Management
export const companyApi = {
  // Branch operations
  async getBranches(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    is_active?: boolean;
  }) {
    const queryString = params ? new URLSearchParams(params as any).toString() : '';
    const response = await api.authenticatedFetch(`/api/company/branches${queryString ? `?${queryString}` : ''}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch branches');
    }

    return response.json();
  },

  async getBranch(id: string) {
    const response = await api.authenticatedFetch(`/api/company/branches/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch branch');
    }

    return response.json();
  },

  async createBranch(branchData: any) {
    const response = await api.authenticatedFetch('/api/company/branches/', {
      method: 'POST',
      body: JSON.stringify(branchData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to create branch');
    }

    return response.json();
  },

  async updateBranch(id: string, branchData: any) {
    const response = await api.authenticatedFetch(`/api/company/branches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(branchData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to update branch');
    }

    return response.json();
  },

  async deleteBranch(id: string) {
    const response = await api.authenticatedFetch(`/api/company/branches/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to delete branch');
    }
  },

  async getBranchMetrics(id: string) {
    const response = await api.authenticatedFetch(`/api/company/branches/${id}/metrics`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch branch metrics');
    }

    return response.json();
  },

  // Customer operations
  async getCustomers(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    is_active?: boolean;
  }) {
    const queryString = params ? new URLSearchParams(params as any).toString() : '';
    const response = await api.authenticatedFetch(`/api/company/customers${queryString ? `?${queryString}` : ''}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch customers');
    }

    return response.json();
  },

  async getCustomer(id: string) {
    const response = await api.authenticatedFetch(`/api/company/customers/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch customer');
    }

    return response.json();
  },

  async createCustomer(customerData: any) {
    const response = await api.authenticatedFetch('/api/company/customers/', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to create customer');
    }

    return response.json();
  },

  async updateCustomer(id: string, customerData: any) {
    const response = await api.authenticatedFetch(`/api/company/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customerData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to update customer');
    }

    return response.json();
  },

  async deleteCustomer(id: string) {
    const response = await api.authenticatedFetch(`/api/company/customers/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to delete customer');
    }
  },

  async getCustomerBusinessTypes() {
    const response = await api.authenticatedFetch('/api/company/customers/business-types');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch business types');
    }

    return response.json();
  },

  // Vehicle operations
  async getVehicles(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    is_active?: boolean;
    vehicle_type?: string;
    status?: string;
  }) {
    const queryString = params ? new URLSearchParams(params as any).toString() : '';
    const response = await api.authenticatedFetch(`/api/company/vehicles${queryString ? `?${queryString}` : ''}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch vehicles');
    }

    return response.json();
  },

  async getVehicle(id: string) {
    const response = await api.authenticatedFetch(`/api/company/vehicles/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch vehicle');
    }

    return response.json();
  },

  async createVehicle(vehicleData: any) {
    const response = await api.authenticatedFetch('/api/company/vehicles/', {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to create vehicle');
    }

    return response.json();
  },

  async updateVehicle(id: string, vehicleData: any) {
    const response = await api.authenticatedFetch(`/api/company/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vehicleData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to update vehicle');
    }

    return response.json();
  },

  async deleteVehicle(id: string) {
    const response = await api.authenticatedFetch(`/api/company/vehicles/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to delete vehicle');
    }
  },

  async getAvailableVehicles() {
    const response = await api.authenticatedFetch('/api/company/vehicles/available');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch available vehicles');
    }

    return response.json();
  },

  async updateVehicleStatus(id: string, status: string) {
    const response = await api.authenticatedFetch(`/api/company/vehicles/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to update vehicle status');
    }

    return response.json();
  },

  async getVehicleTypes() {
    const response = await api.authenticatedFetch('/api/company/vehicles/vehicle-types');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch vehicle types');
    }

    return response.json();
  },

  async getVehicleStatusOptions() {
    const response = await api.authenticatedFetch('/api/company/vehicles/status-options');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch status options');
    }

    return response.json();
  },

  // Product operations
  async getProducts(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    is_active?: boolean;
    category_id?: string;
  }) {
    const queryString = params ? new URLSearchParams(params as any).toString() : '';
    const response = await api.authenticatedFetch(`/api/company/products${queryString ? `?${queryString}` : ''}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch products');
    }

    return response.json();
  },

  async getProduct(id: string) {
    const response = await api.authenticatedFetch(`/api/company/products/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch product');
    }

    return response.json();
  },

  async createProduct(productData: any) {
    const response = await api.authenticatedFetch('/api/company/products/', {
      method: 'POST',
      body: JSON.stringify(productData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to create product');
    }

    return response.json();
  },

  async updateProduct(id: string, productData: any) {
    const response = await api.authenticatedFetch(`/api/company/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to update product');
    }

    return response.json();
  },

  async deleteProduct(id: string) {
    const response = await api.authenticatedFetch(`/api/company/products/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to delete product');
    }
  },

  async getLowStockProducts() {
    const response = await api.authenticatedFetch('/api/company/products/low-stock');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch low stock products');
    }

    return response.json();
  },

  async bulkUpdateProducts(updates: any[]) {
    const response = await api.authenticatedFetch('/api/company/products/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to bulk update products');
    }

    return response.json();
  },

  async getProductStockHistory(id: string) {
    const response = await api.authenticatedFetch(`/api/company/products/${id}/stock-history`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch stock history');
    }

    return response.json();
  },

  // Product Categories
  async getProductCategories(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    is_active?: boolean;
  }) {
    const queryString = params ? new URLSearchParams(params as any).toString() : '';
    const response = await api.authenticatedFetch(`/api/company/product-categories${queryString ? `?${queryString}` : ''}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch product categories');
    }

    return response.json();
  },

  async getProductCategoriesTree() {
    const response = await api.authenticatedFetch('/api/company/product-categories/tree');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch category tree');
    }

    return response.json();
  },

  async getProductCategory(id: string) {
    const response = await api.authenticatedFetch(`/api/company/product-categories/${id}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to fetch product category');
    }

    return response.json();
  },

  async createProductCategory(categoryData: any) {
    const response = await api.authenticatedFetch('/api/company/product-categories/', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to create product category');
    }

    return response.json();
  },

  async updateProductCategory(id: string, categoryData: any) {
    const response = await api.authenticatedFetch(`/api/company/product-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to update product category');
    }

    return response.json();
  },

  async deleteProductCategory(id: string) {
    const response = await api.authenticatedFetch(`/api/company/product-categories/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || error.detail || 'Failed to delete product category');
    }
  },
};