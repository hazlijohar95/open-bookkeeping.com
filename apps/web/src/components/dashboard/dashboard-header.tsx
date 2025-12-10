"use client";

import { DashboardGreeting } from "./dashboard-greeting";
import { TimeRangeSelector, type TimeRange } from "./time-range-selector";
import { ViewToggle, type DashboardView } from "./view-toggle";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  userName: string;
  timeRange: TimeRange;
  onTimeRangeChange: (value: TimeRange) => void;
  view: DashboardView;
  onViewChange: (value: DashboardView) => void;
  className?: string;
}

export function DashboardHeader({
  userName,
  timeRange,
  onTimeRangeChange,
  view,
  onViewChange,
  className,
}: DashboardHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <DashboardGreeting userName={userName} />

      <div className="flex items-center gap-3">
        <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
        <ViewToggle value={view} onChange={onViewChange} />
      </div>
    </div>
  );
}
