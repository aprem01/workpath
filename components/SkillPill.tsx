"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillPillProps {
  term: string;
  category?: string;
  isAISuggested?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  variant?: "default" | "suggestion" | "gap" | "matched";
  animate?: boolean;
}

const categoryColors: Record<string, string> = {
  healthcare: "bg-teal-primary/10 text-teal-primary border-teal-primary/30",
  trades: "bg-amber-primary/10 text-amber-800 border-amber-primary/30",
  tech: "bg-blue-100 text-blue-800 border-blue-300",
  admin: "bg-purple-100 text-purple-800 border-purple-300",
  food_service: "bg-orange-100 text-orange-800 border-orange-300",
  transport: "bg-slate-100 text-slate-800 border-slate-300",
  education: "bg-indigo-100 text-indigo-800 border-indigo-300",
  retail: "bg-pink-100 text-pink-800 border-pink-300",
  other: "bg-gray-100 text-gray-800 border-gray-300",
};

const variantStyles: Record<string, string> = {
  default: "",
  suggestion:
    "bg-amber-primary/10 text-amber-800 border-amber-primary/40 border-dashed cursor-pointer hover:bg-amber-primary/20",
  gap: "bg-coral/10 text-coral border-coral/30",
  matched: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export default function SkillPill({
  term,
  category = "other",
  isAISuggested,
  onRemove,
  onClick,
  variant = "default",
  animate = false,
}: SkillPillProps) {
  const baseStyle =
    variant === "default"
      ? categoryColors[category] || categoryColors.other
      : variantStyles[variant];

  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
        baseStyle,
        animate && "animate-pill-pop",
        onClick && "cursor-pointer",
        isAISuggested && variant === "default" && "ring-1 ring-amber-primary/30"
      )}
    >
      {isAISuggested && variant === "default" && (
        <span className="text-xs">✨</span>
      )}
      {term}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
