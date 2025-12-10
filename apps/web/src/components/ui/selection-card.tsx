"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectionCardProps {
  value: string;
  title: string;
  description?: string;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function SelectionCard({
  title,
  description,
  selected = false,
  onSelect,
  disabled = false,
  className,
  children,
}: SelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-start gap-2 rounded-none border p-4 text-left transition-colors",
        "hover:bg-muted/50 hover:border-primary/30",
        selected && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          "absolute right-3 top-3 flex size-4 items-center justify-center rounded-full border-2 transition-colors",
          selected
            ? "border-primary bg-primary"
            : "border-muted-foreground/30"
        )}
      >
        {selected && (
          <div className="size-1.5 rounded-full bg-primary-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="pr-6">
        <div className="font-medium text-sm">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-1">
            {description}
          </div>
        )}
      </div>

      {children}
    </button>
  );
}

export { SelectionCard, type SelectionCardProps };
