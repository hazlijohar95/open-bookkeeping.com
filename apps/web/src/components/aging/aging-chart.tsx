import { cn } from "@/lib/utils";

interface AgingBucket {
  label: string;
  count: number;
  amount: number;
  color: string;
}

interface AgingChartProps {
  buckets: AgingBucket[];
  currency?: string;
  className?: string;
}

export function AgingChart({ buckets, currency = "MYR", className }: AgingChartProps) {
  const totalAmount = buckets.reduce((sum, b) => sum + b.amount, 0);
  const maxAmount = Math.max(...buckets.map((b) => b.amount), 1);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-2">
        {buckets.map((bucket) => (
          <div
            key={bucket.label}
            className="rounded-lg border bg-card p-3 text-center"
          >
            <div className="text-xs text-muted-foreground mb-1">{bucket.label}</div>
            <div className="text-lg font-semibold" style={{ color: bucket.color }}>
              {bucket.count}
            </div>
            <div className="text-xs text-muted-foreground">
              {currency} {bucket.amount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="space-y-2">
        {buckets.map((bucket) => {
          const percentage = totalAmount > 0 ? (bucket.amount / totalAmount) * 100 : 0;
          const barWidth = (bucket.amount / maxAmount) * 100;

          return (
            <div key={bucket.label} className="flex items-center gap-3">
              <div className="w-20 text-xs text-muted-foreground truncate">
                {bucket.label}
              </div>
              <div className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: bucket.color,
                  }}
                />
              </div>
              <div className="w-16 text-right text-xs font-medium">
                {percentage.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="flex justify-between items-center pt-3 border-t">
        <span className="text-sm text-muted-foreground">Total Outstanding</span>
        <span className="text-lg font-semibold">
          {currency} {totalAmount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

// Predefined aging bucket configurations
export const AR_AGING_COLORS = {
  current: "#22c55e",    // Green
  days1to30: "#eab308",  // Yellow
  days31to60: "#f97316", // Orange
  days61to90: "#ef4444", // Red
  over90: "#991b1b",     // Dark red
};

export const AP_AGING_COLORS = {
  current: "#22c55e",    // Green
  days1to30: "#3b82f6",  // Blue
  days31to60: "#8b5cf6", // Purple
  days61to90: "#ec4899", // Pink
  over90: "#991b1b",     // Dark red
};

export function formatAgingBuckets(
  totals: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  },
  amounts: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  },
  type: "ar" | "ap" = "ar"
): AgingBucket[] {
  const colors = type === "ar" ? AR_AGING_COLORS : AP_AGING_COLORS;

  return [
    { label: "Current", count: totals.current, amount: amounts.current, color: colors.current },
    { label: "1-30 Days", count: totals.days1to30, amount: amounts.days1to30, color: colors.days1to30 },
    { label: "31-60 Days", count: totals.days31to60, amount: amounts.days31to60, color: colors.days31to60 },
    { label: "61-90 Days", count: totals.days61to90, amount: amounts.days61to90, color: colors.days61to90 },
    { label: "90+ Days", count: totals.over90, amount: amounts.over90, color: colors.over90 },
  ];
}
