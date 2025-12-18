import React from 'react';
import { FormSection } from './FormSection';
import { FieldWrapper } from './FieldWrapper';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Truck } from 'lucide-react';
import { VehicleCreate } from '@/services/api/companyApi';

interface VehicleFormProps {
  data: Partial<VehicleCreate>;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  mode?: 'create' | 'edit';
  branches?: any[];
  vehicleTypes?: string[];
}

export function VehicleForm({ data, onChange, errors, mode = 'create', branches = [], vehicleTypes = [] }: VehicleFormProps) {
  return (
    <>
      <FormSection title="Basic Information" icon={Truck}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper
            label="Plate Number"
            required
            error={errors.plate_number}
          >
            <Input
              value={data.plate_number || ''}
              onChange={(e) => onChange('plate_number', e.target.value.toUpperCase())}
              placeholder="e.g., MH-12-AB-1234"
              className={errors.plate_number ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Vehicle Type"
            required
            error={errors.vehicle_type}
          >
            <select
              value={data.vehicle_type || ''}
              onChange={(e) => onChange('vehicle_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Vehicle Type</option>
              {vehicleTypes.map(type => (
                <option key={type} value={type}>{type.replace('_', ' ')}</option>
              ))}
            </select>
          </FieldWrapper>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FieldWrapper
            label="Make"
            required
            error={errors.make}
          >
            <Input
              value={data.make || ''}
              onChange={(e) => onChange('make', e.target.value)}
              placeholder="e.g., Tata"
              className={errors.make ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Model"
            required
            error={errors.model}
          >
            <Input
              value={data.model || ''}
              onChange={(e) => onChange('model', e.target.value)}
              placeholder="e.g., Ace"
              className={errors.model ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Year"
            error={errors.year}
          >
            <Input
              type="number"
              min="1900"
              max={new Date().getFullYear() + 1}
              value={data.year || new Date().getFullYear()}
              onChange={(e) => onChange('year', parseInt(e.target.value))}
              className={errors.year ? 'border-red-500' : ''}
            />
          </FieldWrapper>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper label="Status">
            <select
              value={data.status || 'available'}
              onChange={(e) => onChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="available">Available</option>
              <option value="on_trip">On Trip</option>
              <option value="maintenance">Maintenance</option>
              <option value="out_of_service">Out of Service</option>
            </select>
          </FieldWrapper>
          <FieldWrapper
            label="Assigned Branch"
            hint="Optional: Assign this vehicle to a branch"
          >
            <select
              value={data.branch_id || ''}
              onChange={(e) => onChange('branch_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Branch</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
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
            Active Vehicle
          </label>
        </div>
      </FormSection>

      <FormSection title="Capacity Information" icon={Truck}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper
            label="Weight Capacity (kg)"
            error={errors.capacity_weight}
          >
            <Input
              type="number"
              min="0"
              step="10"
              value={data.capacity_weight || 0}
              onChange={(e) => onChange('capacity_weight', parseFloat(e.target.value) || 0)}
              placeholder="e.g., 1000"
              className={errors.capacity_weight ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Volume Capacity (m³)"
            error={errors.capacity_volume}
          >
            <Input
              type="number"
              min="0"
              step="0.1"
              value={data.capacity_volume || 0}
              onChange={(e) => onChange('capacity_volume', parseFloat(e.target.value) || 0)}
              placeholder="e.g., 5.5"
              className={errors.capacity_volume ? 'border-red-500' : ''}
            />
          </FieldWrapper>
        </div>
      </FormSection>

      <FormSection title="Maintenance Information" icon={Truck}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper label="Last Maintenance Date">
            <Input
              type="date"
              value={data.last_maintenance || ''}
              onChange={(e) => onChange('last_maintenance', e.target.value)}
            />
          </FieldWrapper>
          <FieldWrapper label="Next Maintenance Date">
            <Input
              type="date"
              value={data.next_maintenance || ''}
              onChange={(e) => onChange('next_maintenance', e.target.value)}
            />
          </FieldWrapper>
        </div>
      </FormSection>
    </>
  );
}