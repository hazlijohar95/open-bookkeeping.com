"use client";

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircleIcon, AlertTriangleIcon, TrendingUp, ArrowRightIcon } from "@/components/ui/icons";

interface BusinessHealthCardProps {
  stats?: {
    totalRevenue: number;
    pendingAmount: number;
    overdueCount: number;
    overdueAmount: number;
    revenueThisMonth: number;
    paidThisMonth: number;
    currency: string;
  } | null;
  isLoading?: boolean;
  className?: string;
}

type HealthStatus = "excellent" | "good" | "attention" | "critical";

function getHealthStatus(stats: BusinessHealthCardProps["stats"]): {
  status: HealthStatus;
  message: string;
  action?: { label: string; href: string };
} {
  if (!stats) {
    return {
      status: "good",
      message: "Start by creating your first invoice to track your business health.",
      action: { label: "Create Invoice", href: "/create/invoice" },
    };
  }

  const { overdueCount, overdueAmount, pendingAmount, revenueThisMonth } = stats;

  // Critical: High overdue amount
  if (overdueCount > 5 || overdueAmount > pendingAmount * 0.5) {
    return {
      status: "critical",
      message: `You have ${overdueCount} overdue invoices totaling ${formatCurrency(overdueAmount, stats.currency)}. Consider following up.`,
      action: { label: "View Overdue", href: "/invoices?status=overdue" },
    };
  }

  // Attention: Some overdue invoices
  if (overdueCount > 0) {
    return {
      status: "attention",
      message: `${overdueCount} invoice${overdueCount > 1 ? "s" : ""} overdue. A quick follow-up could help.`,
      action: { label: "View Overdue", href: "/invoices?status=overdue" },
    };
  }

  // Excellent: Revenue coming in, no overdue
  if (revenueThisMonth > 0 && pendingAmount > 0) {
    return {
      status: "excellent",
      message: `Great month! ${formatCurrency(revenueThisMonth, stats.currency)} collected with ${formatCurrency(pendingAmount, stats.currency)} more expected.`,
    };
  }

  // Good: Everything is clean
  return {
    status: "good",
    message: pendingAmount > 0
      ? `${formatCurrency(pendingAmount, stats.currency)} in pending invoices. All payments are on track.`
      : "All caught up! No pending payments.",
  };
}

const statusConfig: Record<HealthStatus, {
  icon: typeof CheckCircleIcon;
  color: string;
  bgColor: string;
  label: string;
}> = {
  excellent: {
    icon: TrendingUp,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    label: "Excellent",
  },
  good: {
    icon: CheckCircleIcon,
    color: "text-primary",
    bgColor: "bg-primary/10",
    label: "Good",
  },
  attention: {
    icon: AlertTriangleIcon,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    label: "Needs Attention",
  },
  critical: {
    icon: AlertTriangleIcon,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "Action Required",
  },
};

export function BusinessHealthCard({ stats, isLoading, className }: BusinessHealthCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const health = getHealthStatus(stats);
  const config = statusConfig[health.status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {/* Status Icon */}
            <div className={cn(
              "flex size-12 shrink-0 items-center justify-center",
              config.bgColor
            )}>
              <Icon className={cn("size-6", config.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-sm font-medium", config.color)}>
                  {config.label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {health.message}
              </p>
            </div>

            {/* Action */}
            {health.action && (
              <Button variant="ghost" size="sm" asChild className="shrink-0">
                <Link to={health.action.href}>
                  {health.action.label}
                  <ArrowRightIcon className="ml-1 size-3" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
