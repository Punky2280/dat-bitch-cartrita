'use client';

import React, { createContext, useContext, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// Context for Select
interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

const useSelect = () => {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('Select components must be used within a Select provider');
  }
  return context;
};

// Main Select component
export interface SelectProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

const Select: React.FC<SelectProps> = ({
  children,
  value: controlledValue,
  defaultValue = '',
  onValueChange,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  
  const value = controlledValue !== undefined ? controlledValue : internalValue;
  
  const handleValueChange = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
    setOpen(false);
  };
  
  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        open,
        onOpenChange: setOpen,
      }}
    >
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

// SelectTrigger component
export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ children, className, ...props }, ref) => {
    const { open, onOpenChange } = useSelect();
    
    return (
      <button
        ref={ref}
        type="button"
        className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
        onClick={() => onOpenChange(!open)}
        {...props}
      >
        {children}
        <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

// SelectValue component
export interface SelectValueProps {
  placeholder?: string;
}

const SelectValue: React.FC<SelectValueProps> = ({ placeholder }) => {
  const { value } = useSelect();
  
  return (
    <span className={value ? 'text-black' : 'text-gray-500'}>
      {value || placeholder}
    </span>
  );
};

// SelectContent component
export interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

const SelectContent: React.FC<SelectContentProps> = ({ children, className }) => {
  const { open, onOpenChange } = useSelect();
  
  if (!open) {
    return null;
  }
  
  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={() => onOpenChange(false)}
      />
      <div className={`absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg ${className || ''}`}>
        <div className="max-h-60 overflow-auto py-1">
          {children}
        </div>
      </div>
    </>
  );
};

// SelectItem component
export interface SelectItemProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

const SelectItem: React.FC<SelectItemProps> = ({ children, value: itemValue, className }) => {
  const { value, onValueChange } = useSelect();
  const isSelected = value === itemValue;
  
  return (
    <div
      className={`relative flex w-full cursor-pointer select-none items-center py-2 pl-8 pr-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100 ${isSelected ? 'bg-gray-50' : ''} ${className || ''}`}
      onClick={() => onValueChange(itemValue)}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4" />
        </span>
      )}
      {children}
    </div>
  );
};

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };