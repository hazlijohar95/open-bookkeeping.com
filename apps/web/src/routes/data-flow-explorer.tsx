/**
 * Data Flow Explorer Page
 * Interactive visualization of how data flows through the accounting system
 * Refined technical minimalism aesthetic
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PageContainer } from "@/components/ui/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Activity,
  Clock,
  Database,
  GitBranch,
  Pause,
  Play,
  RefreshCw,
  Zap,
} from "@/components/ui/icons";
import {
  useDataFlowEvents,
  useDataFlowRealtimeSummary,
  useDataFlowFilterOptions,
  useInvalidateDataFlow,
} from "@/api/data-flow";
import { EventTimeline } from "@/components/data-flow/timeline/event-timeline";
import { FlowDiagram } from "@/components/data-flow/flow-visualization/flow-diagram";
import { EntityExplorer } from "@/components/data-flow/entity-explorer/entity-explorer";
import { TIME_RANGES } from "@/components/data-flow/shared/data-flow-constants";
import type { EventFilters, TimeRange } from "@/components/data-flow/shared/data-flow-types";
import { cn } from "@/lib/utils";

export function DataFlowExplorer() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(TIME_RANGES[2]!);
  const [isPolling, setIsPolling] = useState(true);
  const [activeTab, setActiveTab] = useState<"timeline" | "flow" | "entities">("timeline");
  const [filters, setFilters] = useState<EventFilters>({
    lastMinutes: TIME_RANGES[2]!.minutes,
    sources: ["agent", "user"],
    limit: 50,
  });

  const { invalidateAll } = useInvalidateDataFlow();

  const {
    data: eventsData,
    isLoading: eventsLoading,
    isFetching: eventsFetching,
  } = useDataFlowEvents(filters, {
    enabled: activeTab === "timeline",
    refetchInterval: isPolling ? 5000 : false,
  });

  const { data: summary, isLoading: summaryLoading } = useDataFlowRealtimeSummary({
    refetchInterval: isPolling ? 5000 : false,
  });

  const { data: filterOptions } = useDataFlowFilterOptions();

  const handleTimeRangeChange = (value: string) => {
    const range = TIME_RANGES.find((r) => r.value === value);
    if (range) {
      setSelectedTimeRange(range);
      setFilters((prev) => ({ ...prev, lastMinutes: range.minutes }));
    }
  };

  const handleRefresh = () => {
    void invalidateAll();
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) setIsPolling(false);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const tabs = [
    { id: "timeline" as const, label: "Timeline", icon: Activity },
    { id: "flow" as const, label: "Flow", icon: GitBranch },
    { id: "entities" as const, label: "Entities", icon: Database },
  ];

  return (
    <PageContainer className="max-w-[1600px]">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Data Flow</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Real-time visualization of your accounting data
            </p>
          </div>

          {/* Live Status Indicator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3"
          >
            {eventsFetching && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <Badge variant="outline" className="text-xs gap-1.5 text-muted-foreground font-normal">
                  <RefreshCw className="size-3 animate-spin" />
                  Syncing
                </Badge>
              </motion.div>
            )}

            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              isPolling
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}>
              <span className="relative flex size-2">
                {isPolling && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={cn(
                  "relative inline-flex rounded-full size-2",
                  isPolling ? "bg-emerald-500" : "bg-amber-500"
                )} />
              </span>
              {isPolling ? "Live" : "Paused"}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats Grid - Refined Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          label="Last 5 min"
          value={summary?.last5Min ?? 0}
          icon={Zap}
          loading={summaryLoading}
          accent="emerald"
          delay={0}
        />
        <StatCard
          label="Last hour"
          value={summary?.last1Hour ?? 0}
          icon={Clock}
          loading={summaryLoading}
          accent="blue"
          delay={0.05}
        />
        <StatCard
          label="Last 24h"
          value={summary?.last24Hours ?? 0}
          icon={Activity}
          loading={summaryLoading}
          accent="violet"
          delay={0.1}
        />
        <StatCard
          label="Total events"
          value={(summary?.last5Min ?? 0) + (summary?.last1Hour ?? 0) + (summary?.last24Hours ?? 0)}
          icon={Database}
          loading={summaryLoading}
          accent="slate"
          delay={0.15}
        />
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-6 border-b">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-background shadow-sm rounded-md"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <Icon className="size-4 relative z-10" />
                <span className="relative z-10 hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <Select value={selectedTimeRange.value} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-6 w-px bg-border" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isPolling ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsPolling(!isPolling)}
                  className={cn(
                    "h-9 gap-2",
                    isPolling && "bg-emerald-600 hover:bg-emerald-700 text-white"
                  )}
                >
                  {isPolling ? (
                    <>
                      <Pause className="size-3.5" />
                      <span className="hidden sm:inline">Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" />
                      <span className="hidden sm:inline">Resume</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isPolling ? "Pause live updates" : "Resume live updates"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={eventsFetching}
                  className="size-9"
                >
                  <RefreshCw className={cn("size-4", eventsFetching && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Refresh data</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "timeline" && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <EventTimeline
              events={eventsData?.events ?? []}
              isLoading={eventsLoading}
              hasMore={eventsData?.hasMore ?? false}
              filterOptions={filterOptions}
              onFilterChange={(newFilters) =>
                setFilters((prev) => ({ ...prev, ...newFilters }))
              }
            />
          </motion.div>
        )}

        {activeTab === "flow" && (
          <motion.div
            key="flow"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <FlowDiagram filters={filters} isPolling={isPolling} />
          </motion.div>
        )}

        {activeTab === "entities" && (
          <motion.div
            key="entities"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <EntityExplorer />
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}

// Refined Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  accent,
  delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  accent: "emerald" | "blue" | "violet" | "slate";
  delay?: number;
}) {
  const accentColors = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
    slate: "text-slate-600 dark:text-slate-400 bg-slate-500/10",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-muted/30 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <motion.p
              key={value}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-semibold tabular-nums tracking-tight"
            >
              {value.toLocaleString()}
            </motion.p>
          )}
        </div>
        <div className={cn("p-2 rounded-lg", accentColors[accent])}>
          <Icon className="size-4" />
        </div>
      </div>
    </motion.div>
  );
}

export default DataFlowExplorer;
