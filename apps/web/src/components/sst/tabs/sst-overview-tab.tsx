import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ChartPeriod } from "./types";
import { formatPeriodLabel } from "./types";

interface SSTTrendChartData {
  month: string;
  salesTax: number;
  serviceTax: number;
  total: number;
}

interface ReturnSubmission {
  id: string;
  taxPeriodCode: string;
  totalSalesTax: number;
  totalServiceTax: number;
  totalTaxPayable: number;
  status: string;
  referenceNumber?: string | null;
}

interface SSTOverviewTabProps {
  chartData: SSTTrendChartData[] | undefined;
  chartLoading: boolean;
  chartPeriod: ChartPeriod;
  setChartPeriod: (period: ChartPeriod) => void;
  submissions: ReturnSubmission[] | undefined;
  currency?: string;
}

export function SSTOverviewTab({
  chartData,
  chartLoading,
  chartPeriod,
  setChartPeriod,
  submissions,
  currency = "MYR",
}: SSTOverviewTabProps) {
  return (
    <div className="space-y-4">
      {/* SST Trend Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">SST Trend</CardTitle>
            <CardDescription>Monthly breakdown of Sales and Service Tax</CardDescription>
          </div>
          <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as ChartPeriod)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">6 months</SelectItem>
              <SelectItem value="12m">12 months</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <div className="h-[300px]">
              {!chartData?.length ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No SST data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value) => {
                        const [year, month] = value.split("-");
                        return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-MY", {
                          month: "short",
                        });
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value) => `RM${value}`}
                      width={70}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0]?.payload;
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-md">
                            <p className="text-sm font-medium">{formatPeriodLabel(data.month)}</p>
                            <div className="mt-2 space-y-1">
                              <p className="text-sm">
                                <span className="text-primary">Sales Tax:</span>{" "}
                                {formatCurrency(data.salesTax, currency)}
                              </p>
                              <p className="text-sm">
                                <span className="text-success">Service Tax:</span>{" "}
                                {formatCurrency(data.serviceTax, currency)}
                              </p>
                              <p className="text-sm font-medium">
                                Total: {formatCurrency(data.total, currency)}
                              </p>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Bar dataKey="salesTax" name="Sales Tax" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="serviceTax" name="Service Tax" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Return Submission History</CardTitle>
          <CardDescription>Track your SST-02 return submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {!submissions?.length ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No submissions recorded yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Sales Tax</TableHead>
                  <TableHead>Service Tax</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{formatPeriodLabel(s.taxPeriodCode)}</TableCell>
                    <TableCell>{formatCurrency(s.totalSalesTax, currency)}</TableCell>
                    <TableCell>{formatCurrency(s.totalServiceTax, currency)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(s.totalTaxPayable, currency)}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "submitted" ? "default" : "secondary"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.referenceNumber ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
