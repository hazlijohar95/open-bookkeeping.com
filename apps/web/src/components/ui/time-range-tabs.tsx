"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimeRangeOption {
  value: string;
  label: string;
}

interface TimeRangeTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  options: TimeRangeOption[];
  className?: string;
}

function TimeRangeTabs({
  value,
  onValueChange,
  options,
  className,
}: TimeRangeTabsProps) {
  return (
    <>
      {/* Desktop: Segmented tabs */}
      <div
        className={cn(
          "hidden md:inline-flex items-center rounded-none bg-muted p-1",
          className
        )}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onValueChange(option.value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-none transition-colors whitespace-nowrap",
              value === option.value
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Mobile: Dropdown select */}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={cn("md:hidden w-auto", className)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export { TimeRangeTabs, type TimeRangeTabsProps, type TimeRangeOption };
