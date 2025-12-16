/**
 * Report Section Component
 * Collapsible section for financial reports following the design system
 */

import { useState } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface ReportSectionProps {
  title: string;
  total: string;
  totalLabel?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  showBrackets?: boolean;
  className?: string;
}

export function ReportSection({
  title,
  total,
  totalLabel,
  children,
  defaultExpanded = true,
  isEmpty = false,
  emptyMessage = "No data",
  showBrackets = false,
  className,
}: ReportSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const formattedTotal = showBrackets ? `(${total})` : total;

  return (
    <div
      className={cn(
        "border-border/40 overflow-hidden rounded-none border",
        className
      )}
    >
      {/* Header - clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "bg-muted/50 flex w-full items-center justify-between px-4 py-3",
          "hover:bg-muted/70 transition-colors duration-200"
        )}
      >
        <div className="flex items-center gap-2">
          <ChevronDownIcon
            className={cn(
              "text-muted-foreground size-4 transition-transform duration-200",
              !isExpanded && "-rotate-90"
            )}
          />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formattedTotal}
        </span>
      </button>

      {/* Collapsible Content */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {isEmpty ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              {emptyMessage}
            </div>
          ) : (
            <div className="divide-border/40 divide-y">{children}</div>
          )}

          {/* Footer with Total */}
          <div className="border-border/40 bg-muted/30 flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm font-semibold">
              {totalLabel ?? `Total ${title}`}
            </span>
            <span className="font-mono font-semibold tabular-nums">
              {formattedTotal}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
