import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'success' | 'destructive' | 'outline';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
}) => {
  const baseClasses =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  const variantClasses = {
    default: 'bg-blue-600/20 text-blue-300 border border-blue-600/30',
    secondary: 'bg-gray-600/20 text-gray-300 border border-gray-600/30',
    success: 'bg-green-600/20 text-green-300 border border-green-600/30',
    destructive: 'bg-red-600/20 text-red-300 border border-red-600/30',
    outline: 'border border-gray-600 text-gray-300',
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};
