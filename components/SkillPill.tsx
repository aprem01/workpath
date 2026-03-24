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

const categoryColors: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  healthcare: {
    bg: "bg-teal-primary/10",
    text: "text-teal-primary",
    border: "border-teal-primary/30",
    gradient: "from-teal-primary/15 via-teal-primary/8 to-emerald-100/60",
  },
  trades: {
    bg: "bg-amber-primary/10",
    text: "text-amber-800",
    border: "border-amber-primary/30",
    gradient: "from-amber-primary/15 via-amber-100/60 to-yellow-50/80",
  },
  tech: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-300",
    gradient: "from-blue-200/80 via-blue-100/60 to-sky-50/80",
  },
  admin: {
    bg: "bg-purple-100",
    text: "text-purple-800",
    border: "border-purple-300",
    gradient: "from-purple-200/80 via-purple-100/60 to-violet-50/80",
  },
  food_service: {
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-300",
    gradient: "from-orange-200/80 via-orange-100/60 to-amber-50/80",
  },
  transport: {
    bg: "bg-slate-100",
    text: "text-slate-800",
    border: "border-slate-300",
    gradient: "from-slate-200/80 via-slate-100/60 to-gray-50/80",
  },
  education: {
    bg: "bg-indigo-100",
    text: "text-indigo-800",
    border: "border-indigo-300",
    gradient: "from-indigo-200/80 via-indigo-100/60 to-blue-50/80",
  },
  retail: {
    bg: "bg-pink-100",
    text: "text-pink-800",
    border: "border-pink-300",
    gradient: "from-pink-200/80 via-pink-100/60 to-rose-50/80",
  },
  other: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-300",
    gradient: "from-gray-200/80 via-gray-100/60 to-gray-50/80",
  },
};

const variantStyles: Record<string, string> = {
  default: "",
  suggestion:
    "bg-gradient-to-r from-amber-primary/15 via-amber-100/60 to-yellow-50/80 text-amber-800 border-amber-primary/40 border-dashed cursor-pointer hover:shadow-md hover:shadow-amber-200/50",
  gap: "bg-gradient-to-r from-coral/15 via-orange-100/60 to-red-50/80 text-coral border-coral/30",
  matched: "bg-gradient-to-r from-emerald-200/80 via-emerald-100/60 to-green-50/80 text-emerald-800 border-emerald-300",
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
  const colors = categoryColors[category] || categoryColors.other;
  const isDefault = variant === "default";

  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200",
        isDefault
          ? cn(
              `bg-gradient-to-r ${colors.gradient}`,
              colors.text,
              colors.border,
              "hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5"
            )
          : variantStyles[variant],
        animate && "animate-pill-pop",
        onClick && "cursor-pointer",
        isAISuggested && isDefault && "ring-1 ring-amber-primary/30"
      )}
    >
      {isAISuggested && isDefault && (
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
