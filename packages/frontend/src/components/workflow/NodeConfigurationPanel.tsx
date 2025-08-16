import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, HelpCircle } from 'lucide-react';
import { getNodeTypeByType, AdvancedNodeDefinition, ConfigField } from './AdvancedNodeTypes';

interface NodeConfigurationPanelProps {
  nodeId: string;
  nodeType: string;
  currentConfig: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
}

export const NodeConfigurationPanel: React.FC<NodeConfigurationPanelProps> = ({
  nodeId,
  nodeType,
  currentConfig,
  isOpen,
  onClose,
  onSave
}) => {
  const [config, setConfig] = useState(currentConfig || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nodeDefinition = getNodeTypeByType(nodeType);

  useEffect(() => {
    setConfig(currentConfig || {});
    setErrors({});
  }, [currentConfig, nodeId]);

  if (!isOpen || !nodeDefinition) return null;

  const handleFieldChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    
    // Clear error for this field
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};

    nodeDefinition.configSchema.forEach(field => {
      if (field.required && (!config[field.key] || config[field.key] === '')) {
        newErrors[field.key] = `${field.label} is required`;
      }

      // Type-specific validation
      if (config[field.key] && field.type === 'number' && isNaN(Number(config[field.key]))) {
        newErrors[field.key] = `${field.label} must be a number`;
      }

      // Custom validation
      if (config[field.key] && field.validation) {
        try {
          const regex = new RegExp(field.validation);
          if (!regex.test(config[field.key])) {
            newErrors[field.key] = `${field.label} format is invalid`;
          }
        } catch (e) {
          console.warn('Invalid validation regex:', field.validation);
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateConfig()) {
      onSave(config);
      onClose();
    }
  };

  const handleReset = () => {
    setConfig(nodeDefinition.defaultConfig || {});
    setErrors({});
  };

  const renderField = (field: ConfigField) => {
    const value = config[field.key] ?? field.defaultValue ?? '';
    const hasError = errors[field.key];

    const baseInputClasses = `
      w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent
      ${hasError ? 'border-red-500' : 'border-gray-300'}
    `;

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClasses}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={baseInputClasses}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.key, Number(e.target.value))}
            placeholder={field.placeholder}
            className={baseInputClasses}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => handleFieldChange(field.key, e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Enable</span>
          </div>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className={baseInputClasses}
          >
            <option value="">Select an option...</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {field.options?.map(option => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter(v => v !== option.value);
                    handleFieldChange(field.key, newValues);
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'json':
        return (
          <textarea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleFieldChange(field.key, parsed);
              } catch (error) {
                handleFieldChange(field.key, e.target.value);
              }
            }}
            placeholder={field.placeholder || '{}'}
            rows={4}
            className={`${baseInputClasses} font-mono text-sm`}
          />
        );

      case 'code':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={6}
            className={`${baseInputClasses} font-mono text-sm`}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className={baseInputClasses}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{nodeDefinition.icon}</span>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Configure {nodeDefinition.name}
              </h2>
              <p className="text-sm text-gray-500">{nodeDefinition.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          <div className="space-y-6">
            {nodeDefinition.configSchema.map(field => (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.help && (
                    <div className="group relative">
                      <HelpCircle size={16} className="text-gray-400 cursor-help" />
                      <div className="invisible group-hover:visible absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                        {field.help}
                      </div>
                    </div>
                  )}
                </div>
                
                {renderField(field)}
                
                {errors[field.key] && (
                  <p className="text-sm text-red-600">{errors[field.key]}</p>
                )}
              </div>
            ))}
          </div>

          {/* Examples */}
          {nodeDefinition.examples && nodeDefinition.examples.length > 0 && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Examples:</h3>
              <div className="space-y-2">
                {nodeDefinition.examples.map((example, idx) => (
                  <div key={idx} className="text-sm text-gray-600 font-mono">
                    {example}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            <RotateCcw size={16} />
            Reset to Defaults
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Save size={16} />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeConfigurationPanel;
