import React from 'react';
import { FormSection } from './FormSection';
import { FieldWrapper } from './FieldWrapper';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import { Package } from 'lucide-react';
import { ProductCreate } from '@/services/api/companyApi';

interface ProductFormProps {
  data: Partial<ProductCreate>;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  mode?: 'create' | 'edit';
  categories?: any[];
}

export function ProductForm({ data, onChange, errors, mode = 'create', categories = [] }: ProductFormProps) {
  const handlingOptions = ['fragile', 'hazardous', 'refrigerated', 'perishable', 'oversized', 'heavy'];

  const handleHandlingRequirementToggle = (requirement: string) => {
    const currentRequirements = data.handling_requirements || [];
    const newRequirements = currentRequirements.includes(requirement)
      ? currentRequirements.filter(r => r !== requirement)
      : [...currentRequirements, requirement];
    onChange('handling_requirements', newRequirements);
  };

  return (
    <>
      <FormSection title="Basic Information" icon={Package}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper
            label="Product Code"
            required
            error={errors.code}
          >
            <Input
              value={data.code || ''}
              onChange={(e) => onChange('code', e.target.value.toUpperCase())}
              placeholder="e.g., PRD001"
              className={errors.code ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Product Name"
            required
            error={errors.name}
          >
            <Input
              value={data.name || ''}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g., Premium Package"
              className={errors.name ? 'border-red-500' : ''}
            />
          </FieldWrapper>
        </div>
        <FieldWrapper label="Category">
          <select
            value={data.category_id || ''}
            onChange={(e) => onChange('category_id', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Category</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </FieldWrapper>
        <FieldWrapper label="Description">
          <Textarea
            value={data.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Enter product description"
            rows={4}
          />
        </FieldWrapper>
        <div className="flex items-center space-x-3">
          <Switch
            id="is_active"
            checked={data.is_active ?? true}
            onCheckedChange={(checked) => onChange('is_active', checked)}
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Active Product
          </label>
        </div>
      </FormSection>

      <FormSection title="Pricing Information" icon={Package}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper
            label="Unit Price ($)"
            required
            error={errors.unit_price}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={data.unit_price || 0}
              onChange={(e) => onChange('unit_price', parseFloat(e.target.value) || 0)}
              placeholder="e.g., 99.99"
              className={errors.unit_price ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Special Price ($)"
            error={errors.special_price}
            hint="Optional: For promotions or specific customers"
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={data.special_price || ''}
              onChange={(e) => onChange('special_price', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="e.g., 79.99"
              className={errors.special_price ? 'border-red-500' : ''}
            />
          </FieldWrapper>
        </div>
      </FormSection>

      <FormSection title="Physical Properties" icon={Package}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldWrapper label="Weight (kg)">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={data.weight || ''}
              onChange={(e) => onChange('weight', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="e.g., 5.5"
            />
          </FieldWrapper>
          <FieldWrapper label="Volume (m³)">
            <Input
              type="number"
              min="0"
              step="0.001"
              value={data.volume || ''}
              onChange={(e) => onChange('volume', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="e.g., 0.125"
            />
          </FieldWrapper>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FieldWrapper label="Length (cm)">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={data.length || ''}
              onChange={(e) => onChange('length', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="e.g., 50"
            />
          </FieldWrapper>
          <FieldWrapper label="Width (cm)">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={data.width || ''}
              onChange={(e) => onChange('width', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="e.g., 30"
            />
          </FieldWrapper>
          <FieldWrapper label="Height (cm)">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={data.height || ''}
              onChange={(e) => onChange('height', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="e.g., 20"
            />
          </FieldWrapper>
        </div>
        <FieldWrapper label="Handling Requirements">
          <div className="flex flex-wrap gap-2">
            {handlingOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => handleHandlingRequirementToggle(option)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  (data.handling_requirements || []).includes(option)
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </FieldWrapper>
      </FormSection>

      <FormSection title="Inventory Management" icon={Package}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FieldWrapper
            label="Current Stock"
            required
            error={errors.current_stock}
          >
            <Input
              type="number"
              min="0"
              value={data.current_stock || 0}
              onChange={(e) => onChange('current_stock', parseInt(e.target.value) || 0)}
              placeholder="e.g., 100"
              className={errors.current_stock ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Min Stock Level"
            error={errors.min_stock_level}
          >
            <Input
              type="number"
              min="0"
              value={data.min_stock_level || 0}
              onChange={(e) => onChange('min_stock_level', parseInt(e.target.value) || 0)}
              placeholder="e.g., 20"
              className={errors.min_stock_level ? 'border-red-500' : ''}
            />
          </FieldWrapper>
          <FieldWrapper
            label="Max Stock Level"
            error={errors.max_stock_level}
          >
            <Input
              type="number"
              min="0"
              value={data.max_stock_level || 0}
              onChange={(e) => onChange('max_stock_level', parseInt(e.target.value) || 0)}
              placeholder="e.g., 500"
              className={errors.max_stock_level ? 'border-red-500' : ''}
            />
          </FieldWrapper>
        </div>
      </FormSection>
    </>
  );
}