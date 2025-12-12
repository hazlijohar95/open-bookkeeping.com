import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  ShieldCheck,
  ExternalLink,
  CheckCircle2Icon,
  Phone,
  BookOpen,
  ClipboardList,
  SaveIcon,
  Loader2Icon,
} from "@/components/ui/icons";
import {
  ComplianceProgress,
  ComplianceStatusBadge,
  getComplianceMessage,
  type ComplianceStatus,
} from "@/components/sst/compliance-progress";

interface BusinessCategory {
  value: string;
  label: string;
  threshold: number;
}

interface ComplianceStatusData {
  status: string;
  currentRevenue: number;
  calculatedRevenue: number;
  threshold: number;
  progressPercent: number;
  businessCategory: string;
  businessCategoryLabel: string;
  manualRevenue?: number | null;
  useManualRevenue: boolean;
  registrationNumber?: string | null;
  isRegistered: boolean;
}

interface SSTComplianceTabProps {
  complianceStatus: ComplianceStatusData | undefined;
  complianceLoading: boolean;
  businessCategories: BusinessCategory[] | undefined;
  complianceBusinessCategory: string;
  setComplianceBusinessCategory: (value: string) => void;
  complianceManualRevenue: string;
  setComplianceManualRevenue: (value: string) => void;
  complianceUseManualRevenue: boolean;
  setComplianceUseManualRevenue: (value: boolean) => void;
  complianceRegistrationNumber: string;
  setComplianceRegistrationNumber: (value: string) => void;
  isComplianceDirty: boolean;
  setIsComplianceDirty: (value: boolean) => void;
  onSaveCompliance: () => void;
  isSaving: boolean;
  currency?: string;
}

export function SSTComplianceTab({
  complianceStatus,
  complianceLoading,
  businessCategories,
  complianceBusinessCategory,
  setComplianceBusinessCategory,
  complianceManualRevenue,
  setComplianceManualRevenue,
  complianceUseManualRevenue,
  setComplianceUseManualRevenue,
  complianceRegistrationNumber,
  setComplianceRegistrationNumber,
  isComplianceDirty,
  setIsComplianceDirty,
  onSaveCompliance,
  isSaving,
  currency = "MYR",
}: SSTComplianceTabProps) {
  if (complianceLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                    <CheckCircle2Icon className="size-4" />
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

          {/* SaveIcon Button */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={onSaveCompliance}
              disabled={!isComplianceDirty || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <SaveIcon className="mr-2 size-4" />
                  SaveIcon Settings
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
    </div>
  );
}
