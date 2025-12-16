/**
 * Profit & Loss Statement
 * Clean, elegant income statement following the design system
 */

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useProfitLossReport } from "@/api/ledger";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Scale,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  ReportSection,
  ReportSummaryCard,
  ReportHeader,
  ReportAccountRow,
  ReportTotalRow,
  ReportHighlightCard,
  DateRangePicker,
} from "@/components/reports";

function formatCurrency(amount: string | number): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const end = new Date(endDate).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `${start} - ${end}`;
}

function getDefaultDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: now.toISOString().split("T")[0] ?? `${year}-12-31`,
  };
}

export function ProfitLoss() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);

  const { data: report, isLoading } = useProfitLossReport(startDate, endDate, {
    enabled: !!user && !isAuthLoading,
  });

  const metrics = useMemo(() => {
    if (!report) return null;
    const netProfit = parseFloat(report.netProfit);
    const grossProfit = parseFloat(report.grossProfit);
    const revenue = parseFloat(report.revenue.total);
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      netProfit,
      grossProfit,
      revenue,
      grossMargin,
      netMargin,
      isProfitable: netProfit > 0,
      isLoss: netProfit < 0,
    };
  }, [report]);

  if (isLoading || isAuthLoading) {
    return (
      <PageSkeleton
        title="Profit & Loss"
        description="View your income and expenses"
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Profit & Loss Statement"
        description="Income statement showing revenue, expenses, and net profit"
        action={
          <Link to="/trial-balance">
            <Button variant="outline">
              <Scale className="size-4" />
              Trial Balance
            </Button>
          </Link>
        }
      />

      {/* Date Filter and Status */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        <div className="flex items-center gap-3">
          {metrics && (
            <Badge
              variant={metrics.isProfitable ? "default" : "destructive"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5",
                metrics.isProfitable
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : metrics.isLoss
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    : ""
              )}
            >
              {metrics.isProfitable ? (
                <>
                  <TrendingUp className="size-4" />
                  <span>Profitable</span>
                </>
              ) : metrics.isLoss ? (
                <>
                  <TrendingDown className="size-4" />
                  <span>Loss</span>
                </>
              ) : (
                <span>Break Even</span>
              )}
            </Badge>
          )}
          <Button variant="outline" size="sm">
            <Download className="size-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!report ? (
        <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-12 text-center">
          <TrendingUp className="text-muted-foreground/50 mb-4 size-12" />
          <div className="text-muted-foreground">
            No data for selected period
          </div>
          <div className="text-muted-foreground/70 mt-1 text-sm">
            Post journal entries to see your income statement
          </div>
          <Link to="/journal-entries" className="mt-4">
            <Button variant="outline" size="sm">
              View Journal Entries
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6 print:space-y-4">
          {/* Report Header */}
          <ReportHeader
            title="Income Statement"
            subtitle="Profit & Loss Report"
            period={formatDateRange(startDate, endDate)}
          />

          {/* Key Metrics */}
          <div className="grid gap-4 sm:grid-cols-3 print:hidden">
            <ReportSummaryCard
              label="Total Revenue"
              value={formatCurrency(report.revenue.total)}
            />
            <ReportSummaryCard
              label="Gross Profit"
              value={formatCurrency(report.grossProfit)}
              description={
                metrics && metrics.revenue > 0
                  ? `${metrics.grossMargin.toFixed(1)}% margin`
                  : undefined
              }
            />
            <ReportSummaryCard
              label="Net Profit"
              value={formatCurrency(report.netProfit)}
              description={
                metrics && metrics.revenue > 0
                  ? `${metrics.netMargin.toFixed(1)}% margin`
                  : undefined
              }
            />
          </div>

          {/* Revenue Section */}
          <ReportSection
            title="Revenue"
            total={formatCurrency(report.revenue.total)}
            isEmpty={report.revenue.accounts.length === 0}
            emptyMessage="No revenue recorded for this period"
          >
            {report.revenue.accounts.map((account) => (
              <ReportAccountRow
                key={account.id}
                code={account.code}
                name={account.name}
                amount={formatCurrency(account.balance)}
              />
            ))}
          </ReportSection>

          {/* Cost of Goods Sold */}
          {report.expenses.costOfGoodsSold.length > 0 && (
            <ReportSection
              title="Cost of Goods Sold"
              total={formatCurrency(report.expenses.totalCOGS)}
              showBrackets
            >
              {report.expenses.costOfGoodsSold.map((account) => (
                <ReportAccountRow
                  key={account.id}
                  code={account.code}
                  name={account.name}
                  amount={formatCurrency(account.balance)}
                  showBrackets
                />
              ))}
            </ReportSection>
          )}

          {/* Gross Profit */}
          <ReportTotalRow
            label="Gross Profit"
            amount={formatCurrency(report.grossProfit)}
          />

          {/* Operating Expenses */}
          {report.expenses.operatingExpenses.length > 0 && (
            <ReportSection
              title="Operating Expenses"
              total={formatCurrency(report.expenses.totalOperating)}
              showBrackets
            >
              {report.expenses.operatingExpenses.map((account) => (
                <ReportAccountRow
                  key={account.id}
                  code={account.code}
                  name={account.name}
                  amount={formatCurrency(account.balance)}
                  showBrackets
                />
              ))}
            </ReportSection>
          )}

          {/* Operating Profit */}
          <ReportTotalRow
            label="Operating Profit"
            amount={formatCurrency(report.operatingProfit)}
          />

          {/* Other Expenses */}
          {report.expenses.otherExpenses.length > 0 && (
            <ReportSection
              title="Other Expenses"
              total={formatCurrency(report.expenses.totalOther)}
              showBrackets
            >
              {report.expenses.otherExpenses.map((account) => (
                <ReportAccountRow
                  key={account.id}
                  code={account.code}
                  name={account.name}
                  amount={formatCurrency(account.balance)}
                  showBrackets
                />
              ))}
            </ReportSection>
          )}

          {/* Net Profit / Loss - Highlighted */}
          <ReportHighlightCard
            label="Net Profit / (Loss)"
            value={
              metrics?.isLoss
                ? `(${formatCurrency(Math.abs(parseFloat(report.netProfit)))})`
                : formatCurrency(report.netProfit)
            }
            isPositive={metrics?.isProfitable}
            metrics={
              metrics && metrics.revenue > 0
                ? [
                    {
                      label: "Revenue",
                      value: formatCurrency(metrics.revenue),
                    },
                    {
                      label: "Gross Margin",
                      value: `${metrics.grossMargin.toFixed(1)}%`,
                    },
                    {
                      label: "Net Margin",
                      value: `${metrics.netMargin.toFixed(1)}%`,
                    },
                    {
                      label: "Total Expenses",
                      value: formatCurrency(
                        metrics.revenue - metrics.netProfit
                      ),
                    },
                  ]
                : undefined
            }
          />
        </div>
      )}
    </PageContainer>
  );
}
