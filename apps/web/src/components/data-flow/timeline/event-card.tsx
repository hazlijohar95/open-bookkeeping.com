/**
 * Event Card Component
 * Refined expandable card showing event details
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronRight,
  Bot,
  User,
  Shield,
  DollarSign,
  Brain,
  Info,
  X,
} from "@/components/ui/icons";
import { formatDistanceToNow, format } from "date-fns";
import { ACTION_EDUCATION } from "../shared/data-flow-constants";
import type { UnifiedEvent } from "../shared/data-flow-types";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: UnifiedEvent;
}

const SOURCE_ICONS = {
  agent: Bot,
  user: User,
  admin: Shield,
};

export function EventCard({ event }: EventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const SourceIcon = SOURCE_ICONS[event.source];
  const actionInfo = ACTION_EDUCATION[event.action];

  // Format the action name
  const formattedAction = event.action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <div className="relative pl-10">
      {/* Timeline dot */}
      <div
        className={cn(
          "absolute left-[14px] top-4 size-3 rounded-full ring-4 ring-background",
          event.success ? "bg-emerald-500" : "bg-red-500"
        )}
      />

      <div
        className={cn(
          "rounded-lg border bg-card transition-all duration-200",
          isExpanded && "shadow-sm",
          !event.success && "border-red-200 dark:border-red-900/50"
        )}
      >
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 flex items-start gap-3 text-left hover:bg-muted/30 rounded-lg transition-colors"
        >
          {/* Source Icon */}
          <div
            className={cn(
              "size-10 rounded-full flex items-center justify-center shrink-0",
              event.source === "agent" && "bg-violet-100 dark:bg-violet-900/30",
              event.source === "user" && "bg-blue-100 dark:bg-blue-900/30",
              event.source === "admin" && "bg-amber-100 dark:bg-amber-900/30"
            )}
          >
            <SourceIcon
              className={cn(
                "size-5",
                event.source === "agent" && "text-violet-600 dark:text-violet-400",
                event.source === "user" && "text-blue-600 dark:text-blue-400",
                event.source === "admin" && "text-amber-600 dark:text-amber-400"
              )}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{formattedAction}</span>
              <Badge variant="outline" className="text-xs font-normal">
                {event.resourceType}
              </Badge>
              {!event.success && (
                <Badge variant="destructive" className="text-xs gap-1">
                  <X className="size-3" />
                  Failed
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
              {event.description}
            </p>
          </div>

          {/* Right side metadata */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Financial Impact */}
            {event.financialImpact && event.financialImpact.amount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md",
                        event.financialImpact.direction === "increase" &&
                          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                        event.financialImpact.direction === "decrease" &&
                          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        event.financialImpact.direction === "neutral" &&
                          "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400"
                      )}
                    >
                      <DollarSign className="size-3" />
                      {event.financialImpact.amount.toLocaleString()}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {event.financialImpact.direction === "increase" ? "Increases" : "Decreases"}{" "}
                    financial position by {event.financialImpact.currency}{" "}
                    {event.financialImpact.amount.toLocaleString()}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* AI Confidence */}
            {event.source === "agent" && event.metadata.confidence !== undefined && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      <Brain className="size-3" />
                      {Math.round(event.metadata.confidence * 100)}%
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>AI Confidence Score</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Timestamp */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {format(new Date(event.timestamp), "PPpp")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Expand Icon */}
            <div className="text-muted-foreground">
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </div>
          </div>
        </button>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-0 space-y-4">
                <div className="h-px bg-border" />

                {/* Action Education */}
                {actionInfo && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-4">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
                      <Info className="size-4" />
                      <span className="font-medium text-sm">What this does</span>
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                      {actionInfo.description}
                    </p>
                    {actionInfo.financialEffect && (
                      <p className="text-sm text-blue-600 dark:text-blue-300 mt-2">
                        <span className="font-medium">Financial Effect:</span>{" "}
                        {actionInfo.financialEffect}
                      </p>
                    )}
                  </div>
                )}

                {/* AI Reasoning */}
                {event.source === "agent" && event.metadata.reasoning && (
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 p-4">
                    <div className="flex items-center gap-2 text-violet-700 dark:text-violet-400 mb-2">
                      <Brain className="size-4" />
                      <span className="font-medium text-sm">AI Reasoning</span>
                    </div>
                    <p className="text-sm text-violet-600 dark:text-violet-300">
                      {event.metadata.reasoning}
                    </p>
                  </div>
                )}

                {/* State Changes */}
                {(event.previousState || event.newState) && (
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      State Changes
                    </h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      {event.previousState && Object.keys(event.previousState).length > 0 && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                            Before
                          </p>
                          <pre className="text-xs overflow-auto max-h-32 font-mono text-muted-foreground">
                            {JSON.stringify(event.previousState, null, 2)}
                          </pre>
                        </div>
                      )}
                      {event.newState && Object.keys(event.newState).length > 0 && (
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                            After
                          </p>
                          <pre className="text-xs overflow-auto max-h-32 font-mono text-muted-foreground">
                            {JSON.stringify(event.newState, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata Footer */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t font-mono">
                  <span>ID: {event.id.slice(0, 8)}...</span>
                  {event.resourceId && (
                    <span>Resource: {event.resourceId.slice(0, 8)}...</span>
                  )}
                  {event.metadata.sessionId && (
                    <span>Session: {event.metadata.sessionId.slice(0, 8)}...</span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
