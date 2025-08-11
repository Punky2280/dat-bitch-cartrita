import React, { useState, useEffect } from 'react';
import { gradients } from '@/theme/tokens';
import type { Provider, ProviderField } from './ProviderCatalog';

interface ValidationResult {
  isValid: boolean;
  message: string;
}

interface CredentialFormProps {
  provider: Provider;
  onSubmit: (data: CredentialFormData) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
  className?: string;
}

interface CredentialFormData {
  keyName: string;
  fields: Record<string, string>;
  expiresAt?: string;
  rotationIntervalDays?: number;
  metadata?: Record<string, any>;
}

interface FieldValidation {
  [fieldName: string]: ValidationResult;
}

export const CredentialForm: React.FC<CredentialFormProps> = ({
  provider,
  onSubmit,
  onCancel,
  isSubmitting = false,
  className = ''
}) => {
  const [formData, setFormData] = useState<CredentialFormData>({
    keyName: '',
    fields: {},
    expiresAt: '',
    rotationIntervalDays: 90,
    metadata: {}
  });

  const [fieldValidations, setFieldValidations] = useState<FieldValidation>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize form fields when provider changes
  useEffect(() => {
    const initialFields: Record<string, string> = {};
    provider.fields.forEach(field => {
      initialFields[field.name] = '';
    });
    
    setFormData(prev => ({
      ...prev,
      keyName: `${provider.displayName} Key`,
      fields: initialFields
    }));
    
    setFieldValidations({});
  }, [provider]);

  // Validate individual field
  const validateField = (field: ProviderField, value: string): ValidationResult => {
    if (field.required && !value.trim()) {
      return {
        isValid: false,
        message: `${field.name} is required`
      };
    }

    if (value && field.pattern) {
      const regex = new RegExp(field.pattern);
      if (!regex.test(value)) {
        const fieldNameCapitalized = field.name.charAt(0).toUpperCase() + field.name.slice(1);
        return {
          isValid: false,
          message: `Invalid ${fieldNameCapitalized} format`
        };
      }
    }

    // Additional validation for specific field types
    if (field.type === 'json' && value) {
      try {
        JSON.parse(value);
      } catch {
        return {
          isValid: false,
          message: 'Invalid JSON format'
        };
      }
    }

    if (field.type === 'url' && value) {
      try {
        new URL(value);
      } catch {
        return {
          isValid: false,
          message: 'Invalid URL format'
        };
      }
    }

    return { isValid: true, message: '' };
  };

  // Handle field value change
  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldName]: value
      }
    }));

    // Real-time validation
    const field = provider.fields.find(f => f.name === fieldName);
    if (field) {
      const validation = validateField(field, value);
      setFieldValidations(prev => ({
        ...prev,
        [fieldName]: validation
      }));
    }
  };

  // Validate all fields
  const validateAllFields = (): boolean => {
    const validations: FieldValidation = {};
    let isValid = true;

    provider.fields.forEach(field => {
      const value = formData.fields[field.name] || '';
      const validation = validateField(field, value);
      validations[field.name] = validation;
      
      if (!validation.isValid) {
        isValid = false;
      }
    });

    // Validate key name
    if (!formData.keyName.trim()) {
      isValid = false;
    }

    setFieldValidations(validations);
    return isValid;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAllFields()) {
      return;
    }

    const success = await onSubmit(formData);
    if (success) {
      // Reset form on success
      setFormData({
        keyName: '',
        fields: {},
        expiresAt: '',
        rotationIntervalDays: 90,
        metadata: {}
      });
      setFieldValidations({});
    }
  };

  // Render field input based on type
  const renderFieldInput = (field: ProviderField) => {
    const value = formData.fields[field.name] || '';
    const validation = fieldValidations[field.name];
    const hasError = validation && !validation.isValid;

    const baseClasses = `w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 ${
      hasError 
        ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/10' 
        : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500 bg-white dark:bg-gray-800'
    } text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400`;

    switch (field.type) {
      case 'password':
        return (
          <input
            type="password"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={baseClasses}
            autoComplete="new-password"
          />
        );

      case 'url':
        return (
          <input
            type="url"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={baseClasses}
          />
        );

      case 'json':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            rows={6}
            className={`${baseClasses} font-mono text-sm resize-y`}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            className={baseClasses}
          />
        );
    }
  };

  const isFormValid = formData.keyName.trim() && 
                     provider.fields.every(field => 
                       !field.required || formData.fields[field.name]?.trim()
                     ) &&
                     Object.values(fieldValidations).every(v => !v || v.isValid);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-xl ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-semibold"
            style={{ background: gradients.ai }}
          >
            {provider.icon}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Add {provider.displayName} Credentials
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {provider.description}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-6">
          {/* Key Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Credential Name *
            </label>
            <input
              type="text"
              value={formData.keyName}
              onChange={(e) => setFormData(prev => ({ ...prev, keyName: e.target.value }))}
              placeholder={`e.g., Production ${provider.displayName} Key`}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          {/* Provider Fields */}
          {provider.fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {field.name.charAt(0).toUpperCase() + field.name.slice(1).replace(/([A-Z])/g, ' $1')}
                {field.required && ' *'}
              </label>
              
              {renderFieldInput(field)}
              
              {field.description && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {field.description}
                </p>
              )}
              
              {fieldValidations[field.name] && !fieldValidations[field.name].isValid && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center space-x-1">
                  <span>⚠️</span>
                  <span>{fieldValidations[field.name].message}</span>
                </p>
              )}
            </div>
          ))}

          {/* Advanced Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
            >
              <span>{showAdvanced ? '▼' : '▶'}</span>
              <span>Advanced Options</span>
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Expires At (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Auto-rotation Interval (Days)
                    </label>
                    <select
                      value={formData.rotationIntervalDays || 90}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        rotationIntervalDays: parseInt(e.target.value) 
                      }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">No auto-rotation</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                      <option value={180}>180 days</option>
                      <option value={365}>365 days</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Documentation Link */}
          {provider.documentationUrl && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center space-x-2">
                <span>📚</span>
                <span>Need help getting your API key?</span>
                <a
                  href={provider.documentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  View {provider.displayName} Documentation →
                </a>
              </p>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center space-x-2 ${
                isFormValid && !isSubmitting
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <span>🔐</span>
                  <span>Add Credential</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export type { CredentialFormData };