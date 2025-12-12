import { useState } from "react";
import { useTrialBalance } from "@/api/chart-of-accounts";
import type { TrialBalanceEntry } from "@/api/chart-of-accounts";
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
import { Scale, CheckCircleIcon, XCircleIcon, CalendarIcon, Download } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const accountTypeLabels: Record<string, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

const accountTypeOrder: Record<string, number> = {
  asset: 1,
  liability: 2,
  equity: 3,
  revenue: 4,
  expense: 5,
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: string): string {
  const value = parseFloat(amount);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function TrialBalance() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [asOfDate, setAsOfDate] = useState<string>(
    new Date().toISOString().split("T")[0] ?? ""
  );

  const { data: trialBalance, isLoading } = useTrialBalance(asOfDate, {
    enabled: !!user && !isAuthLoading,
  });

  // Group entries by account type for better organization
  const groupedEntries = trialBalance?.entries?.reduce((acc, entry) => {
    const type = entry.accountType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(entry);
    return acc;
  }, {} as Record<string, TrialBalanceEntry[]>) ?? {};

  // Sort groups by account type order
  const sortedGroups = Object.entries(groupedEntries).sort(
    ([a], [b]) => (accountTypeOrder[a] ?? 99) - (accountTypeOrder[b] ?? 99)
  );

  if (isLoading || isAuthLoading) {
    return (
      <PageSkeleton
        title="Trial Balance"
        description="Verify that debits equal credits"
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Trial Balance"
        description="Verify that debits equal credits across all accounts"
        action={
          <Link to="/chart-of-accounts">
            <Button variant="outline">
              <Scale className="size-4" />
              Chart of Accounts
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
          {trialBalance && (
            <Badge
              variant={trialBalance.isBalanced ? "default" : "destructive"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5",
                trialBalance.isBalanced
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              )}
            >
              {trialBalance.isBalanced ? (
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
      {trialBalance && (
        <div className="text-center mb-6 py-4 border-b">
          <h2 className="text-xl font-semibold">Trial Balance Report</h2>
          <p className="text-sm text-muted-foreground">
            As of {formatDate(trialBalance.asOfDate)}
          </p>
        </div>
      )}

      {/* Trial Balance Table */}
      {!trialBalance?.entries?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border bg-muted/30">
          <Scale className="size-12 text-muted-foreground/50 mb-4" />
          <div className="text-muted-foreground">No accounts with balances found</div>
          <div className="text-muted-foreground/70 text-sm mt-1">
            Post journal entries to see account balances
          </div>
          <Link to="/journal-entries" className="mt-4">
            <Button variant="outline" size="sm">
              View Journal Entries
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead className="w-28 text-center">Type</TableHead>
                <TableHead className="w-36 text-right">Debit</TableHead>
                <TableHead className="w-36 text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGroups.map(([accountType, entries]) => (
                <>
                  {/* Account Type Header */}
                  <TableRow key={`header-${accountType}`} className="bg-muted/30">
                    <TableCell colSpan={5} className="font-semibold text-sm py-2">
                      {accountTypeLabels[accountType] || accountType}
                    </TableCell>
                  </TableRow>
                  {/* Account Rows */}
                  {entries.map((entry) => {
                    const hasDebit = parseFloat(entry.debitBalance) > 0;
                    const hasCredit = parseFloat(entry.creditBalance) > 0;
                    return (
                      <TableRow key={entry.accountId} className="hover:bg-muted/20">
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {entry.code}
                        </TableCell>
                        <TableCell>{entry.name}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs text-muted-foreground capitalize">
                            {entry.normalBalance}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {hasDebit ? formatCurrency(entry.debitBalance) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {hasCredit ? formatCurrency(entry.creditBalance) : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={3} className="text-right">
                  Totals
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {trialBalance?.totalDebits ? formatCurrency(trialBalance.totalDebits) : "-"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {trialBalance?.totalCredits ? formatCurrency(trialBalance.totalCredits) : "-"}
                </TableCell>
              </TableRow>
              {trialBalance && !trialBalance.isBalanced && (
                <TableRow className="bg-red-50 dark:bg-red-900/10">
                  <TableCell colSpan={3} className="text-right text-destructive">
                    Difference
                  </TableCell>
                  <TableCell colSpan={2} className="text-right font-mono tabular-nums text-destructive">
                    {formatCurrency(
                      (parseFloat(trialBalance.totalDebits) - parseFloat(trialBalance.totalCredits)).toFixed(2)
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableFooter>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
