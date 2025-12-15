"use client";

import { useState, memo, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  RefreshCw,
  ArrowRightIcon,
  XIcon,
  Copy,
  CheckIcon,
  Zap,
  HelpCircleIcon,
} from "@/components/ui/icons";
import { motion, AnimatePresence } from "motion/react";

// Error categories for smart classification
export type ErrorCategory =
  | "validation"
  | "authentication"
  | "rate_limit"
  | "not_found"
  | "permission"
  | "network"
  | "server"
  | "unknown";

// Error classification rules
const ERROR_PATTERNS: Array<{ pattern: RegExp; category: ErrorCategory }> = [
  { pattern: /missing required|validation|invalid|must be|cannot be empty/i, category: "validation" },
  { pattern: /unauthorized|unauthenticated|token|session expired|login/i, category: "authentication" },
  { pattern: /rate limit|too many requests|quota exceeded|429/i, category: "rate_limit" },
  { pattern: /not found|404|does not exist|no such/i, category: "not_found" },
  { pattern: /permission denied|forbidden|403|not allowed/i, category: "permission" },
  { pattern: /network|connection|timeout|ECONNREFUSED|fetch failed/i, category: "network" },
  { pattern: /server error|500|internal error|something went wrong/i, category: "server" },
];

// Classify error message
function classifyError(message: string): ErrorCategory {
  for (const { pattern, category } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return category;
    }
  }
  return "unknown";
}

// Error category configurations
const ERROR_CONFIG: Record<
  ErrorCategory,
  {
    title: string;
    description: string;
    suggestions: string[];
    canRetry: boolean;
    retryDelay?: number;
  }
> = {
  validation: {
    title: "Invalid Input",
    description: "The request contained invalid or missing information.",
    suggestions: [
      "Check if all required fields are provided",
      "Verify the format of dates, numbers, and emails",
      "Ensure amounts are positive numbers",
    ],
    canRetry: false,
  },
  authentication: {
    title: "Authentication Required",
    description: "Your session may have expired or you need to log in.",
    suggestions: [
      "Try refreshing the page",
      "Log out and log back in",
      "Check if your session is still active",
    ],
    canRetry: true,
    retryDelay: 0,
  },
  rate_limit: {
    title: "Too Many Requests",
    description: "You've made too many requests in a short period.",
    suggestions: [
      "Wait a few minutes before trying again",
      "Reduce the number of concurrent operations",
      "Consider batching multiple actions together",
    ],
    canRetry: true,
    retryDelay: 60000,
  },
  not_found: {
    title: "Resource Not Found",
    description: "The requested item could not be found.",
    suggestions: [
      "Verify the ID or reference number is correct",
      "Check if the item was deleted",
      "Search for the item in the relevant list",
    ],
    canRetry: false,
  },
  permission: {
    title: "Access Denied",
    description: "You don't have permission to perform this action.",
    suggestions: [
      "Contact your administrator for access",
      "Verify you're using the correct account",
      "Check your role and permissions",
    ],
    canRetry: false,
  },
  network: {
    title: "Connection Issue",
    description: "Unable to connect to the server.",
    suggestions: [
      "Check your internet connection",
      "Try refreshing the page",
      "The server may be temporarily unavailable",
    ],
    canRetry: true,
    retryDelay: 5000,
  },
  server: {
    title: "Server Error",
    description: "Something went wrong on our end.",
    suggestions: [
      "Wait a moment and try again",
      "If the problem persists, contact support",
      "Check our status page for known issues",
    ],
    canRetry: true,
    retryDelay: 10000,
  },
  unknown: {
    title: "Something Went Wrong",
    description: "An unexpected error occurred.",
    suggestions: [
      "Try the action again",
      "Refresh the page if the problem persists",
      "Contact support if needed",
    ],
    canRetry: true,
    retryDelay: 0,
  },
};

export interface ErrorRecoveryProps {
  error: string | Error;
  onRetry?: () => void;
  onDismiss?: () => void;
  onGoBack?: () => void;
  className?: string;
  compact?: boolean;
}

export const ErrorRecovery = memo(function ErrorRecovery({
  error,
  onRetry,
  onDismiss,
  onGoBack,
  className,
  compact = false,
}: ErrorRecoveryProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const errorMessage = useMemo(() => {
    return error instanceof Error ? error.message : String(error);
  }, [error]);

  const category = useMemo(() => classifyError(errorMessage), [errorMessage]);
  const config = ERROR_CONFIG[category];

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(errorMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [errorMessage]);

  const handleRetry = useCallback(async () => {
    if (!onRetry || !config.canRetry) return;

    setIsRetrying(true);

    // Apply retry delay if specified
    if (config.retryDelay) {
      await new Promise((resolve) => setTimeout(resolve, config.retryDelay));
    }

    try {
      onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, config]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border rounded-none overflow-hidden",
        "bg-gradient-to-r from-destructive/5 to-transparent",
        "border-l-2 border-l-destructive",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-start gap-2.5 px-3 py-2.5",
          !compact && "cursor-pointer hover:bg-destructive/5 transition-colors"
        )}
        onClick={() => !compact && setIsExpanded(!isExpanded)}
      >
        {/* Icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-destructive/10 border border-destructive/20">
          <AlertTriangleIcon className="h-4 w-4 text-destructive" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-destructive">{config.title}</span>
            <Badge variant="outline" className="rounded-none text-[9px] px-1 py-0 h-4 border-destructive/30 text-destructive">
              {category.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="h-6 w-6 p-0 rounded-none shrink-0"
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Expand chevron */}
        {!compact && (
          isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          )
        )}
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Suggestions */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Suggestions
                </h4>
                <ul className="space-y-1">
                  {config.suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-1.5 text-xs text-muted-foreground"
                    >
                      <ArrowRightIcon className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Error details (collapsible) */}
              <details className="group">
                <summary className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                  <ChevronRightIcon className="h-3 w-3 group-open:rotate-90 transition-transform" />
                  Technical details
                </summary>
                <div className="mt-1.5 bg-muted/30 border rounded-none p-2 relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopy}
                    className="absolute top-1 right-1 h-5 w-5 p-0 rounded-none"
                  >
                    {copied ? (
                      <CheckIcon className="h-2.5 w-2.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-2.5 w-2.5" />
                    )}
                  </Button>
                  <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all pr-6">
                    {errorMessage}
                  </pre>
                </div>
              </details>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                {config.canRetry && onRetry && (
                  <Button
                    size="sm"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="h-7 text-xs rounded-none gap-1"
                  >
                    <RefreshCw className={cn("h-3 w-3", isRetrying && "animate-spin")} />
                    {isRetrying ? "Retrying..." : "Try Again"}
                  </Button>
                )}
                {onGoBack && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onGoBack}
                    className="h-7 text-xs rounded-none gap-1"
                  >
                    Go Back
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  asChild
                  className="h-7 text-xs rounded-none gap-1 text-muted-foreground"
                >
                  <a href="mailto:support@openbookkeeping.com" target="_blank" rel="noopener noreferrer">
                    <HelpCircleIcon className="h-3 w-3" />
                    Get Help
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// Compact inline error for use in forms or smaller spaces
interface InlineErrorProps {
  error: string;
  onRetry?: () => void;
}

export const InlineError = memo(function InlineError({
  error,
  onRetry,
}: InlineErrorProps) {
  const category = useMemo(() => classifyError(error), [error]);
  const config = ERROR_CONFIG[category];

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-destructive/10 border border-destructive/20 rounded-none text-xs">
      <AlertTriangleIcon className="h-3.5 w-3.5 text-destructive shrink-0" />
      <span className="text-destructive flex-1">{config.title}: {error}</span>
      {config.canRetry && onRetry && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRetry}
          className="h-5 px-1.5 text-[10px] rounded-none gap-1"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          Retry
        </Button>
      )}
    </div>
  );
});

export default ErrorRecovery;
