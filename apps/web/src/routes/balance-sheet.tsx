import { useState } from "react";
import { useBalanceSheetReport } from "@/api/ledger";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Building2,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  Download,
  ChevronRightIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

function formatCurrency(amount: string): string {
  const value = parseFloat(amount);
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
  const [asOfDate, setAsOfDate] = useState<string>(
    new Date().toISOString().split("T")[0] ?? ""
  );

  const { data: report, isLoading } = useBalanceSheetReport(asOfDate, {
    enabled: !!user && !isAuthLoading,
  });

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
              <ChevronRightIcon className="size-4" />
              Profit & Loss
            </Button>
          </Link>
        }
      />

      {/* Date Filter and Balance Status */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">As of:</span>
          <Input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-40"
          />
        </div>

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

      {/* Report Header */}
      {report && (
        <div className="text-center mb-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Statement of Financial Position</h2>
          <p className="text-sm text-muted-foreground">
            As of {formatDate(report.asOfDate)}
          </p>
        </div>
      )}

      {/* Balance Sheet Report */}
      {!report ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border bg-muted/30">
          <Building2 className="size-12 text-muted-foreground/50 mb-4" />
          <div className="text-muted-foreground">No data available</div>
          <div className="text-muted-foreground/70 text-sm mt-1">
            Post journal entries to see financial data
          </div>
          <Link to="/journal-entries" className="mt-4">
            <Button variant="outline" size="sm">
              View Journal Entries
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Assets */}
          <div className="space-y-6">
            {/* Current Assets */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50 dark:bg-blue-900/20">
                    <TableHead colSpan={2} className="font-semibold text-blue-800 dark:text-blue-400">
                      Current Assets
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.assets.currentAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                        No current assets
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.assets.currentAssets.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <span className="font-mono text-sm text-muted-foreground mr-2">
                            {account.code}
                          </span>
                          {account.name}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums w-32">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-blue-50/50 dark:bg-blue-900/10">
                    <TableCell className="font-semibold">Total Current Assets</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(report.assets.totalCurrent)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Fixed Assets */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-indigo-50 dark:bg-indigo-900/20">
                    <TableHead colSpan={2} className="font-semibold text-indigo-800 dark:text-indigo-400">
                      Non-Current Assets
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.assets.fixedAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                        No non-current assets
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.assets.fixedAssets.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <span className="font-mono text-sm text-muted-foreground mr-2">
                            {account.code}
                          </span>
                          {account.name}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums w-32">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-indigo-50/50 dark:bg-indigo-900/10">
                    <TableCell className="font-semibold">Total Non-Current Assets</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(report.assets.totalFixed)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Total Assets */}
            <div className="rounded-lg border bg-blue-100 dark:bg-blue-900/30 p-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg text-blue-800 dark:text-blue-300">Total Assets</span>
                <span className="font-mono tabular-nums text-xl font-bold text-blue-800 dark:text-blue-300">
                  {formatCurrency(report.assets.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Liabilities & Equity */}
          <div className="space-y-6">
            {/* Current Liabilities */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-orange-50 dark:bg-orange-900/20">
                    <TableHead colSpan={2} className="font-semibold text-orange-800 dark:text-orange-400">
                      Current Liabilities
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.liabilities.currentLiabilities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                        No current liabilities
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.liabilities.currentLiabilities.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <span className="font-mono text-sm text-muted-foreground mr-2">
                            {account.code}
                          </span>
                          {account.name}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums w-32">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-orange-50/50 dark:bg-orange-900/10">
                    <TableCell className="font-semibold">Total Current Liabilities</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(report.liabilities.totalCurrent)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Non-Current Liabilities */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-50 dark:bg-amber-900/20">
                    <TableHead colSpan={2} className="font-semibold text-amber-800 dark:text-amber-400">
                      Non-Current Liabilities
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.liabilities.nonCurrentLiabilities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                        No non-current liabilities
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.liabilities.nonCurrentLiabilities.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell>
                          <span className="font-mono text-sm text-muted-foreground mr-2">
                            {account.code}
                          </span>
                          {account.name}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums w-32">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-amber-50/50 dark:bg-amber-900/10">
                    <TableCell className="font-semibold">Total Non-Current Liabilities</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(report.liabilities.totalNonCurrent)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Total Liabilities */}
            <div className="rounded-lg border bg-orange-100 dark:bg-orange-900/30 p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-orange-800 dark:text-orange-300">Total Liabilities</span>
                <span className="font-mono tabular-nums text-lg font-semibold text-orange-800 dark:text-orange-300">
                  {formatCurrency(report.liabilities.total)}
                </span>
              </div>
            </div>

            {/* Equity */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-purple-50 dark:bg-purple-900/20">
                    <TableHead colSpan={2} className="font-semibold text-purple-800 dark:text-purple-400">
                      Equity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.equity.accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <span className="font-mono text-sm text-muted-foreground mr-2">
                          {account.code}
                        </span>
                        {account.name}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums w-32">
                        {formatCurrency(account.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parseFloat(report.equity.currentYearEarnings) !== 0 && (
                    <TableRow>
                      <TableCell className="italic text-muted-foreground">
                        Current Year Earnings
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums w-32 italic">
                        {formatCurrency(report.equity.currentYearEarnings)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-purple-50/50 dark:bg-purple-900/10">
                    <TableCell className="font-semibold">Total Equity</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(report.equity.total)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Total Liabilities & Equity */}
            <div className="rounded-lg border bg-purple-100 dark:bg-purple-900/30 p-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg text-purple-800 dark:text-purple-300">
                  Total Liabilities & Equity
                </span>
                <span className="font-mono tabular-nums text-xl font-bold text-purple-800 dark:text-purple-300">
                  {formatCurrency(report.totalLiabilitiesAndEquity)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balance Check */}
      {report && !report.isBalanced && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
            <XCircleIcon className="size-5" />
            <span className="font-semibold">Balance Sheet is not balanced</span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            Difference: {formatCurrency(
              (parseFloat(report.assets.total) - parseFloat(report.totalLiabilitiesAndEquity)).toFixed(2)
            )}
          </p>
        </div>
      )}
    </PageContainer>
  );
}
