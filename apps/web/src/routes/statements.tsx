import { useState, useCallback } from "react";
import { useStatementCustomers, useStatementVendors, useCustomerStatement, useVendorStatement, useAllCustomersSummary } from "@/api/statements";
import { useAuth } from "@/providers/auth-provider";
import { StatementTable, StatementSummary, CustomerSelector } from "@/components/statements";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ReceiptIcon, UsersIcon, TruckIcon } from "@/assets/icons";
import { Download, Loader2Icon } from "@/components/ui/icons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { downloadStatementPdf } from "@/lib/statement/create-statement-pdf-blob";
import type { StatementPDFData } from "@/components/pdf/statement/default";
import { toast } from "sonner";

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

export function Statements() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"customers" | "vendors">("customers");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [isExporting, setIsExporting] = useState(false);
  const queryEnabled = !!user && !isAuthLoading;

  // Fetch lists
  const { data: customers, isLoading: customersLoading } = useStatementCustomers({
    enabled: queryEnabled,
  });
  const { data: vendors, isLoading: vendorsLoading } = useStatementVendors({
    enabled: queryEnabled,
  });

  // Fetch statements
  const { data: customerStatement, isLoading: customerStatementLoading } = useCustomerStatement(
    selectedCustomerId!,
    dateRange.from,
    dateRange.to,
    { enabled: !!selectedCustomerId }
  );

  const { data: vendorStatement, isLoading: vendorStatementLoading } = useVendorStatement(
    selectedVendorId!,
    dateRange.from,
    dateRange.to,
    { enabled: !!selectedVendorId }
  );

  // Fetch summary
  const { data: customersSummary, isLoading: summaryLoading } = useAllCustomersSummary();

  const formatCurrency = (value: number, currency: string = "MYR") => {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Export customer statement to PDF
  const handleExportCustomerPdf = useCallback(async () => {
    if (!customerStatement) return;

    setIsExporting(true);
    try {
      const pdfData: StatementPDFData = {
        entityType: "customer",
        entity: {
          id: customerStatement.customer.id,
          name: customerStatement.customer.name,
          email: customerStatement.customer.email,
          address: customerStatement.customer.address,
        },
        period: {
          startDate: dateRange.from?.toISOString() ?? null,
          endDate: dateRange.to?.toISOString() ?? null,
        },
        entries: customerStatement.entries.map((e, i) => ({
          id: e.id || `entry-${i}`,
          date: e.date,
          type: e.type,
          reference: e.reference,
          description: e.description,
          debit: e.debit,
          credit: e.credit,
          balance: e.balance,
        })),
        summary: customerStatement.summary,
        currency: customerStatement.currency,
        generatedAt: new Date().toISOString(),
      };

      await downloadStatementPdf(pdfData);
      toast.success("Statement exported successfully");
    } catch (error) {
      console.error("Failed to export statement:", error);
      toast.error("Failed to export statement");
    } finally {
      setIsExporting(false);
    }
  }, [customerStatement, dateRange]);

  // Export vendor statement to PDF
  const handleExportVendorPdf = useCallback(async () => {
    if (!vendorStatement) return;

    setIsExporting(true);
    try {
      const pdfData: StatementPDFData = {
        entityType: "vendor",
        entity: {
          id: vendorStatement.vendor.id,
          name: vendorStatement.vendor.name,
          email: vendorStatement.vendor.email,
          address: vendorStatement.vendor.address,
        },
        period: {
          startDate: dateRange.from?.toISOString() ?? null,
          endDate: dateRange.to?.toISOString() ?? null,
        },
        entries: vendorStatement.entries.map((e, i) => ({
          id: e.id || `entry-${i}`,
          date: e.date,
          type: e.type,
          reference: e.reference,
          description: e.description,
          debit: e.debit,
          credit: e.credit,
          balance: e.balance,
        })),
        summary: vendorStatement.summary,
        currency: vendorStatement.currency,
        generatedAt: new Date().toISOString(),
      };

      await downloadStatementPdf(pdfData);
      toast.success("Statement exported successfully");
    } catch (error) {
      console.error("Failed to export statement:", error);
      toast.error("Failed to export statement");
    } finally {
      setIsExporting(false);
    }
  }, [vendorStatement, dateRange]);

  return (
    <PageContainer>
      <PageHeader
        icon={ReceiptIcon}
        title="Statement of Accounts"
        description="View transaction history and balances for customers and vendors"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="customers" className="gap-2">
            <UsersIcon className="size-4" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="vendors" className="gap-2">
            <TruckIcon className="size-4" />
            Vendors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          {/* Customer Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Customer</CardTitle>
              <CardDescription>
                Choose a customer to view their statement of account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <Label className="mb-2 block text-sm">Customer</Label>
                  <CustomerSelector
                    customers={customers?.items ?? []}
                    selectedId={selectedCustomerId}
                    onSelect={setSelectedCustomerId}
                    isLoading={customersLoading}
                    placeholder="Select a customer..."
                  />
                </div>
                <div>
                  <Label className="mb-2 block text-sm">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {dateRange.from ? format(dateRange.from, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="mb-2 block text-sm">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {dateRange.to ? format(dateRange.to, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Statement */}
          {selectedCustomerId && (
            <div className="space-y-4">
              {customerStatement && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{customerStatement.customer.name}</CardTitle>
                        <CardDescription>
                          {customerStatement.customer.email}
                          {customerStatement.customer.address && (
                            <span className="block mt-1">
                              {customerStatement.customer.address}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportCustomerPdf}
                          disabled={isExporting || !customerStatement}
                        >
                          {isExporting ? (
                            <Loader2Icon className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 size-4" />
                          )}
                          Export PDF
                        </Button>
                    </div>
                  </CardHeader>
                </Card>
              )}

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <StatementTable
                    entries={customerStatement?.entries ?? []}
                    currency={customerStatement?.currency ?? "MYR"}
                    isLoading={customerStatementLoading}
                  />
                </div>
                <div>
                  <StatementSummary
                    summary={
                      customerStatement?.summary ?? {
                        openingBalance: 0,
                        totalDebits: 0,
                        totalCredits: 0,
                        closingBalance: 0,
                      }
                    }
                    currency={customerStatement?.currency ?? "MYR"}
                    isLoading={customerStatementLoading}
                    variant="customer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* All Customers Summary */}
          {!selectedCustomerId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Customers Summary</CardTitle>
                <CardDescription>
                  Overview of outstanding balances for all customers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : customersSummary?.items && customersSummary.items.length > 0 ? (
                  <div className="space-y-2">
                    {customersSummary.items.map((customer) => (
                      <div
                        key={customer.customerId}
                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedCustomerId(customer.customerId)}
                      >
                        <div>
                          <p className="font-medium">{customer.customerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {customer.invoiceCount} invoices
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(customer.totalInvoiced)}
                          </p>
                          {customer.outstanding > 0 && (
                            <p className="text-sm text-warning-foreground dark:text-warning">
                              {formatCurrency(customer.outstanding)} outstanding
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={ReceiptIcon}
                    title="No customer data"
                    description="No customer data available yet."
                    className="py-8"
                  />
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4">
          {/* Vendor Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Vendor</CardTitle>
              <CardDescription>
                Choose a vendor to view their statement of account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <Label className="mb-2 block text-sm">Vendor</Label>
                  <CustomerSelector
                    customers={vendors?.items ?? []}
                    selectedId={selectedVendorId}
                    onSelect={setSelectedVendorId}
                    isLoading={vendorsLoading}
                    placeholder="Select a vendor..."
                  />
                </div>
                <div>
                  <Label className="mb-2 block text-sm">Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {dateRange.from ? format(dateRange.from, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="mb-2 block text-sm">End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 size-4" />
                        {dateRange.to ? format(dateRange.to, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vendor Statement */}
          {selectedVendorId && (
            <div className="space-y-4">
              {vendorStatement && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{vendorStatement.vendor.name}</CardTitle>
                        <CardDescription>
                          {vendorStatement.vendor.email}
                          {vendorStatement.vendor.address && (
                            <span className="block mt-1">
                              {vendorStatement.vendor.address}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportVendorPdf}
                          disabled={isExporting || !vendorStatement}
                        >
                          {isExporting ? (
                            <Loader2Icon className="mr-2 size-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 size-4" />
                          )}
                          Export PDF
                        </Button>
                    </div>
                  </CardHeader>
                </Card>
              )}

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <StatementTable
                    entries={vendorStatement?.entries ?? []}
                    currency={vendorStatement?.currency ?? "MYR"}
                    isLoading={vendorStatementLoading}
                  />
                </div>
                <div>
                  <StatementSummary
                    summary={
                      vendorStatement?.summary ?? {
                        openingBalance: 0,
                        totalDebits: 0,
                        totalCredits: 0,
                        closingBalance: 0,
                      }
                    }
                    currency={vendorStatement?.currency ?? "MYR"}
                    isLoading={vendorStatementLoading}
                    variant="vendor"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!selectedVendorId && (
            <Card>
              <CardContent className="py-8">
                <EmptyState
                  icon={TruckIcon}
                  title="No vendor selected"
                  description="Select a vendor to view their statement of account"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
