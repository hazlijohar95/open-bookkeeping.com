import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/providers/auth-provider";
import { formatCurrency } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Receipt,
  TrendingUp,
  TrendingDown,
  FileText,
  Building2,
  ShieldCheck,
} from "@/components/ui/icons";

// Import extracted tab components
import {
  SSTOverviewTab,
  SSTTransactionsTab,
  SSTReturnTab,
  SSTComplianceTab,
  type PeriodType,
  type ChartPeriod,
  type TaxTypeFilter,
  type DocumentTypeFilter,
  type TabValue,
} from "@/components/sst/tabs";

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

        <TabsContent value="overview">
          <SSTOverviewTab
            chartData={chartData}
            chartLoading={chartLoading}
            chartPeriod={chartPeriod}
            setChartPeriod={setChartPeriod}
            submissions={submissions}
            currency={currency}
          />
        </TabsContent>

        <TabsContent value="transactions">
          <SSTTransactionsTab
            transactions={transactions}
            transactionsLoading={transactionsLoading}
            taxTypeFilter={taxTypeFilter}
            setTaxTypeFilter={setTaxTypeFilter}
            documentTypeFilter={documentTypeFilter}
            setDocumentTypeFilter={setDocumentTypeFilter}
            transactionPage={transactionPage}
            setTransactionPage={setTransactionPage}
            currency={currency}
          />
        </TabsContent>

        <TabsContent value="sst02">
          <SSTReturnTab
            sst02Return={sst02Return}
            returnLoading={returnLoading}
            availablePeriods={availablePeriods}
            selectedReturnPeriod={selectedReturnPeriod}
            setSelectedReturnPeriod={setSelectedReturnPeriod}
            currency={currency}
          />
        </TabsContent>

        <TabsContent value="compliance">
          <SSTComplianceTab
            complianceStatus={complianceStatus}
            complianceLoading={complianceLoading}
            businessCategories={businessCategories}
            complianceBusinessCategory={complianceBusinessCategory}
            setComplianceBusinessCategory={setComplianceBusinessCategory}
            complianceManualRevenue={complianceManualRevenue}
            setComplianceManualRevenue={setComplianceManualRevenue}
            complianceUseManualRevenue={complianceUseManualRevenue}
            setComplianceUseManualRevenue={setComplianceUseManualRevenue}
            complianceRegistrationNumber={complianceRegistrationNumber}
            setComplianceRegistrationNumber={setComplianceRegistrationNumber}
            isComplianceDirty={isComplianceDirty}
            setIsComplianceDirty={setIsComplianceDirty}
            onSaveCompliance={handleSaveCompliance}
            isSaving={updateComplianceMutation.isPending}
            currency={currency}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
