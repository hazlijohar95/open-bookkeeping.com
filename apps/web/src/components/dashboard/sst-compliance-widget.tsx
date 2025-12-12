import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useComplianceStatus } from "@/api/sst";
import { useAuth } from "@/providers/auth-provider";
import { formatCurrency } from "@/lib/utils";
import {
  ComplianceProgress,
  ComplianceStatusBadge,
  getComplianceMessage,
  type ComplianceStatus,
} from "@/components/sst/compliance-progress";
import {
  Settings,
  ExternalLink,
  CheckCircle2Icon,
  AlertTriangleIcon,
  TrendingUp,
  ShieldCheck,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface SstComplianceWidgetProps {
  className?: string;
}

export const SstComplianceWidget = memo(function SstComplianceWidget({
  className,
}: SstComplianceWidgetProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const queryEnabled = !!user && !isAuthLoading;

  const { data, isLoading } = useComplianceStatus({
    enabled: queryEnabled,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="size-5" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const status = data.status as ComplianceStatus;
  const message = getComplianceMessage(status, data.progressPercent);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          <CardTitle className="text-base font-medium">SST Compliance</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <Link to="/sst?tab=compliance">
            <Settings className="size-4" />
            <span className="sr-only">SST Settings</span>
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <ComplianceStatusBadge status={status} />
          {data.isRegistered && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2Icon className="size-3" />
              {data.registrationNumber}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <ComplianceProgress
            percent={data.progressPercent}
            status={status}
            size="md"
          />
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold tabular-nums">
              {formatCurrency(data.currentRevenue, "MYR")}
            </span>
            <span className="text-muted-foreground">
              / {formatCurrency(data.threshold, "MYR")}
            </span>
          </div>
        </div>

        {/* Category & Percentage */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{data.businessCategoryLabel}</span>
          <span className="font-medium tabular-nums">{data.progressPercent}%</span>
        </div>

        {/* Status Message Card */}
        <div
          className={cn(
            "rounded-lg p-3",
            status === "registered" && "bg-success/10",
            status === "exceeded" && "bg-destructive/10",
            status === "approaching" && "bg-warning/10",
            status === "voluntary" && "bg-info/10",
            status === "below" && "bg-muted/50"
          )}
        >
          <div className="flex items-start gap-2">
            {status === "registered" ? (
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" />
            ) : status === "exceeded" || status === "approaching" ? (
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
            ) : (
              <TrendingUp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{message}</p>
              {status !== "registered" && (
                <a
                  href="https://mysst.customs.gov.my"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Register at MySST
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
