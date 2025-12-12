"use client";

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ClockIcon, AlertTriangleIcon, ArrowUpRight } from "@/components/ui/icons";

interface KeyMetricsProps {
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

export function KeyMetrics({ stats, isLoading, className }: KeyMetricsProps) {
  const currency = stats?.currency ?? "MYR";

  if (isLoading) {
    return (
      <div className={cn("grid gap-4 grid-cols-1 sm:grid-cols-3", className)}>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      id: "revenue",
      label: "This Month",
      value: formatCurrency(stats?.revenueThisMonth ?? 0, currency),
      subtext: `${stats?.paidThisMonth ?? 0} invoices paid`,
      icon: TrendingUp,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      href: "/invoices?status=paid",
      show: true,
    },
    {
      id: "pending",
      label: "Pending",
      value: formatCurrency(stats?.pendingAmount ?? 0, currency),
      subtext: "Awaiting payment",
      icon: ClockIcon,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      href: "/invoices?status=pending",
      show: (stats?.pendingAmount ?? 0) > 0,
    },
    {
      id: "overdue",
      label: "Overdue",
      value: stats?.overdueCount ?? 0,
      subtext: stats?.overdueAmount
        ? formatCurrency(stats.overdueAmount, currency)
        : "No overdue invoices",
      icon: AlertTriangleIcon,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      href: "/invoices?status=overdue",
      show: (stats?.overdueCount ?? 0) > 0,
      highlight: (stats?.overdueCount ?? 0) > 0,
    },
  ];

  // Filter to show only relevant metrics, but always show at least revenue
  const visibleMetrics = metrics.filter((m) => m.show || m.id === "revenue");

  // If we have fewer than 3 metrics, show total revenue as fallback
  if (visibleMetrics.length < 3 && !visibleMetrics.find(m => m.id === "total")) {
    visibleMetrics.push({
      id: "total",
      label: "Total Revenue",
      value: formatCurrency(stats?.totalRevenue ?? 0, currency),
      subtext: "All time",
      icon: TrendingUp,
      iconBg: "bg-violet-100 dark:bg-violet-900/30",
      iconColor: "text-violet-600 dark:text-violet-400",
      href: "/invoices",
      show: true,
    });
  }

  return (
    <motion.div
      className={cn("grid gap-4 grid-cols-1 sm:grid-cols-3", className)}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.1 },
        },
      }}
    >
      {visibleMetrics.slice(0, 3).map((metric) => {
        const Icon = metric.icon;

        return (
          <motion.div
            key={metric.id}
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            <Link to={metric.href}>
              <Card
                variant="interactive"
                className={cn(
                  "group",
                  metric.highlight && "border-amber-300 dark:border-amber-700"
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "flex size-8 items-center justify-center",
                          metric.iconBg
                        )}>
                          <Icon className={cn("size-4", metric.iconColor)} />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {metric.label}
                        </span>
                      </div>

                      <div>
                        <p className="text-2xl font-semibold tabular-nums tracking-tight">
                          {metric.value}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {metric.subtext}
                        </p>
                      </div>
                    </div>

                    <ArrowUpRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
