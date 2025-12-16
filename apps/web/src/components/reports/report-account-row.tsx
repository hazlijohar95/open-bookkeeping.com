/**
 * Report Account Row Component
 * Displays individual account lines in financial reports - matches table styling
 */

import { cn } from "@/lib/utils";

interface ReportAccountRowProps {
  code: string;
  name: string;
  amount: string;
  showBrackets?: boolean;
  className?: string;
}

export function ReportAccountRow({
  code,
  name,
  amount,
  showBrackets = false,
  className,
}: ReportAccountRowProps) {
  const formattedAmount = showBrackets ? `(${amount})` : amount;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2.5",
        "hover:bg-muted/20 transition-colors duration-200",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-muted-foreground w-14 shrink-0 font-mono text-xs">
          {code}
        </span>
        <span className="truncate text-sm">{name}</span>
      </div>
      <span
        className={cn(
          "ml-4 shrink-0 font-mono text-sm tabular-nums",
          showBrackets && "text-destructive"
        )}
      >
        {formattedAmount}
      </span>
    </div>
  );
}

interface ReportTotalRowProps {
  label: string;
  amount: string;
  showBrackets?: boolean;
  variant?: "default" | "highlight";
  className?: string;
}

export function ReportTotalRow({
  label,
  amount,
  showBrackets = false,
  variant = "default",
  className,
}: ReportTotalRowProps) {
  const formattedAmount = showBrackets ? `(${amount})` : amount;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3",
        variant === "default" && "bg-muted/50",
        variant === "highlight" && "bg-muted/70",
        className
      )}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span
        className={cn(
          "font-mono font-semibold tabular-nums",
          showBrackets && "text-destructive"
        )}
      >
        {formattedAmount}
      </span>
    </div>
  );
}
