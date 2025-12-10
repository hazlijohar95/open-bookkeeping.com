import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { formatCurrency, cn } from "@/lib/utils";
import {
  useSSTSummary,
  useSSTTrendChart,
  useSSTTransactions,
  useAvailablePeriods,
  useSST02Return,
  useReturnSubmissions,
  useComplianceStatus,
  useBusinessCategories,
  useUpdateComplianceSettings,
} from "@/api/sst";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Filter,
  Calendar,
  Building2,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Phone,
  BookOpen,
  ClipboardList,
  Save,
  Loader2,
} from "@/components/ui/icons";
import {
  ComplianceProgress,
  ComplianceStatusBadge,
  getComplianceMessage,
  type ComplianceStatus,
} from "@/components/sst/compliance-progress";

type PeriodType = "current_month" | "last_month" | "quarter" | "year";
type ChartPeriod = "6m" | "12m";
type TaxTypeFilter = "all" | "sales_tax" | "service_tax";
type DocumentTypeFilter = "all" | "invoice" | "credit_note" | "debit_note";

type TabValue = "overview" | "transactions" | "sst02" | "compliance";

export function SST() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summaryPeriod, setSummaryPeriod] = useState<PeriodType>("current_month");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("6m");
  const [taxTypeFilter, setTaxTypeFilter] = useState<TaxTypeFilter>("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<DocumentTypeFilter>("all");
  const [transactionPage, setTransactionPage] = useState(1);
  const [selectedReturnPeriod, setSelectedReturnPeriod] = useState<string>("");

  // Compliance settings state
  const [complianceBusinessCategory, setComplianceBusinessCategory] = useState<string>("");
  const [complianceManualRevenue, setComplianceManualRevenue] = useState<string>("");
  const [complianceUseManualRevenue, setComplianceUseManualRevenue] = useState<boolean>(false);
  const [complianceRegistrationNumber, setComplianceRegistrationNumber] = useState<string>("");
  const [isComplianceDirty, setIsComplianceDirty] = useState(false);

  const queryEnabled = !!user && !isAuthLoading;

  // Handle tab from URL
  const activeTab = (searchParams.get("tab") as TabValue) || "overview";
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // API queries
  const { data: summary, isLoading: summaryLoading } = useSSTSummary(
    { period: summaryPeriod },
    { enabled: queryEnabled }
  );

  const { data: chartData, isLoading: chartLoading } = useSSTTrendChart(
    chartPeriod,
    { enabled: queryEnabled }
  );

  const { data: transactions, isLoading: transactionsLoading } = useSSTTransactions(
    {
      page: transactionPage,
      pageSize: 20,
      taxType: taxTypeFilter,
      documentType: documentTypeFilter,
    },
    { enabled: queryEnabled }
  );

  const { data: availablePeriods } = useAvailablePeriods({
    enabled: queryEnabled,
  });

  const { data: sst02Return, isLoading: returnLoading } = useSST02Return(
    selectedReturnPeriod,
    { enabled: queryEnabled && !!selectedReturnPeriod }
  );

  const { data: submissions } = useReturnSubmissions({
    enabled: queryEnabled,
  });

  // Compliance queries
  const { data: complianceStatus, isLoading: complianceLoading, refetch: refetchCompliance } = useComplianceStatus({
    enabled: queryEnabled,
  });

  const { data: businessCategories } = useBusinessCategories({
    enabled: queryEnabled,
  });

  const updateComplianceMutation = useUpdateComplianceSettings();

  // Sync compliance form state when data loads
  useEffect(() => {
    if (complianceStatus && !isComplianceDirty) {
      setComplianceBusinessCategory(complianceStatus.businessCategory || "other_services");
      setComplianceManualRevenue(complianceStatus.manualRevenue?.toString() || "");
      setComplianceUseManualRevenue(complianceStatus.useManualRevenue || false);
      setComplianceRegistrationNumber(complianceStatus.registrationNumber || "");
    }
  }, [complianceStatus, isComplianceDirty]);

  const handleSaveCompliance = () => {
    updateComplianceMutation.mutate(
      {
        businessCategory: complianceBusinessCategory,
        manualRevenue: complianceManualRevenue ? parseFloat(complianceManualRevenue) : undefined,
        useManualRevenue: complianceUseManualRevenue,
        registrationNumber: complianceRegistrationNumber || null,
      },
      {
        onSuccess: () => {
          refetchCompliance();
          setIsComplianceDirty(false);
        },
      }
    );
  };

  // Set default period
  useMemo(() => {
    if (availablePeriods?.length && !selectedReturnPeriod) {
      setSelectedReturnPeriod(availablePeriods[0] || "");
    }
  }, [availablePeriods, selectedReturnPeriod]);

  const currency = "MYR";

  const formatPeriodLabel = (period: string) => {
    const [year, month] = period.split("-");
    const date = new Date(Number(year), Number(month) - 1);
    return date.toLocaleDateString("en-MY", { month: "long", year: "numeric" });
  };

  const exportToCSV = () => {
    if (!sst02Return?.transactions.length) return;

    const headers = [
      "Document Type",
      "Document Number",
      "Document Date",
      "Customer Name",
      "Customer TIN",
      "Tax Type",
      "Tax Rate (%)",
      "Taxable Amount",
      "Tax Amount",
    ];

    const rows = sst02Return.transactions.map((t) => [
      t.documentType,
      t.documentNumber || "",
      new Date(t.documentDate).toLocaleDateString("en-MY"),
      t.customerName || "",
      t.customerTin || "",
      t.taxType === "sales_tax" ? "Sales Tax" : "Service Tax",
      t.taxRate.toFixed(2),
      t.taxableAmount.toFixed(2),
      t.taxAmount.toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sst-transactions-${selectedReturnPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageContainer>
      <PageHeader
        title="SST Reports"
        description="Malaysian Sales and Service Tax summary and reporting"
        action={
          <Select value={summaryPeriod} onValueChange={(v) => setSummaryPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Output Tax"
          value={summary ? formatCurrency(summary.totalOutputTax, currency) : "-"}
          description={`${summary?.transactionCount || 0} transactions`}
          icon={<Receipt className="size-4" />}
          trend={
            summary
              ? {
                  value: Math.abs(summary.comparison.percentChange),
                  direction: summary.comparison.percentChange >= 0 ? "up" : "down",
                }
              : undefined
          }
          isLoading={summaryLoading}
        />
        <StatCard
          label="Sales Tax"
          value={summary ? formatCurrency(summary.totalSalesTax, currency) : "-"}
          description="Tax collected on goods"
          icon={<Building2 className="size-4" />}
          isLoading={summaryLoading}
        />
        <StatCard
          label="Service Tax"
          value={summary ? formatCurrency(summary.totalServiceTax, currency) : "-"}
          description="Tax collected on services"
          icon={<FileText className="size-4" />}
          isLoading={summaryLoading}
        />
        <StatCard
          label="Taxable Amount"
          value={summary ? formatCurrency(summary.totalTaxableAmount, currency) : "-"}
          description="Gross taxable value"
          icon={
            summary?.comparison.trend === "up" ? (
              <TrendingUp className="size-4" />
            ) : (
              <TrendingDown className="size-4" />
            )
          }
          isLoading={summaryLoading}
        />
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="sst02">SST-02 Return</TabsTrigger>
          <TabsTrigger value="compliance" className="gap-1.5">
            <ShieldCheck className="size-4" />
            Compliance
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
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
                        <TableCell className="text-muted-foreground">{s.referenceNumber || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-medium">SST Transactions</CardTitle>
                  <CardDescription>All SST transactions from invoices</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={taxTypeFilter} onValueChange={(v) => setTaxTypeFilter(v as TaxTypeFilter)}>
                    <SelectTrigger className="w-[140px]">
                      <Filter className="mr-2 size-4" />
                      <SelectValue placeholder="Tax Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="sales_tax">Sales Tax</SelectItem>
                      <SelectItem value="service_tax">Service Tax</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={documentTypeFilter} onValueChange={(v) => setDocumentTypeFilter(v as DocumentTypeFilter)}>
                    <SelectTrigger className="w-[140px]">
                      <FileText className="mr-2 size-4" />
                      <SelectValue placeholder="Document" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Documents</SelectItem>
                      <SelectItem value="invoice">Invoices</SelectItem>
                      <SelectItem value="credit_note">Credit Notes</SelectItem>
                      <SelectItem value="debit_note">Debit Notes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !transactions?.transactions.length ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No SST transactions found
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Tax Type</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead className="text-right">Taxable</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{new Date(t.documentDate).toLocaleDateString("en-MY")}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {t.documentType}
                              </Badge>
                              <span className="text-sm">{t.documentNumber}</span>
                            </div>
                          </TableCell>
                          <TableCell>{t.customerName || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={t.taxType === "sales_tax" ? "default" : "secondary"}>
                              {t.taxType === "sales_tax" ? "Sales" : "Service"}
                            </Badge>
                          </TableCell>
                          <TableCell>{t.taxRate}%</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.taxableAmount, currency)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(t.taxAmount, currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {transactions.pagination.totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Page {transactions.pagination.page} of {transactions.pagination.totalPages} (
                        {transactions.pagination.totalCount} total)
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={transactionPage === 1}
                          onClick={() => setTransactionPage((p) => p - 1)}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={transactionPage === transactions.pagination.totalPages}
                          onClick={() => setTransactionPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SST-02 Return Tab */}
        <TabsContent value="sst02" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-medium">SST-02 Return Helper</CardTitle>
                  <CardDescription>Generate data for your SST-02 return submission</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedReturnPeriod} onValueChange={setSelectedReturnPeriod}>
                    <SelectTrigger className="w-[180px]">
                      <Calendar className="mr-2 size-4" />
                      <SelectValue placeholder="Select Period" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePeriods?.map((p) => (
                        <SelectItem key={p} value={p}>
                          {formatPeriodLabel(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={exportToCSV} disabled={!sst02Return?.transactions.length}>
                    <Download className="mr-2 size-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {returnLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : !sst02Return ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  Select a tax period to generate return data
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Part A: Taxable Person Details */}
                  <div className="rounded-lg border p-4">
                    <h3 className="mb-3 font-semibold">Part A: Taxable Person Details</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">SST Registration No.</p>
                        <p className="font-medium">{sst02Return.partA.sstRegistrationNumber || "Not registered"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">TIN</p>
                        <p className="font-medium">{sst02Return.partA.tin || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">BRN</p>
                        <p className="font-medium">{sst02Return.partA.brn || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Tax Period</p>
                        <p className="font-medium">{formatPeriodLabel(sst02Return.partA.taxPeriod)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Part B: Sales Tax */}
                  <div className="rounded-lg border p-4">
                    <h3 className="mb-3 font-semibold">Part B: Sales Tax</h3>
                    {!sst02Return.partB.byRate.length ? (
                      <p className="text-muted-foreground">No sales tax transactions</p>
                    ) : (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Rate</TableHead>
                              <TableHead>Transactions</TableHead>
                              <TableHead className="text-right">Taxable Amount</TableHead>
                              <TableHead className="text-right">Tax Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sst02Return.partB.byRate.map((r) => (
                              <TableRow key={r.rate}>
                                <TableCell>{r.rate}%</TableCell>
                                <TableCell>{r.transactionCount}</TableCell>
                                <TableCell className="text-right">{formatCurrency(r.taxableAmount, currency)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(r.taxAmount, currency)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-medium">
                              <TableCell colSpan={2}>Total</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(sst02Return.partB.totalTaxableAmount, currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(sst02Return.partB.totalTaxAmount, currency)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </>
                    )}
                  </div>

                  {/* Part C: Service Tax */}
                  <div className="rounded-lg border p-4">
                    <h3 className="mb-3 font-semibold">Part C: Service Tax</h3>
                    {!sst02Return.partC.byRate.length ? (
                      <p className="text-muted-foreground">No service tax transactions</p>
                    ) : (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Rate</TableHead>
                              <TableHead>Transactions</TableHead>
                              <TableHead className="text-right">Taxable Amount</TableHead>
                              <TableHead className="text-right">Tax Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sst02Return.partC.byRate.map((r) => (
                              <TableRow key={r.rate}>
                                <TableCell>{r.rate}%</TableCell>
                                <TableCell>{r.transactionCount}</TableCell>
                                <TableCell className="text-right">{formatCurrency(r.taxableAmount, currency)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(r.taxAmount, currency)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-medium">
                              <TableCell colSpan={2}>Total</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(sst02Return.partC.totalTaxableAmount, currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(sst02Return.partC.totalTaxAmount, currency)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </>
                    )}
                  </div>

                  {/* Part D: Summary */}
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <h3 className="mb-3 font-semibold">Part D: Summary</h3>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Sales Tax</p>
                        <p className="text-xl font-semibold">{formatCurrency(sst02Return.partD.totalSalesTax, currency)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Service Tax</p>
                        <p className="text-xl font-semibold">{formatCurrency(sst02Return.partD.totalServiceTax, currency)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Tax Payable</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(sst02Return.partD.totalTaxPayable, currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          {complianceLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              {/* Registration Status Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-5 text-primary" />
                      <CardTitle className="text-lg">Registration Status</CardTitle>
                    </div>
                    {complianceStatus && (
                      <ComplianceStatusBadge status={complianceStatus.status as ComplianceStatus} />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {complianceStatus && (
                    <>
                      {/* Revenue Display */}
                      <div className="space-y-4">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Your Annual Revenue (12-month rolling)</p>
                            <p className="text-3xl font-bold tabular-nums">
                              {formatCurrency(complianceStatus.currentRevenue, currency)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Threshold</p>
                            <p className="text-xl font-semibold tabular-nums text-muted-foreground">
                              {formatCurrency(complianceStatus.threshold, currency)}
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <ComplianceProgress
                            percent={complianceStatus.progressPercent}
                            status={complianceStatus.status as ComplianceStatus}
                            size="lg"
                          />
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{complianceStatus.businessCategoryLabel}</span>
                            <span className="font-medium tabular-nums">{complianceStatus.progressPercent}% of threshold</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Message */}
                      <div
                        className={cn(
                          "rounded-lg p-4",
                          complianceStatus.status === "registered" && "bg-success/10",
                          complianceStatus.status === "exceeded" && "bg-destructive/10",
                          complianceStatus.status === "approaching" && "bg-warning/10",
                          complianceStatus.status === "voluntary" && "bg-info/10",
                          complianceStatus.status === "below" && "bg-muted/50"
                        )}
                      >
                        <p className="text-sm">
                          {getComplianceMessage(complianceStatus.status as ComplianceStatus, complianceStatus.progressPercent)}
                        </p>
                        {complianceStatus.isRegistered && complianceStatus.registrationNumber && (
                          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-success">
                            <CheckCircle2 className="size-4" />
                            Registration No: {complianceStatus.registrationNumber}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Business Settings Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Business Settings</CardTitle>
                  <CardDescription>Configure your business category and revenue calculation method</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Business Category */}
                  <div className="space-y-2">
                    <Label htmlFor="business-category">Business Category</Label>
                    <Select
                      value={complianceBusinessCategory}
                      onValueChange={(value) => {
                        setComplianceBusinessCategory(value);
                        setIsComplianceDirty(true);
                      }}
                    >
                      <SelectTrigger id="business-category" className="w-full sm:w-[300px]">
                        <SelectValue placeholder="Select your business category" />
                      </SelectTrigger>
                      <SelectContent>
                        {businessCategories?.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{cat.label}</span>
                              <span className="text-xs text-muted-foreground">
                                RM {cat.threshold.toLocaleString()}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Different business categories have different SST registration thresholds
                    </p>
                  </div>

                  {/* Revenue Calculation Method */}
                  <div className="space-y-3">
                    <Label>Revenue Calculation</Label>
                    <RadioGroup
                      value={complianceUseManualRevenue ? "manual" : "auto"}
                      onValueChange={(value: string) => {
                        setComplianceUseManualRevenue(value === "manual");
                        setIsComplianceDirty(true);
                      }}
                      className="space-y-3"
                    >
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="auto" id="auto" className="mt-1" />
                        <div className="space-y-1">
                          <Label htmlFor="auto" className="font-normal cursor-pointer">
                            Auto-calculate from invoices
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Calculated: {complianceStatus ? formatCurrency(complianceStatus.calculatedRevenue, currency) : "-"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value="manual" id="manual" className="mt-1" />
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="manual" className="font-normal cursor-pointer">
                            Enter manually
                          </Label>
                          <Input
                            type="number"
                            placeholder="Enter annual revenue"
                            value={complianceManualRevenue}
                            onChange={(e) => {
                              setComplianceManualRevenue(e.target.value);
                              setIsComplianceDirty(true);
                            }}
                            disabled={!complianceUseManualRevenue}
                            className="w-full sm:w-[200px]"
                          />
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* SST Registration Number */}
                  <div className="space-y-2">
                    <Label htmlFor="registration-number">SST Registration Number (if registered)</Label>
                    <Input
                      id="registration-number"
                      placeholder="e.g., W10-1234-56789012"
                      value={complianceRegistrationNumber}
                      onChange={(e) => {
                        setComplianceRegistrationNumber(e.target.value);
                        setIsComplianceDirty(true);
                      }}
                      className="w-full sm:w-[300px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter your SST registration number after registering with Customs
                    </p>
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={handleSaveCompliance}
                      disabled={!isComplianceDirty || updateComplianceMutation.isPending}
                    >
                      {updateComplianceMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 size-4" />
                          Save Settings
                        </>
                      )}
                    </Button>
                    {isComplianceDirty && (
                      <span className="text-sm text-muted-foreground">Unsaved changes</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Resources Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">Resources</CardTitle>
                  <CardDescription>Helpful links for SST registration and compliance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <a
                      href="https://mysst.customs.gov.my"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="rounded-lg bg-primary/10 p-2">
                        <ClipboardList className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">MySST Portal</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Register and manage your SST account</p>
                        <p className="mt-2 flex items-center gap-1 text-xs text-primary">
                          mysst.customs.gov.my
                          <ExternalLink className="size-3" />
                        </p>
                      </div>
                    </a>

                    <a
                      href="https://www.customs.gov.my/en/pg/pg_sst.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="rounded-lg bg-info/10 p-2">
                        <BookOpen className="size-5 text-info" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">Registration Guide</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Step-by-step guide to SST registration</p>
                        <p className="mt-2 flex items-center gap-1 text-xs text-primary">
                          customs.gov.my
                          <ExternalLink className="size-3" />
                        </p>
                      </div>
                    </a>

                    <div className="flex items-start gap-3 rounded-lg border p-4">
                      <div className="rounded-lg bg-success/10 p-2">
                        <Phone className="size-5 text-success" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">Customs Helpline</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Get help with SST questions</p>
                        <p className="mt-2 text-sm font-medium">1-300-888-500</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
