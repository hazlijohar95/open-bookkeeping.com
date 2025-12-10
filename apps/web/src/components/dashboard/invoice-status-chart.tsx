import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatusBreakdown {
  pending: number;
  paid: number;
  overdue: number;
  expired: number;
  refunded: number;
}

interface InvoiceStatusChartProps {
  data: StatusBreakdown;
  isLoading?: boolean;
  className?: string;
}

const STATUS_CONFIG = {
  paid: {
    label: "Paid",
    color: "oklch(0.72 0.19 142)", // --success
    bgClass: "bg-success",
  },
  pending: {
    label: "Pending",
    color: "oklch(0.75 0.18 55)", // --warning
    bgClass: "bg-warning",
  },
  overdue: {
    label: "Overdue",
    color: "oklch(0.577 0.245 27.325)", // --destructive
    bgClass: "bg-destructive",
  },
  expired: {
    label: "Expired",
    color: "oklch(0.552 0.016 285.938)", // --muted-foreground
    bgClass: "bg-muted-foreground",
  },
  refunded: {
    label: "Refunded",
    color: "oklch(0.62 0.21 262)", // --primary
    bgClass: "bg-primary",
  },
};

export function InvoiceStatusChart({
  data,
  isLoading = false,
  className,
}: InvoiceStatusChartProps) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: STATUS_CONFIG[key as keyof StatusBreakdown].label,
        value,
        color: STATUS_CONFIG[key as keyof StatusBreakdown].color,
        key,
      }));
  }, [data]);

  const totalInvoices = useMemo(() => {
    return Object.values(data).reduce((sum, val) => sum + val, 0);
  }, [data]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <Skeleton className="size-[180px] rounded-full" />
          </div>
          <div className="mt-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Invoice Status</CardTitle>
        <CardDescription>{totalInvoices} total invoices</CardDescription>
      </CardHeader>
      <CardContent>
        {totalInvoices === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-muted-foreground">
            No invoices yet
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center">
              <div className="relative size-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0]?.payload;
                        const percentage = ((data.value / totalInvoices) * 100).toFixed(0);
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-md">
                            <p className="text-sm font-medium">{data.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {data.value} ({percentage}%)
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{totalInvoices}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                const value = data[key as keyof StatusBreakdown];
                if (value === 0) return null;
                const percentage = ((value / totalInvoices) * 100).toFixed(0);
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className={cn("size-3 rounded-full", config.bgClass)} />
                    <span className="text-sm text-muted-foreground">
                      {config.label}: {value} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
