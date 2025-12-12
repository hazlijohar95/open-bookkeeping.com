import { useState } from "react";
import {
  useDashboardStats,
  useTopCustomers,
  useRevenueChart,
  useInvoiceStatusDistribution,
  useRecentInvoices,
} from "@/api";
import { useAuth } from "@/providers/auth-provider";
import { formatCurrency } from "@/lib/utils";
import { PageContainer } from "@/components/ui/page-container";
import {
  // Clean Overview components (v2)
  DashboardHeader,
  BusinessHealthCard,
  KeyMetrics,
  type TimeRange,
  type DashboardView,
  // Legacy Metrics view components
  StatCard,
  RevenueChart,
  InvoiceStatusChart,
  RecentInvoices,
  TopCustomers,
  SstComplianceWidget,
} from "@/components/dashboard";
import {
  CurrencyDollarIcon,
  FileTextIcon,
  ClockIcon,
  AlertTriangleIcon,
  TrendingUp,
  Receipt,
} from "@/components/ui/icons";

export function Dashboard() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const [view, setView] = useState<DashboardView>("overview");
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d" | "90d" | "12m">("30d");

  const queryEnabled = !!user && !isAuthLoading;

  // Use fast stats endpoint for better performance
  const { data: stats, isLoading: statsLoading } = useDashboardStats({
    enabled: queryEnabled,
  });

  const { data: topCustomers, isLoading: customersLoading } = useTopCustomers(5, {
    enabled: queryEnabled,
  });

  // Legacy queries for Metrics view
  const { data: chartData, isLoading: chartLoading } = useRevenueChart(chartPeriod, {
    enabled: queryEnabled && view === "metrics",
  });
  const { data: statusBreakdown, isLoading: statusLoading } = useInvoiceStatusDistribution({
    enabled: queryEnabled && view === "metrics",
  });
  const { data: recentInvoices, isLoading: invoicesLoading } = useRecentInvoices(5, {
    enabled: queryEnabled && view === "metrics",
  });

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";
  const currency = stats?.currency ?? "MYR";

  return (
    <PageContainer className="pb-8">
      <DashboardHeader
        userName={firstName}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        view={view}
        onViewChange={setView}
        className="mb-6"
      />

      {view === "overview" ? (
        <div className="space-y-6">
          {/* Business Health - Single summary card */}
          <BusinessHealthCard
            stats={stats}
            isLoading={statsLoading}
          />

          {/* Key Metrics - Only 3 essential cards */}
          <KeyMetrics
            stats={stats}
            isLoading={statsLoading}
          />
        </div>
      ) : (
        <>
          {/* Legacy Metrics View */}
          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <StatCard
              label="Total Revenue"
              value={stats ? formatCurrency(stats.totalRevenue, currency) : "-"}
              description="Revenue from all paid invoices"
              icon={<CurrencyDollarIcon className="size-4" />}
              isLoading={statsLoading}
            />
            <StatCard
              label="This Month"
              value={stats ? formatCurrency(stats.revenueThisMonth, currency) : "-"}
              description={`${stats?.paidThisMonth ?? 0} invoices paid`}
              subdescription="Revenue collected this month"
              icon={<TrendingUp className="size-4" />}
              isLoading={statsLoading}
            />
            <StatCard
              label="Pending"
              value={stats ? formatCurrency(stats.pendingAmount, currency) : "-"}
              description="Awaiting payment"
              icon={<ClockIcon className="size-4" />}
              isLoading={statsLoading}
            />
            <StatCard
              label="Overdue"
              value={stats?.overdueCount ?? 0}
              description={
                stats
                  ? `${formatCurrency(stats.overdueAmount, currency)} outstanding`
                  : undefined
              }
              icon={<AlertTriangleIcon className="size-4" />}
              isLoading={statsLoading}
            />
          </div>

          {/* Quotation Stats */}
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <StatCard
              label="Total Invoices"
              value={stats?.totalInvoices ?? 0}
              description="All invoices created"
              icon={<FileTextIcon className="size-4" />}
              isLoading={statsLoading}
            />
            <StatCard
              label="Total Quotations"
              value={stats?.totalQuotations ?? 0}
              description="All quotations created"
              icon={<Receipt className="size-4" />}
              isLoading={statsLoading}
            />
            <StatCard
              label="Conversion Rate"
              value={`${stats?.conversionRate ?? 0}%`}
              description={`${stats?.convertedQuotations ?? 0} converted to invoices`}
              isLoading={statsLoading}
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 lg:grid-cols-3 mb-4">
            <RevenueChart
              data={chartData ?? []}
              currency={currency}
              period={chartPeriod}
              onPeriodChange={setChartPeriod}
              isLoading={chartLoading}
              className="lg:col-span-2"
            />
            <InvoiceStatusChart
              data={
                statusBreakdown ?? {
                  pending: 0,
                  paid: 0,
                  overdue: 0,
                  expired: 0,
                  refunded: 0,
                }
              }
              isLoading={statusLoading}
            />
          </div>

          {/* Bottom Row */}
          <div className="grid gap-4 lg:grid-cols-2 mb-4">
            <RecentInvoices
              invoices={recentInvoices ?? []}
              isLoading={invoicesLoading}
            />
            <TopCustomers
              customers={topCustomers ?? []}
              currency={currency}
              isLoading={customersLoading}
            />
          </div>

          {/* Compliance Row */}
          <div className="grid gap-4 lg:grid-cols-3">
            <SstComplianceWidget />
          </div>
        </>
      )}
    </PageContainer>
  );
}
