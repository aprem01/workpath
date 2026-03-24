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

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <p className="text-sm text-gray-600 mb-1.5 font-body">{label}</p>
      )}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            background:
              percentage >= 80
                ? "#0D9488"
                : percentage >= 50
                ? "#F5A623"
                : "#F97316",
          }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1 text-right">{percentage}%</p>
    </div>
  );
}
