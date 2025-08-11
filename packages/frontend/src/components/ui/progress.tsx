import React from "react";

interface ProgressProps {
  value: number; // 0-100
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export const Progress: React.FC<ProgressProps> = ({ value, className = "", onClick }) => {
  const clamped = isNaN(value) ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div
      className={`relative w-full overflow-hidden rounded bg-gray-200 ${className}`}
      onClick={onClick}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-blue-600 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

export default Progress;
