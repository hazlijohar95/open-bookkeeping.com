/**
 * Report Header Component
 * Displays report title with period info - simple and clean
 */

import { cn } from "@/lib/utils";

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  period: string;
  className?: string;
}

export function ReportHeader({
  title,
  subtitle,
  period,
  className,
}: ReportHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 border-b py-4 text-center print:border-solid",
        className
      )}
    >
      <h2 className="text-xl font-semibold">{title}</h2>
      {subtitle && (
        <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p>
      )}
      <p className="text-muted-foreground mt-2 text-sm">{period}</p>
    </div>
  );
}
