/**
 * Cost Monitoring Dashboard
 *
 * Displays AI agent usage metrics, costs, and quota status.
 * Helps users understand their AI usage and manage costs.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/trpc/provider";
import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  MessageSquare,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
} from "@/components/ui/icons";

// ============================================
// TYPES
// ============================================

interface UsageMetrics {
  tokensUsed: number;
  dailyTokenLimit: number;
  invoicesCreated: number;
  dailyInvoiceLimit: number;
  billsCreated: number;
  dailyBillLimit: number;
  journalEntriesCreated: number;
  dailyJournalEntryLimit: number;
  totalAmountCreated: number;
  maxDailyTotalAmount: number;
  actionsToday: number;
  errorsToday: number;
}

interface CostBreakdown {
  llmCost: number;
  embeddingCost: number;
  storageCost: number;
  totalCost: number;
  currency: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function getUsagePercentage(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min((used / limit) * 100, 100);
}

function getUsageStatus(percentage: number): "healthy" | "warning" | "critical" {
  if (percentage >= 90) return "critical";
  if (percentage >= 70) return "warning";
  return "healthy";
}

// ============================================
// COMPONENTS
// ============================================

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  showPercentage?: boolean;
}

function UsageBar({ label, used, limit, unit = "", showPercentage = true }: UsageBarProps) {
  const percentage = getUsagePercentage(used, limit);
  const status = getUsageStatus(percentage);

  const statusColors = {
    healthy: "bg-emerald-500",
    warning: "bg-amber-500",
    critical: "bg-red-500",
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {formatNumber(used)}{unit} / {formatNumber(limit)}{unit}
          {showPercentage && (
            <span className="text-muted-foreground ml-2">({percentage.toFixed(0)}%)</span>
          )}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${statusColors[status]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  status?: "healthy" | "warning" | "critical";
}

function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  trendValue,
  status = "healthy",
}: MetricCardProps) {
  const statusColors = {
    healthy: "text-emerald-600",
    warning: "text-amber-600",
    critical: "text-red-600",
  };

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/30">
      <div className={`p-2 rounded-lg bg-background ${statusColors[status]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-semibold mt-1">{value}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && trendValue && (
          <div className="flex items-center gap-1 mt-2 text-xs">
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : trend === "down" ? (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ) : null}
            <span className={trend === "up" ? "text-emerald-500" : "text-red-500"}>
              {trendValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CostMonitoringDashboard() {
  // Fetch usage data
  const { data: quotaData } = trpc.agent.getQuotas.useQuery();
  const { data: usageData } = trpc.agent.getTodayUsage.useQuery();
  const { data: auditStats } = trpc.agent.getAuditStats.useQuery({
    startDate: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
    endDate: new Date().toISOString(),
  });

  // Calculate metrics
  const metrics: UsageMetrics = useMemo(() => {
    return {
      tokensUsed: usageData?.tokensUsed ?? 0,
      dailyTokenLimit: quotaData?.dailyTokenLimit ?? 100000,
      invoicesCreated: usageData?.invoicesCreated ?? 0,
      dailyInvoiceLimit: quotaData?.dailyInvoiceLimit ?? 50,
      billsCreated: usageData?.billsCreated ?? 0,
      dailyBillLimit: quotaData?.dailyBillLimit ?? 50,
      journalEntriesCreated: usageData?.journalEntriesCreated ?? 0,
      dailyJournalEntryLimit: quotaData?.dailyJournalEntryLimit ?? 100,
      totalAmountCreated: parseFloat(usageData?.totalAmountProcessed ?? "0"),
      maxDailyTotalAmount: parseFloat(quotaData?.maxDailyTotalAmount ?? "100000"),
      actionsToday: auditStats?.totalActions ?? 0,
      errorsToday: auditStats?.failedActions ?? 0,
    };
  }, [quotaData, usageData, auditStats]);

  // Estimate costs (rough calculation)
  const costs: CostBreakdown = useMemo(() => {
    // Using GPT-4o-mini pricing as baseline
    const inputCostPer1M = 0.15;
    const outputCostPer1M = 0.6;

    // Assume 60% input, 40% output
    const inputTokens = metrics.tokensUsed * 0.6;
    const outputTokens = metrics.tokensUsed * 0.4;

    const llmCost =
      (inputTokens / 1_000_000) * inputCostPer1M +
      (outputTokens / 1_000_000) * outputCostPer1M;

    // Embedding cost (text-embedding-3-small: $0.02 per 1M tokens)
    const embeddingCost = (metrics.tokensUsed * 0.1) / 1_000_000 * 0.02;

    return {
      llmCost,
      embeddingCost,
      storageCost: 0, // Database storage is typically fixed cost
      totalCost: llmCost + embeddingCost,
      currency: "USD",
    };
  }, [metrics]);

  const tokenStatus = getUsageStatus(getUsagePercentage(metrics.tokensUsed, metrics.dailyTokenLimit));
  const successRate = metrics.actionsToday > 0
    ? ((metrics.actionsToday - metrics.errorsToday) / metrics.actionsToday * 100).toFixed(1)
    : "100";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">AI Co-Worker Usage</h2>
          <p className="text-sm text-muted-foreground">
            Monitor your AI assistant's usage and costs
          </p>
        </div>
        <Badge
          variant={tokenStatus === "healthy" ? "default" : tokenStatus === "warning" ? "secondary" : "destructive"}
        >
          {tokenStatus === "healthy" ? (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          ) : (
            <AlertCircle className="h-3 w-3 mr-1" />
          )}
          {tokenStatus === "healthy" ? "Healthy" : tokenStatus === "warning" ? "Nearing Limit" : "Critical"}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Tokens Used Today"
          value={formatNumber(metrics.tokensUsed)}
          description={`of ${formatNumber(metrics.dailyTokenLimit)} limit`}
          icon={<Zap className="h-4 w-4" />}
          status={tokenStatus}
        />
        <MetricCard
          title="Estimated Cost"
          value={formatCurrency(costs.totalCost)}
          description="Today's usage"
          icon={<DollarSign className="h-4 w-4" />}
          status="healthy"
        />
        <MetricCard
          title="Actions Today"
          value={metrics.actionsToday}
          description={`${successRate}% success rate`}
          icon={<Wrench className="h-4 w-4" />}
          status={parseFloat(successRate) < 80 ? "warning" : "healthy"}
        />
        <MetricCard
          title="Conversations"
          value={Math.ceil(metrics.tokensUsed / 2000)}
          description="Estimated turns"
          icon={<MessageSquare className="h-4 w-4" />}
          status="healthy"
        />
      </div>

      {/* Usage Details */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Token & Cost Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Token Usage</CardTitle>
            <CardDescription>Daily token consumption breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <UsageBar
              label="Tokens"
              used={metrics.tokensUsed}
              limit={metrics.dailyTokenLimit}
            />

            <div className="pt-4 border-t space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">LLM Cost</span>
                <span>{formatCurrency(costs.llmCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Embedding Cost</span>
                <span>{formatCurrency(costs.embeddingCost)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium pt-2 border-t">
                <span>Total Estimated Cost</span>
                <span>{formatCurrency(costs.totalCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Quotas Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Action Quotas</CardTitle>
            <CardDescription>Daily limits for AI-initiated actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar
              label="Invoices Created"
              used={metrics.invoicesCreated}
              limit={metrics.dailyInvoiceLimit}
            />
            <UsageBar
              label="Bills Created"
              used={metrics.billsCreated}
              limit={metrics.dailyBillLimit}
            />
            <UsageBar
              label="Journal Entries"
              used={metrics.journalEntriesCreated}
              limit={metrics.dailyJournalEntryLimit}
            />
            <UsageBar
              label="Total Amount"
              used={metrics.totalAmountCreated}
              limit={metrics.maxDailyTotalAmount}
              unit=" MYR"
            />
          </CardContent>
        </Card>
      </div>

      {/* Reset Timer */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Quotas reset at midnight UTC</span>
            </div>
            <span className="text-sm font-medium">
              Next reset in {getTimeUntilMidnight()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper to calculate time until midnight UTC
function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);

  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

export default CostMonitoringDashboard;
