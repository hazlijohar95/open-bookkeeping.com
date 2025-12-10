"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type DashboardView = "overview" | "metrics";

interface ViewToggleProps {
  value: DashboardView;
  onChange: (value: DashboardView) => void;
  className?: string;
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as DashboardView)}
      className={cn("w-fit", className)}
    >
      <TabsList className="h-8">
        <TabsTrigger value="overview" className="text-xs px-3">
          Overview
        </TabsTrigger>
        <TabsTrigger value="metrics" className="text-xs px-3">
          Metrics
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
