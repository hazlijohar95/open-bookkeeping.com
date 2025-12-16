/**
 * Report Summary Card Component
 * Displays key financial metrics using the Card component from the design system
 */

import type { ReactNode } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ReportSummaryCardProps {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  isLoading?: boolean;
}

export function ReportSummaryCard({
  label,
  value,
  description,
  icon,
  className,
  isLoading = false,
}: ReportSummaryCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("@container/card", className)}>
        <CardHeader className="relative">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn("@container/card", className)}>
      <CardHeader className="relative">
        <CardDescription className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        {description && (
          <div className="text-muted-foreground mt-1 text-sm">
            {description}
          </div>
        )}
      </CardHeader>
    </Card>
  );
}

/**
 * Highlighted card for important totals like Net Profit
 */
interface ReportHighlightCardProps {
  label: string;
  value: string;
  isPositive?: boolean;
  metrics?: Array<{ label: string; value: string }>;
  className?: string;
}

export function ReportHighlightCard({
  label,
  value,
  isPositive,
  metrics,
  className,
}: ReportHighlightCardProps) {
  return (
    <Card
      className={cn(
        "@container/card border-2",
        isPositive === true &&
          "border-green-500/30 bg-green-50/50 dark:bg-green-950/20",
        isPositive === false && "border-destructive/30 bg-destructive/5",
        isPositive === undefined && "",
        className
      )}
    >
      <CardHeader>
        <CardDescription className="text-sm font-medium">
          {label}
        </CardDescription>
        <CardTitle
          className={cn(
            "text-3xl font-semibold tabular-nums @[250px]/card:text-4xl",
            isPositive === true && "text-green-600 dark:text-green-400",
            isPositive === false && "text-destructive"
          )}
        >
          {value}
        </CardTitle>
        {metrics && metrics.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="text-center">
                <div className="text-muted-foreground text-xs tracking-wider uppercase">
                  {metric.label}
                </div>
                <div className="font-mono text-sm font-semibold tabular-nums">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardHeader>
    </Card>
  );
}
