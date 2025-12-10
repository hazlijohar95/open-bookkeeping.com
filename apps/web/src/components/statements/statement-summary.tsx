import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatementSummaryProps {
  summary: {
    openingBalance: number;
    totalDebits: number;
    totalCredits: number;
    closingBalance: number;
  };
  currency: string;
  isLoading?: boolean;
  variant?: "customer" | "vendor";
}

const formatCurrency = (value: number, currency: string) => {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
};

export function StatementSummary({
  summary,
  currency,
  isLoading = false,
  variant = "customer",
}: StatementSummaryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const isOwed = summary.closingBalance > 0;
  const balanceLabel = variant === "customer"
    ? isOwed ? "Amount Owed by Customer" : "Customer Overpaid"
    : isOwed ? "Amount Owed to Vendor" : "Vendor Overpaid";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Opening Balance</span>
          <span className="font-mono">{formatCurrency(summary.openingBalance, currency)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {variant === "customer" ? "Total Invoiced (Debit)" : "Total Billed (Credit)"}
          </span>
          <span className="font-mono">
            {formatCurrency(variant === "customer" ? summary.totalDebits : summary.totalCredits, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {variant === "customer" ? "Total Payments (Credit)" : "Total Paid (Debit)"}
          </span>
          <span className="font-mono">
            {formatCurrency(variant === "customer" ? summary.totalCredits : summary.totalDebits, currency)}
          </span>
        </div>
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{balanceLabel}</span>
            <span
              className={cn(
                "font-mono text-lg font-bold",
                summary.closingBalance > 0
                  ? variant === "customer"
                    ? "text-warning-foreground dark:text-warning"
                    : "text-destructive"
                  : "text-success"
              )}
            >
              {formatCurrency(Math.abs(summary.closingBalance), currency)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
