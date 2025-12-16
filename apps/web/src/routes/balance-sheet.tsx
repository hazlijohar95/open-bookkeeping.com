/**
 * Balance Sheet
 * Statement of Financial Position following the design system
 */

import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useBalanceSheetReport } from "@/api/ledger";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  CheckCircleIcon,
  XCircleIcon,
  Download,
  Scale,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  ReportSection,
  ReportSummaryCard,
  ReportHeader,
  ReportAccountRow,
  SingleDatePicker,
} from "@/components/reports";

function formatCurrency(amount: string | number): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function BalanceSheet() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [asOfDate, setAsOfDate] = useState(
    new Date().toISOString().split("T")[0] ?? ""
  );

  const { data: report, isLoading } = useBalanceSheetReport(asOfDate, {
    enabled: !!user && !isAuthLoading,
  });

  const metrics = useMemo(() => {
    if (!report) return null;

    const totalAssets = parseFloat(report.assets.total);
    const totalLiabilities = parseFloat(report.liabilities.total);
    const totalEquity = parseFloat(report.equity.total);
    const currentRatio =
      parseFloat(report.liabilities.totalCurrent) > 0
        ? parseFloat(report.assets.totalCurrent) /
          parseFloat(report.liabilities.totalCurrent)
        : 0;
    const debtToEquity = totalEquity > 0 ? totalLiabilities / totalEquity : 0;

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      currentRatio,
      debtToEquity,
      isBalanced: report.isBalanced,
    };
  }, [report]);

  if (isLoading || isAuthLoading) {
    return (
      <PageSkeleton
        title="Balance Sheet"
        description="View your financial position"
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Balance Sheet"
        description="Statement of financial position showing assets, liabilities, and equity"
        action={
          <Link to="/profit-loss">
            <Button variant="outline">
              <Scale className="size-4" />
              Profit & Loss
            </Button>
          </Link>
        }
      />

      {/* Date Filter and Balance Status */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <SingleDatePicker
          date={asOfDate}
          onDateChange={setAsOfDate}
          label="As of"
        />

        <div className="flex items-center gap-3">
          {report && (
            <Badge
              variant={report.isBalanced ? "default" : "destructive"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5",
                report.isBalanced
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              )}
            >
              {report.isBalanced ? (
                <>
                  <CheckCircleIcon className="size-4" />
                  <span>Balanced</span>
                </>
              ) : (
                <>
                  <XCircleIcon className="size-4" />
                  <span>Unbalanced</span>
                </>
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
          <Building2 className="text-muted-foreground/50 mb-4 size-12" />
          <div className="text-muted-foreground">No data available</div>
          <div className="text-muted-foreground/70 mt-1 text-sm">
            Post journal entries to see your financial position
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
            title="Statement of Financial Position"
            subtitle="Balance Sheet"
            period={`As of ${formatDate(report.asOfDate)}`}
          />

          {/* Key Metrics */}
          <div className="grid gap-4 sm:grid-cols-4 print:hidden">
            <ReportSummaryCard
              label="Total Assets"
              value={formatCurrency(report.assets.total)}
            />
            <ReportSummaryCard
              label="Total Liabilities"
              value={formatCurrency(report.liabilities.total)}
            />
            <ReportSummaryCard
              label="Total Equity"
              value={formatCurrency(report.equity.total)}
            />
            {metrics && metrics.currentRatio > 0 && (
              <ReportSummaryCard
                label="Current Ratio"
                value={metrics.currentRatio.toFixed(2)}
                description={metrics.currentRatio >= 1 ? "Healthy" : "Low"}
              />
            )}
          </div>

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2 print:gap-4">
            {/* Left Column: Assets */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Assets</h3>

              {/* Current Assets */}
              <ReportSection
                title="Current Assets"
                total={formatCurrency(report.assets.totalCurrent)}
                isEmpty={report.assets.currentAssets.length === 0}
                emptyMessage="No current assets"
              >
                {report.assets.currentAssets.map((account) => (
                  <ReportAccountRow
                    key={account.id}
                    code={account.code}
                    name={account.name}
                    amount={formatCurrency(account.balance)}
                  />
                ))}
              </ReportSection>

              {/* Non-Current Assets */}
              <ReportSection
                title="Non-Current Assets"
                total={formatCurrency(report.assets.totalFixed)}
                isEmpty={report.assets.fixedAssets.length === 0}
                emptyMessage="No non-current assets"
              >
                {report.assets.fixedAssets.map((account) => (
                  <ReportAccountRow
                    key={account.id}
                    code={account.code}
                    name={account.name}
                    amount={formatCurrency(account.balance)}
                  />
                ))}
              </ReportSection>

              {/* Total Assets */}
              <Card className="bg-muted/50">
                <CardContent className="flex items-center justify-between py-4">
                  <span className="font-semibold">Total Assets</span>
                  <span className="font-mono text-xl font-semibold tabular-nums">
                    {formatCurrency(report.assets.total)}
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Liabilities & Equity */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Liabilities & Equity</h3>

              {/* Current Liabilities */}
              <ReportSection
                title="Current Liabilities"
                total={formatCurrency(report.liabilities.totalCurrent)}
                isEmpty={report.liabilities.currentLiabilities.length === 0}
                emptyMessage="No current liabilities"
              >
                {report.liabilities.currentLiabilities.map((account) => (
                  <ReportAccountRow
                    key={account.id}
                    code={account.code}
                    name={account.name}
                    amount={formatCurrency(account.balance)}
                  />
                ))}
              </ReportSection>

              {/* Non-Current Liabilities */}
              <ReportSection
                title="Non-Current Liabilities"
                total={formatCurrency(report.liabilities.totalNonCurrent)}
                isEmpty={report.liabilities.nonCurrentLiabilities.length === 0}
                emptyMessage="No non-current liabilities"
              >
                {report.liabilities.nonCurrentLiabilities.map((account) => (
                  <ReportAccountRow
                    key={account.id}
                    code={account.code}
                    name={account.name}
                    amount={formatCurrency(account.balance)}
                  />
                ))}
              </ReportSection>

              {/* Total Liabilities */}
              <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-none border px-4 py-3">
                <span className="text-sm font-semibold">Total Liabilities</span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatCurrency(report.liabilities.total)}
                </span>
              </div>

              {/* Equity */}
              <ReportSection
                title="Equity"
                total={formatCurrency(report.equity.total)}
              >
                {report.equity.accounts.map((account) => (
                  <ReportAccountRow
                    key={account.id}
                    code={account.code}
                    name={account.name}
                    amount={formatCurrency(account.balance)}
                  />
                ))}
                {parseFloat(report.equity.currentYearEarnings) !== 0 && (
                  <div className="bg-muted/20 flex items-center justify-between px-4 py-2.5">
                    <span className="text-muted-foreground text-sm italic">
                      Current Year Earnings
                    </span>
                    <span className="font-mono text-sm italic tabular-nums">
                      {formatCurrency(report.equity.currentYearEarnings)}
                    </span>
                  </div>
                )}
              </ReportSection>

              {/* Total Liabilities & Equity */}
              <Card className="bg-muted/50">
                <CardContent className="flex items-center justify-between py-4">
                  <span className="font-semibold">
                    Total Liabilities & Equity
                  </span>
                  <span className="font-mono text-xl font-semibold tabular-nums">
                    {formatCurrency(report.totalLiabilitiesAndEquity)}
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Balance Check Warning */}
          {!report.isBalanced && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-destructive flex items-center gap-2">
                  <XCircleIcon className="size-5" />
                  Balance Sheet is not balanced
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  There is a difference of{" "}
                  <span className="font-mono font-semibold">
                    {formatCurrency(
                      Math.abs(
                        parseFloat(report.assets.total) -
                          parseFloat(report.totalLiabilitiesAndEquity)
                      )
                    )}
                  </span>{" "}
                  between Assets and Liabilities + Equity. Please review your
                  journal entries for any discrepancies.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Financial Ratios */}
          {metrics && (
            <Card className="print:hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Key Financial Ratios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <div className="text-muted-foreground text-sm">
                      Current Ratio
                    </div>
                    <div className="font-mono text-lg font-semibold tabular-nums">
                      {metrics.currentRatio > 0
                        ? metrics.currentRatio.toFixed(2)
                        : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-sm">
                      Debt to Equity
                    </div>
                    <div className="font-mono text-lg font-semibold tabular-nums">
                      {metrics.debtToEquity > 0
                        ? metrics.debtToEquity.toFixed(2)
                        : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-sm">
                      Total Assets
                    </div>
                    <div className="font-mono text-lg font-semibold tabular-nums">
                      {formatCurrency(metrics.totalAssets)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-sm">
                      Net Worth
                    </div>
                    <div className="font-mono text-lg font-semibold tabular-nums">
                      {formatCurrency(metrics.totalEquity)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}
