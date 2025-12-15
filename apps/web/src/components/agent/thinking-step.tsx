"use client";

import { useState, memo } from "react";
import { cn } from "@/lib/utils";
import {
  Brain,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircle2Icon,
  Loader2Icon,
  Zap,
  Eye,
  Sparkles,
} from "@/components/ui/icons";
import { motion, AnimatePresence } from "motion/react";

// Types for thinking steps
export interface ThinkingStepData {
  id: string;
  type: "analysis" | "planning" | "reasoning" | "validation";
  content: string;
  status: "pending" | "processing" | "complete";
  timestamp?: Date;
}

interface ThinkingStepProps {
  steps: ThinkingStepData[];
  isThinking?: boolean;
  className?: string;
}

interface SingleStepProps {
  step: ThinkingStepData;
  isLast: boolean;
}

// Step type to icon mapping
const STEP_ICONS = {
  analysis: Eye,
  planning: Zap,
  reasoning: Brain,
  validation: CheckCircle2Icon,
};

// Step type to label mapping
const STEP_LABELS = {
  analysis: "Understanding request",
  planning: "Planning approach",
  reasoning: "Working through logic",
  validation: "Validating results",
};

// Single thinking step component
const SingleStep = memo(function SingleStep({ step, isLast }: SingleStepProps) {
  const Icon = STEP_ICONS[step.type] || Brain;
  const label = STEP_LABELS[step.type] || "Processing";
  const isProcessing = step.status === "processing";
  const isComplete = step.status === "complete";

  return (
    <div className="relative flex gap-2">
      {/* Timeline connector */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[9px] top-[18px] w-[2px] h-[calc(100%-4px)]",
            isComplete ? "bg-emerald-500/30" : "bg-muted-foreground/20"
          )}
        />
      )}

      {/* Icon container */}
      <div
        className={cn(
          "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          isProcessing && "bg-primary/10 border border-primary/30",
          isComplete && "bg-emerald-500/10 border border-emerald-500/30",
          !isProcessing && !isComplete && "bg-muted border border-muted-foreground/20"
        )}
      >
        {isProcessing ? (
          <Loader2Icon className="h-2.5 w-2.5 animate-spin text-primary" />
        ) : isComplete ? (
          <CheckCircle2Icon className="h-2.5 w-2.5 text-emerald-500" />
        ) : (
          <Icon className="h-2.5 w-2.5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-wide",
              isProcessing && "text-primary",
              isComplete && "text-emerald-500",
              !isProcessing && !isComplete && "text-muted-foreground"
            )}
          >
            {label}
          </span>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-0.5"
            >
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "300ms" }} />
            </motion.div>
          )}
        </div>
        {step.content && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="text-xs text-muted-foreground mt-0.5 leading-relaxed"
          >
            {step.content}
          </motion.p>
        )}
      </div>
    </div>
  );
});

// Main thinking steps component
export const ThinkingSteps = memo(function ThinkingSteps({
  steps,
  isThinking = false,
  className,
}: ThinkingStepProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // If no steps and not thinking, don't render
  if (steps.length === 0 && !isThinking) return null;

  const hasCompleteSteps = steps.some((s) => s.status === "complete");
  const allComplete = steps.length > 0 && steps.every((s) => s.status === "complete");

  return (
    <div className={cn("my-2", className)}>
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 cursor-pointer select-none transition-colors",
          "bg-gradient-to-r from-muted/50 to-transparent border-l-2",
          allComplete ? "border-l-emerald-500/50" : "border-l-primary/50",
          "hover:from-muted/70"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-md",
            allComplete ? "bg-emerald-500/10" : "bg-primary/10"
          )}
        >
          {isThinking && !allComplete ? (
            <Sparkles className="h-3 w-3 text-primary animate-pulse" />
          ) : (
            <Brain className={cn("h-3 w-3", allComplete ? "text-emerald-500" : "text-primary")} />
          )}
        </div>
        <span className="text-xs font-medium flex-1">
          {allComplete ? "Reasoning Complete" : isThinking ? "Thinking..." : "Reasoning"}
        </span>
        {hasCompleteSteps && (
          <span className="text-[10px] text-muted-foreground">
            {steps.filter((s) => s.status === "complete").length}/{steps.length} steps
          </span>
        )}
        {isExpanded ? (
          <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 py-2 bg-muted/20 border-l-2 border-l-transparent">
              {steps.map((step, index) => (
                <SingleStep
                  key={step.id}
                  step={step}
                  isLast={index === steps.length - 1}
                />
              ))}
              {isThinking && steps.every((s) => s.status !== "processing") && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2Icon className="h-3 w-3 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Compact thinking indicator for inline use
export const ThinkingIndicator = memo(function ThinkingIndicator({
  message = "Thinking...",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        "bg-muted/30 border rounded-none px-3 py-2",
        className
      )}
    >
      <div className="relative">
        <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
        <div className="absolute inset-0 animate-ping">
          <Sparkles className="h-3.5 w-3.5 text-primary/30" />
        </div>
      </div>
      <span>{message}</span>
    </div>
  );
});

// Parse thinking content from tool result
export function parseThinkingFromToolResult(
  toolName: string,
  output: unknown
): ThinkingStepData | null {
  if (toolName !== "thinkStep") return null;

  const data = output as Record<string, unknown> | null;
  if (!data) return null;

  const stepType = (data.type as string) || "reasoning";
  const content = (data.thought as string) || (data.reasoning as string) || "";

  return {
    id: `think-${Date.now()}`,
    type: stepType as ThinkingStepData["type"],
    content,
    status: "complete",
    timestamp: new Date(),
  };
}

export default ThinkingSteps;
