import React from 'react';
import { FormSection } from './FormSection';
import { FieldWrapper } from './FieldWrapper';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import { Building } from 'lucide-react';
import { BranchCreate } from '@/services/api/companyApi';

interface BranchFormProps {
  data: Partial<BranchCreate>;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  mode?: 'create' | 'edit';
  branches?: any[];
}

export function BranchForm({ data, onChange, errors, mode = 'create', branches = [] }: BranchFormProps) {
  return (
    <>
      <FormSection title="Basic Information" icon={Building}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper
            label="Branch Code"
            required
            error={errors.code}
          >
            <Input
              value={data.code || ''}
              onChange={(e) => onChange('code', e.target.value.toUpperCase())}
              placeholder="e.g., BR001"
              className={errors.code ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Branch Name"
            required
            error={errors.name}
          >
            <Input
              value={data.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g., Mumbai Main Branch"
              className={errors.name ? 'border-red-500' : ''}
            />
          </FieldWrapper>
        </div>
        <div className="flex items-center space-x-3">
          <Switch
            id="is_active"
            checked={data.is_active ?? true}
            onCheckedChange={(checked) => onChange('is_active', checked)}
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Active Branch
          </label>
        </div>
      </FormSection>

      <FormSection title="Address Information" icon={Building}>
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
      </FormSection>

      <FormSection title="Contact Information" icon={Building}>
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
              placeholder="e.g., mumbai@company.com"
              className={errors.email ? 'border-red-500' : ''}
            />
          </FieldWrapper>
        </div>
        <FieldWrapper
          label="Manager ID"
          hint="Optional: Assign a manager to this branch"
        >
          <Input
            value={data.manager_id || ''}
            onChange={(e) => onChange('manager_id', e.target.value)}
            placeholder="Enter manager user ID"
          />
        </FieldWrapper>
      </FormSection>
    </>
  );
}