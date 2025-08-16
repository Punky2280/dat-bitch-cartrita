import React from 'react';
import { Handle, Position } from 'reactflow';
import { getNodeTypeByType, AdvancedNodeDefinition } from './AdvancedNodeTypes';

interface EnhancedCustomNodeProps {
  data: {
    label: string;
    type: string;
    config: any;
    nodeDefinition?: AdvancedNodeDefinition;
  };
  selected: boolean;
}

export const EnhancedCustomNode: React.FC<EnhancedCustomNodeProps> = ({ data, selected }) => {
  const nodeDefinition = data.nodeDefinition || getNodeTypeByType(data.type);
  
  if (!nodeDefinition) {
    return (
      <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-red-300 bg-white min-w-[180px]">
        <div className="text-red-600">Unknown Node Type</div>
      </div>
    );
  }
  
  return (
    <div 
      className={`
        px-4 py-3 shadow-lg rounded-lg border-2 min-w-[180px] relative
        ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
        bg-white hover:shadow-xl transition-all duration-200
      `}
      style={{ 
        borderLeftWidth: '4px',
        borderLeftColor: nodeDefinition.color || '#6b7280' 
      }}
    >
      {/* Input Handles */}
      {nodeDefinition.inputs.map((input, idx) => (
        <Handle
          key={`input-${input.id}`}
          type="target"
          position={Position.Left}
          id={input.id}
          style={{
            top: `${30 + idx * 20}px`,
            background: input.required ? '#ef4444' : '#6b7280',
            width: '12px',
            height: '12px',
          }}
          title={`${input.name} (${input.type})${input.required ? ' - Required' : ''}`}
        />
      ))}
      
      {/* Output Handles */}
      {nodeDefinition.outputs.map((output, idx) => (
        <Handle
          key={`output-${output.id}`}
          type="source"
          position={Position.Right}
          id={output.id}
          style={{
            top: `${30 + idx * 20}px`,
            background: '#3b82f6',
            width: '12px',
            height: '12px',
          }}
          title={`${output.name} (${output.type})`}
        />
      ))}
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{nodeDefinition.icon}</span>
        <div className="font-medium text-sm text-gray-900">{data.label}</div>
      </div>
      
      {nodeDefinition.description && (
        <div className="text-xs text-gray-500 mb-2">
          {nodeDefinition.description}
        </div>
      )}
      
      {/* Configuration indicator */}
      {Object.keys(data.config || {}).length > 0 && (
        <div className="text-xs text-blue-600 flex items-center gap-1">
          ⚙️ Configured
        </div>
      )}
    </div>
  );
};

export default EnhancedCustomNode;
