"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

export default function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  const gradientColor =
    percentage >= 80
      ? "from-teal-primary via-emerald-400 to-teal-primary"
      : percentage >= 50
      ? "from-amber-primary via-yellow-400 to-amber-primary"
      : "from-orange-500 via-amber-400 to-orange-500";

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <p className="text-sm text-gray-600 mb-2 font-body">{label}</p>
      )}
      <div className="relative w-full bg-gray-100 rounded-full h-3.5 overflow-hidden shadow-inner">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r relative",
            gradientColor
          )}
          style={{ width: `${percentage}%` }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
        </div>
        {/* Pulsing dot at leading edge */}
        {percentage > 0 && percentage < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm animate-pulse-dot"
            style={{ left: `calc(${percentage}% - 5px)` }}
          />
        )}
      </div>
      <p className="text-xs text-gray-500 mt-1.5 text-right font-medium">{percentage}%</p>
    </div>
  );
}
