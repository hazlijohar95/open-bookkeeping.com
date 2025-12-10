"use client";

import {
  Wallet,
  Clock,
  DollarSign,
  FileText,
  Users,
  TrendingUp,
} from "@/components/ui/icons";
import { MetricCard } from "./metric-card";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalInvoices: number;
  totalRevenue: number;
  pendingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  paidThisMonth: number;
  revenueThisMonth: number;
  totalQuotations: number;
  convertedQuotations: number;
  conversionRate: number;
  currency: string;
}

interface TopCustomer {
  name: string;
  email: string | null;
  revenue: number;
  invoiceCount: number;
}

interface MetricsGridProps {
  stats?: DashboardStats | null;
  topCustomers?: TopCustomer[] | null;
  isLoading?: boolean;
  className?: string;
}

export function MetricsGrid({
  stats,
  topCustomers,
  isLoading = false,
  className,
}: MetricsGridProps) {
  const currency = stats?.currency || "MYR";
  const topCustomer = topCustomers?.[0];

  // Calculate growth rate (mock for now - would need historical data)
  const growthRate = stats?.revenueThisMonth && stats?.totalRevenue
    ? Math.round((stats.revenueThisMonth / stats.totalRevenue) * 100)
    : 0;

  return (
    <div
      className={cn(
        "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {/* Row 1 */}
      <MetricCard
        icon={Wallet}
        label="Cash Runway"
        description="Your cash runway in months"
        value={`${stats?.totalInvoices || 0} months`}
        actionLabel="View runway"
        actionHref="/analytics"
        isLoading={isLoading}
      />

      <MetricCard
        icon={DollarSign}
        label="Cash Flow"
        description={`Net cash position - 1 year`}
        value={formatCurrency(stats?.totalRevenue || 0, currency)}
        actionLabel="View cash flow analysis"
        actionHref="/analytics"
        isLoading={isLoading}
      />

      <MetricCard
        icon={Clock}
        label="Outstanding"
        description="Invoices awaiting payment"
        value={formatCurrency(stats?.pendingAmount || 0, currency)}
        actionLabel="View pending"
        actionHref="/invoices?status=pending"
        isLoading={isLoading}
      />

      <MetricCard
        icon={TrendingUp}
        label="Profit & Loss"
        description={`${currency} - 1 year - Net`}
        value={formatCurrency(stats?.totalRevenue || 0, currency)}
        actionLabel="See detailed analysis"
        actionHref="/reports"
        isLoading={isLoading}
      />

      {/* Row 2 */}
      <MetricCard
        icon={FileText}
        label="Forecast"
        description="Revenue projection"
        value={formatCurrency(stats?.pendingAmount || 0, currency)}
        subValue="projected"
        details={[
          {
            label: "Next month projection",
            value: formatCurrency((stats?.revenueThisMonth || 0) * 1.1, currency),
          },
        ]}
        actionLabel="View forecast details"
        actionHref="/analytics/forecast"
        isLoading={isLoading}
      />

      <MetricCard
        icon={DollarSign}
        label="Revenue Summary"
        description={`Net revenue - 1 year`}
        value={formatCurrency(stats?.revenueThisMonth || 0, currency)}
        trend={
          stats?.revenueThisMonth
            ? { value: growthRate, direction: growthRate > 0 ? "up" : "neutral" }
            : undefined
        }
        actionLabel="View revenue trends"
        actionHref="/analytics/revenue"
        isLoading={isLoading}
      />

      <MetricCard
        icon={TrendingUp}
        label="Growth Rate"
        description="Net revenue growth - 1 year"
        value={`${growthRate}%`}
        trend={
          growthRate !== 0
            ? { value: Math.abs(growthRate), direction: growthRate > 0 ? "up" : "down" }
            : undefined
        }
        actionLabel="View growth analysis"
        actionHref="/analytics/growth"
        isLoading={isLoading}
      />

      <MetricCard
        icon={Users}
        label="Customer Lifetime Value"
        description="avg. CLV"
        value={
          topCustomer
            ? formatCurrency(topCustomer.revenue, currency)
            : formatCurrency(0, currency)
        }
        subValue="avg. CLV"
        details={[
          { label: "Total customers", value: topCustomers?.length || 0 },
          { label: "Active (30d)", value: `${topCustomers?.length || 0} (${topCustomers?.length || 0}%)` },
          { label: "Avg. lifespan", value: "0 days" },
        ]}
        actionLabel="View all customers"
        actionHref="/customers"
        isLoading={isLoading}
      />
    </div>
  );
}
