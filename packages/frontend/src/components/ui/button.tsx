import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'default',
  className = '',
  children,
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    default: 'bg-blue-600/80 text-white hover:bg-blue-600 focus:ring-blue-500',
    outline:
      'border border-gray-600 bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white focus:ring-blue-500',
    ghost: 'text-gray-300 hover:bg-gray-800/50 focus:ring-blue-500',
    destructive: 'bg-red-600/80 text-white hover:bg-red-600 focus:ring-red-500',
    secondary:
      'bg-gray-700/80 text-gray-200 hover:bg-gray-600/80 focus:ring-gray-500',
  };

  const sizeClasses = {
    default: 'px-4 py-2 text-sm',
    sm: 'px-3 py-1.5 text-xs',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
