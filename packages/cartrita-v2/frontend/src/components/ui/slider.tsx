'use client';

import React, { useCallback } from 'react';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ 
    className, 
    value, 
    defaultValue = [0], 
    onValueChange, 
    min = 0, 
    max = 100, 
    step = 1,
    ...props 
  }, ref) => {
    const currentValue = value?.[0] ?? defaultValue[0];
    
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(event.target.value);
        onValueChange?.([newValue]);
      },
      [onValueChange]
    );
    
    return (
      <div className={`relative flex w-full touch-none select-none items-center ${className || ''}`}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          className="relative h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-colors [&::-webkit-slider-thumb]:hover:bg-blue-700
          [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:transition-colors [&::-moz-range-thumb]:hover:bg-blue-700"
          {...props}
        />
      </div>
    );
  }
);
Slider.displayName = 'Slider';

export { Slider };