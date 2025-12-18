import React from 'react';
import { FormSection } from './FormSection';
import { FieldWrapper } from './FieldWrapper';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import { User } from 'lucide-react';
import { CustomerCreate } from '@/services/api/companyApi';

interface CustomerFormProps {
  data: Partial<CustomerCreate>;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  mode?: 'create' | 'edit';
  branches?: any[];
  businessTypes?: string[];
}

export function CustomerForm({ data, onChange, errors, mode = 'create', branches = [], businessTypes = [] }: CustomerFormProps) {
  return (
    <>
      <FormSection title="Basic Information" icon={User}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper
            label="Customer Code"
            required
            error={errors.code}
          >
            <Input
              value={data.code || ''}
              onChange={(e) => onChange('code', e.target.value.toUpperCase())}
              placeholder="e.g., CUST001"
              className={errors.code ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Customer Name"
            required
            error={errors.name}
          >
            <Input
              value={data.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g., ABC Corporation"
              className={errors.name ? 'border-red-500' : ''}
            />
          </FieldWrapper>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper label="Business Type">
            <select
              value={data.business_type || ''}
              onChange={(e) => onChange('business_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Business Type</option>
              {businessTypes.map(type => (
                <option key={type} value={type}>{type.replace('_', ' ')}</option>
              ))}
            </select>
          </FieldWrapper>
          <FieldWrapper label="Pricing Tier">
            <select
              value={data.pricing_tier || 'standard'}
              onChange={(e) => onChange('pricing_tier', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </FieldWrapper>
        </div>
        <div className="flex items-center space-x-3">
          <Switch
            id="is_active"
            checked={data.is_active ?? true}
            onCheckedChange={(checked) => onChange('is_active', checked)}
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Active Customer
          </label>
        </div>
      </FormSection>

      <FormSection title="Address Information" icon={User}>
        <FieldWrapper label="Address">
          <Textarea
            value={data.address || ''}
            onChange={(e) => onChange('address', e.target.value)}
            placeholder="Enter complete address"
            rows={3}
          />
        </FieldWrapper>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FieldWrapper label="City">
            <Input
              value={data.city || ''}
              onChange={(e) => onChange('city', e.target.value)}
              placeholder="e.g., Mumbai"
            />
          </FieldWrapper>
          <FieldWrapper label="State">
            <Input
              value={data.state || ''}
              onChange={(e) => onChange('state', e.target.value)}
              placeholder="e.g., Maharashtra"
            />
          </FieldWrapper>
          <FieldWrapper
            label="Postal Code"
            error={errors.postal_code}
          >
            <Input
              value={data.postal_code || ''}
              onChange={(e) => onChange('postal_code', e.target.value)}
              placeholder="e.g., 400001"
              className={errors.postal_code ? 'border-red-500' : ''}
            />
          </FieldWrapper>
        </div>
        <FieldWrapper
          label="Home Branch"
          hint="Optional: Assign a home branch for this customer"
        >
          <select
            value={data.home_branch_id || ''}
            onChange={(e) => onChange('home_branch_id', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Home Branch</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </FieldWrapper>
      </FormSection>

      <FormSection title="Contact Information" icon={User}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper
            label="Phone Number"
            error={errors.phone}
          >
            <Input
              type="tel"
              value={data.phone || ''}
              onChange={(e) => onChange('phone', e.target.value)}
              placeholder="e.g., +91 22 1234 5678"
              className={errors.phone ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Email Address"
            error={errors.email}
          >
            <Input
              type="email"
              value={data.email || ''}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="e.g., contact@company.com"
              className={errors.email ? 'border-red-500' : ''}
            />
          </FieldWrapper>
        </div>
      </FormSection>

      <FormSection title="Credit Information" icon={User}>
        <FieldWrapper
          label="Credit Limit ($)"
          error={errors.credit_limit}
          hint="Set 0 for no credit limit"
        >
          <Input
            type="number"
            min="0"
            step="100"
            value={data.credit_limit || 0}
            onChange={(e) => onChange('credit_limit', parseFloat(e.target.value) || 0)}
            placeholder="e.g., 10000"
            className={errors.credit_limit ? 'border-red-500' : ''}
          />
        </FieldWrapper>
      </FormSection>
    </>
  );
}