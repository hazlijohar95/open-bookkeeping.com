import { useState } from "react";
import { useProfitLossReport } from "@/api/ledger";
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
  TrendingUp,
  TrendingDown,
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

// Get default date range (current year)
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
  const [startDate, setStartDate] = useState<string>(defaults.startDate);
  const [endDate, setEndDate] = useState<string>(defaults.endDate);

  const { data: report, isLoading } = useProfitLossReport(startDate, endDate, {
    enabled: !!user && !isAuthLoading,
  });

  const isProfitable = report ? parseFloat(report.netProfit) > 0 : false;
  const isLoss = report ? parseFloat(report.netProfit) < 0 : false;

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
              <ChevronRightIcon className="size-4" />
              Trial Balance
            </Button>
          </Link>
        }
      />

      {/* Date Range Filter */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">From:</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
          <span className="text-sm text-muted-foreground">To:</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="flex items-center gap-3">
          {report && (
            <Badge
              variant={isProfitable ? "default" : isLoss ? "destructive" : "secondary"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5",
                isProfitable
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : isLoss
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    : ""
              )}
            >
              {isProfitable ? (
                <>
                  <TrendingUp className="size-4" />
                  <span>Profitable</span>
                </>
              ) : isLoss ? (
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

      {/* Report Header */}
      {report && (
        <div className="text-center mb-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Income Statement</h2>
          <p className="text-sm text-muted-foreground">
            For the period {formatDateRange(startDate, endDate)}
          </p>
        </div>
      )}

      {/* P&L Report */}
      {!report ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border bg-muted/30">
          <TrendingUp className="size-12 text-muted-foreground/50 mb-4" />
          <div className="text-muted-foreground">No data for selected period</div>
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
        <div className="space-y-6">
          {/* Revenue Section */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-green-50 dark:bg-green-900/20">
                  <TableHead colSpan={2} className="font-semibold text-green-800 dark:text-green-400">
                    Revenue
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.revenue.accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                      No revenue recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  report.revenue.accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <span className="font-mono text-sm text-muted-foreground mr-2">
                          {account.code}
                        </span>
                        {account.name}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums w-40">
                        {formatCurrency(account.balance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-green-50/50 dark:bg-green-900/10 font-semibold">
                  <TableCell>Total Revenue</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCurrency(report.revenue.total)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Cost of Goods Sold Section */}
          {report.expenses.costOfGoodsSold.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-orange-50 dark:bg-orange-900/20">
                    <TableHead colSpan={2} className="font-semibold text-orange-800 dark:text-orange-400">
                      Cost of Goods Sold
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.expenses.costOfGoodsSold.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <span className="font-mono text-sm text-muted-foreground mr-2">
                          {account.code}
                        </span>
                        {account.name}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums w-40">
                        ({formatCurrency(account.balance)})
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-orange-50/50 dark:bg-orange-900/10 font-semibold">
                    <TableCell>Total COGS</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      ({formatCurrency(report.expenses.totalCOGS)})
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          {/* Gross Profit */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-lg">Gross Profit</span>
              <span
                className={cn(
                  "font-mono tabular-nums text-lg font-semibold",
                  parseFloat(report.grossProfit) >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatCurrency(report.grossProfit)}
              </span>
            </div>
          </div>

          {/* Operating Expenses Section */}
          {report.expenses.operatingExpenses.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-red-50 dark:bg-red-900/20">
                    <TableHead colSpan={2} className="font-semibold text-red-800 dark:text-red-400">
                      Operating Expenses
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.expenses.operatingExpenses.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <span className="font-mono text-sm text-muted-foreground mr-2">
                          {account.code}
                        </span>
                        {account.name}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums w-40">
                        ({formatCurrency(account.balance)})
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-red-50/50 dark:bg-red-900/10 font-semibold">
                    <TableCell>Total Operating Expenses</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      ({formatCurrency(report.expenses.totalOperating)})
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          {/* Operating Profit */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-lg">Operating Profit</span>
              <span
                className={cn(
                  "font-mono tabular-nums text-lg font-semibold",
                  parseFloat(report.operatingProfit) >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatCurrency(report.operatingProfit)}
              </span>
            </div>
          </div>

          {/* Other Expenses Section */}
          {report.expenses.otherExpenses.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-900/20">
                    <TableHead colSpan={2} className="font-semibold">
                      Other Expenses
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.expenses.otherExpenses.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <span className="font-mono text-sm text-muted-foreground mr-2">
                          {account.code}
                        </span>
                        {account.name}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums w-40">
                        ({formatCurrency(account.balance)})
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-semibold">
                    <TableCell>Total Other Expenses</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      ({formatCurrency(report.expenses.totalOther)})
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          {/* Net Profit */}
          <div
            className={cn(
              "rounded-lg border p-6",
              isProfitable
                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                : isLoss
                  ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                  : "bg-muted/30"
            )}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-xl">Net Profit / (Loss)</span>
              <span
                className={cn(
                  "font-mono tabular-nums text-2xl font-bold",
                  isProfitable
                    ? "text-green-600 dark:text-green-400"
                    : isLoss
                      ? "text-red-600 dark:text-red-400"
                      : ""
                )}
              >
                {isLoss ? `(${formatCurrency(Math.abs(parseFloat(report.netProfit)).toString())})` : formatCurrency(report.netProfit)}
              </span>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
