"use client";

import { memo } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "@/components/ui/icons";
import { ArrowRightIcon, TrendingUp, TrendingDown, Minus } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricDetail {
  label: string;
  value: string | number;
}

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  value: string | number;
  subValue?: string;
  details?: MetricDetail[];
  actionLabel?: string;
  actionHref?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  isLoading?: boolean;
  className?: string;
}

export const MetricCard = memo(function MetricCard({
  icon: Icon,
  label,
  description,
  value,
  subValue,
  details,
  actionLabel,
  actionHref,
  trend,
  isLoading = false,
  className,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col rounded-xl border bg-card p-5",
          className
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="h-3 w-32 mb-4" />
        <Skeleton className="h-9 w-28 mb-2" />
        {details && (
          <div className="space-y-1.5 mt-3 pt-3 border-t">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        )}
        <Skeleton className="h-4 w-24 mt-auto pt-3" />
      </div>
    );
  }

  const TrendIcon =
    trend?.direction === "up"
      ? TrendingUp
      : trend?.direction === "down"
        ? TrendingDown
        : Minus;

  const trendColor =
    trend?.direction === "up"
      ? "text-success"
      : trend?.direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary/20",
        className
      )}
    >
      {/* Header: Icon + Label */}
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground/70 mb-4">{description}</p>
      )}

      {/* Main Value */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="jetbrains-mono text-3xl font-semibold tabular-nums tracking-tight">
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-muted-foreground">{subValue}</span>
        )}
      </div>

      {/* Trend Badge */}
      {trend && (
        <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
          <TrendIcon className="size-3" />
          <span>
            {trend.direction === "up" ? "+" : trend.direction === "down" ? "-" : ""}
            {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground">vs last period</span>
        </div>
      )}

      {/* Details List */}
      {details && details.length > 0 && (
        <div className="mt-3 pt-3 border-t space-y-1.5">
          {details.map((detail, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-muted-foreground">{detail.label}</span>
              <span className="jetbrains-mono font-medium tabular-nums">
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action Link */}
      {actionLabel && actionHref && (
        <Link
          to={actionHref}
          className="mt-auto pt-4 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors group-hover:underline underline-offset-2"
        >
          {actionLabel}
          <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
});
