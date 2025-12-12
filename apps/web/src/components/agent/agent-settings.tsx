import { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  useApprovalSettings,
  useUpdateApprovalSettings,
  useAgentQuotas,
  useUpdateQuotas,
  useUsageSummary,
  useEnableEmergencyStop,
  useDisableEmergencyStop,
} from "@/api/agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2Icon,
  SaveIcon,
  StopCircleIcon,
  PlayIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Extracted and memoized UsageCard component
interface UsageCardProps {
  label: string;
  used: number;
  limit: number;
  format?: "number" | "compact";
}

const UsageCard = memo(function UsageCard({
  label,
  used,
  limit,
  format = "number",
}: UsageCardProps) {
  const percentage = useMemo(() => Math.min((used / limit) * 100, 100), [used, limit]);
  const isWarning = useMemo(() => percentage >= 80, [percentage]);
  const isCritical = useMemo(() => percentage >= 95, [percentage]);

  const formatValue = useCallback((value: number) => {
    if (format === "compact") {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  }, [format]);

  const formattedUsed = useMemo(() => formatValue(used), [formatValue, used]);
  const formattedLimit = useMemo(() => formatValue(limit), [formatValue, limit]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          "font-medium jetbrains-mono",
          isCritical && "text-destructive",
          isWarning && !isCritical && "text-amber-500"
        )}>
          {formattedUsed}/{formattedLimit}
        </span>
      </div>
      <Progress
        value={percentage}
        className={cn(
          "h-1.5 rounded-none",
          isCritical && "[&>div]:bg-destructive",
          isWarning && !isCritical && "[&>div]:bg-amber-500"
        )}
      />
    </div>
  );
});

export function AgentSettings() {
  const { data: approvalSettings, isLoading: loadingApproval } = useApprovalSettings();
  const { data: quotas, isLoading: loadingQuotas } = useAgentQuotas();
  const { data: usage, isLoading: loadingUsage } = useUsageSummary();

  const updateApprovalSettings = useUpdateApprovalSettings();
  const updateQuotas = useUpdateQuotas();
  const enableEmergencyStop = useEnableEmergencyStop();
  const disableEmergencyStop = useDisableEmergencyStop();

  const [approvalForm, setApprovalForm] = useState({
    requireApproval: false,
    invoiceThreshold: "",
    billThreshold: "",
    journalEntryThreshold: "",
    autoApproveReadOnly: true,
    autoApproveRecurring: false,
    approvalTimeoutHours: "24",
    notifyOnApprovalRequired: true,
    notifyOnAutoApproved: false,
  });

  const [quotaForm, setQuotaForm] = useState({
    dailyInvoiceLimit: 100,
    dailyBillLimit: 100,
    dailyJournalEntryLimit: 200,
    dailyQuotationLimit: 100,
    dailyTokenLimit: 1000000,
    maxSingleInvoiceAmount: "",
    maxSingleBillAmount: "",
    maxDailyTotalAmount: "",
    maxActionsPerMinute: 30,
    maxConcurrentWorkflows: 5,
  });

  const [expandedSection, setExpandedSection] = useState<string | null>("approvals");

  useEffect(() => {
    if (approvalSettings) {
      setApprovalForm({
        requireApproval: approvalSettings.requireApproval,
        invoiceThreshold: approvalSettings.invoiceThreshold ?? "",
        billThreshold: approvalSettings.billThreshold ?? "",
        journalEntryThreshold: approvalSettings.journalEntryThreshold ?? "",
        autoApproveReadOnly: approvalSettings.autoApproveReadOnly,
        autoApproveRecurring: approvalSettings.autoApproveRecurring,
        approvalTimeoutHours: approvalSettings.approvalTimeoutHours ?? "24",
        notifyOnApprovalRequired: approvalSettings.notifyOnApprovalRequired,
        notifyOnAutoApproved: approvalSettings.notifyOnAutoApproved,
      });
    }
  }, [approvalSettings]);

  useEffect(() => {
    if (quotas) {
      setQuotaForm({
        dailyInvoiceLimit: quotas.dailyInvoiceLimit,
        dailyBillLimit: quotas.dailyBillLimit,
        dailyJournalEntryLimit: quotas.dailyJournalEntryLimit,
        dailyQuotationLimit: quotas.dailyQuotationLimit,
        dailyTokenLimit: quotas.dailyTokenLimit,
        maxSingleInvoiceAmount: quotas.maxSingleInvoiceAmount ?? "",
        maxSingleBillAmount: quotas.maxSingleBillAmount ?? "",
        maxDailyTotalAmount: quotas.maxDailyTotalAmount ?? "",
        maxActionsPerMinute: quotas.maxActionsPerMinute,
        maxConcurrentWorkflows: quotas.maxConcurrentWorkflows,
      });
    }
  }, [quotas]);

  const handleSaveApprovalSettings = useCallback(async () => {
    try {
      await updateApprovalSettings.mutateAsync({
        requireApproval: approvalForm.requireApproval,
        invoiceThreshold: approvalForm.invoiceThreshold ?? null,
        billThreshold: approvalForm.billThreshold ?? null,
        journalEntryThreshold: approvalForm.journalEntryThreshold ?? null,
        autoApproveReadOnly: approvalForm.autoApproveReadOnly,
        autoApproveRecurring: approvalForm.autoApproveRecurring,
        approvalTimeoutHours: approvalForm.approvalTimeoutHours,
        notifyOnApprovalRequired: approvalForm.notifyOnApprovalRequired,
        notifyOnAutoApproved: approvalForm.notifyOnAutoApproved,
      });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save");
    }
  }, [approvalForm, updateApprovalSettings]);

  const handleSaveQuotas = useCallback(async () => {
    try {
      await updateQuotas.mutateAsync({
        dailyInvoiceLimit: quotaForm.dailyInvoiceLimit,
        dailyBillLimit: quotaForm.dailyBillLimit,
        dailyJournalEntryLimit: quotaForm.dailyJournalEntryLimit,
        dailyQuotationLimit: quotaForm.dailyQuotationLimit,
        dailyTokenLimit: quotaForm.dailyTokenLimit,
        maxSingleInvoiceAmount: quotaForm.maxSingleInvoiceAmount ?? null,
        maxSingleBillAmount: quotaForm.maxSingleBillAmount ?? null,
        maxDailyTotalAmount: quotaForm.maxDailyTotalAmount ?? null,
        maxActionsPerMinute: quotaForm.maxActionsPerMinute,
        maxConcurrentWorkflows: quotaForm.maxConcurrentWorkflows,
      });
      toast.success("Quotas saved");
    } catch {
      toast.error("Failed to save");
    }
  }, [quotaForm, updateQuotas]);

  const handleEmergencyStop = useCallback(async () => {
    try {
      await enableEmergencyStop.mutateAsync("Manual stop");
      toast.success("AI agent stopped");
    } catch {
      toast.error("Failed to stop");
    }
  }, [enableEmergencyStop]);

  const handleDisableEmergencyStop = useCallback(async () => {
    try {
      await disableEmergencyStop.mutateAsync();
      toast.success("AI agent resumed");
    } catch {
      toast.error("Failed to resume");
    }
  }, [disableEmergencyStop]);

  const isLoading = loadingApproval || loadingQuotas || loadingUsage;

  const toggleSection = useCallback((section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  }, [expandedSection]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Emergency Stop Banner */}
      {usage?.emergencyStopEnabled && (
        <Card className="rounded-none border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StopCircleIcon className="h-5 w-5 text-destructive" />
                <div>
                  <h3 className="text-sm font-medium text-destructive">Emergency Stop Active</h3>
                  <p className="text-xs text-muted-foreground">All AI actions blocked</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisableEmergencyStop}
                className="rounded-none h-8 text-xs"
              >
                <PlayIcon className="h-3 w-3 mr-1.5" />
                Resume
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Overview */}
      {usage?.today && usage.limits && usage.remaining && (
        <Card className="rounded-none border">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-medium jetbrains-mono">Today's Usage</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <UsageCard
                label="Invoices"
                used={usage.today.invoicesCreated}
                limit={usage.limits.dailyInvoiceLimit}
              />
              <UsageCard
                label="Bills"
                used={usage.today.billsCreated}
                limit={usage.limits.dailyBillLimit}
              />
              <UsageCard
                label="Journals"
                used={usage.today.journalEntriesCreated}
                limit={usage.limits.dailyJournalEntryLimit}
              />
              <UsageCard
                label="Tokens"
                used={usage.today.tokensUsed}
                limit={usage.limits.dailyTokenLimit}
                format="compact"
              />
            </div>
            <div className="mt-4 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
              <span>Actions: <span className="font-medium text-foreground jetbrains-mono">{usage.today.totalActions}</span></span>
              <span>Mutations: <span className="font-medium text-foreground jetbrains-mono">{usage.today.totalMutations}</span></span>
              <span>Reads: <span className="font-medium text-foreground jetbrains-mono">{usage.today.totalReads}</span></span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collapsible Settings Sections */}
      <div className="space-y-2">
        {/* Approval Settings */}
        <Card className="rounded-none border">
          <button
            onClick={() => toggleSection("approvals")}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-medium">Approval Settings</span>
            <ChevronRightIcon className={cn("h-4 w-4 transition-transform", expandedSection === "approvals" && "rotate-90")} />
          </button>
          {expandedSection === "approvals" && (
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="text-sm">Require Approval for All</Label>
                  <p className="text-xs text-muted-foreground">All mutations need approval</p>
                </div>
                <Switch
                  checked={approvalForm.requireApproval}
                  onCheckedChange={(checked) =>
                    setApprovalForm((prev) => ({ ...prev, requireApproval: checked }))
                  }
                />
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Thresholds (MYR)</Label>
                <div className="grid gap-3 grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Invoice</Label>
                    <Input
                      type="number"
                      placeholder="10000"
                      value={approvalForm.invoiceThreshold}
                      onChange={(e) =>
                        setApprovalForm((prev) => ({ ...prev, invoiceThreshold: e.target.value }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bill</Label>
                    <Input
                      type="number"
                      placeholder="10000"
                      value={approvalForm.billThreshold}
                      onChange={(e) =>
                        setApprovalForm((prev) => ({ ...prev, billThreshold: e.target.value }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Journal</Label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={approvalForm.journalEntryThreshold}
                      onChange={(e) =>
                        setApprovalForm((prev) => ({ ...prev, journalEntryThreshold: e.target.value }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Auto-Approve</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Read-only actions</Label>
                    <Switch
                      checked={approvalForm.autoApproveReadOnly}
                      onCheckedChange={(checked) =>
                        setApprovalForm((prev) => ({ ...prev, autoApproveReadOnly: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Recurring workflows</Label>
                    <Switch
                      checked={approvalForm.autoApproveRecurring}
                      onCheckedChange={(checked) =>
                        setApprovalForm((prev) => ({ ...prev, autoApproveRecurring: checked }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Notifications</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Notify on approval required</Label>
                    <Switch
                      checked={approvalForm.notifyOnApprovalRequired}
                      onCheckedChange={(checked) =>
                        setApprovalForm((prev) => ({ ...prev, notifyOnApprovalRequired: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Notify on auto-approved</Label>
                    <Switch
                      checked={approvalForm.notifyOnAutoApproved}
                      onCheckedChange={(checked) =>
                        setApprovalForm((prev) => ({ ...prev, notifyOnAutoApproved: checked }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Timeout (hours)</Label>
                  <Input
                    type="number"
                    value={approvalForm.approvalTimeoutHours}
                    onChange={(e) =>
                      setApprovalForm((prev) => ({ ...prev, approvalTimeoutHours: e.target.value }))
                    }
                    className="h-8 text-sm rounded-none w-24"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveApprovalSettings}
                  disabled={updateApprovalSettings.isPending}
                  size="sm"
                  className="rounded-none h-8 text-xs"
                >
                  {updateApprovalSettings.isPending && <Loader2Icon className="h-3 w-3 mr-1.5 animate-spin" />}
                  <SaveIcon className="h-3 w-3 mr-1.5" />
                  SaveIcon
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Quotas & Limits */}
        <Card className="rounded-none border">
          <button
            onClick={() => toggleSection("quotas")}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-medium">Quotas & Limits</span>
            <ChevronRightIcon className={cn("h-4 w-4 transition-transform", expandedSection === "quotas" && "rotate-90")} />
          </button>
          {expandedSection === "quotas" && (
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Daily Limits</Label>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Invoices</Label>
                    <Input
                      type="number"
                      value={quotaForm.dailyInvoiceLimit}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, dailyInvoiceLimit: parseInt(e.target.value) ?? 0 }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bills</Label>
                    <Input
                      type="number"
                      value={quotaForm.dailyBillLimit}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, dailyBillLimit: parseInt(e.target.value) ?? 0 }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Journals</Label>
                    <Input
                      type="number"
                      value={quotaForm.dailyJournalEntryLimit}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, dailyJournalEntryLimit: parseInt(e.target.value) ?? 0 }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Quotations</Label>
                    <Input
                      type="number"
                      value={quotaForm.dailyQuotationLimit}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, dailyQuotationLimit: parseInt(e.target.value) ?? 0 }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Amount Limits (MYR)</Label>
                <div className="grid gap-3 grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Invoice</Label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={quotaForm.maxSingleInvoiceAmount}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, maxSingleInvoiceAmount: e.target.value }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Bill</Label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={quotaForm.maxSingleBillAmount}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, maxSingleBillAmount: e.target.value }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Daily Total</Label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={quotaForm.maxDailyTotalAmount}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, maxDailyTotalAmount: e.target.value }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Rate Limits</Label>
                <div className="grid gap-3 grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Actions/min</Label>
                    <Input
                      type="number"
                      value={quotaForm.maxActionsPerMinute}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, maxActionsPerMinute: parseInt(e.target.value) ?? 1 }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Concurrent</Label>
                    <Input
                      type="number"
                      value={quotaForm.maxConcurrentWorkflows}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, maxConcurrentWorkflows: parseInt(e.target.value) ?? 1 }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tokens/day</Label>
                    <Input
                      type="number"
                      value={quotaForm.dailyTokenLimit}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, dailyTokenLimit: parseInt(e.target.value) ?? 0 }))
                      }
                      className="h-8 text-sm rounded-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveQuotas}
                  disabled={updateQuotas.isPending}
                  size="sm"
                  className="rounded-none h-8 text-xs"
                >
                  {updateQuotas.isPending && <Loader2Icon className="h-3 w-3 mr-1.5 animate-spin" />}
                  <SaveIcon className="h-3 w-3 mr-1.5" />
                  SaveIcon
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Safety Controls */}
        <Card className="rounded-none border">
          <button
            onClick={() => toggleSection("safety")}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-medium">Safety Controls</span>
            <ChevronRightIcon className={cn("h-4 w-4 transition-transform", expandedSection === "safety" && "rotate-90")} />
          </button>
          {expandedSection === "safety" && (
            <CardContent className="p-4 pt-0">
              <div className="rounded-none border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium flex items-center gap-2 text-destructive">
                      <StopCircleIcon className="h-4 w-4" />
                      Emergency Stop
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Immediately block all AI agent actions
                    </p>
                    {usage?.emergencyStopEnabled && (
                      <Badge variant="destructive" className="rounded-none mt-2 text-[10px]">
                        Active
                      </Badge>
                    )}
                  </div>

                  {usage?.emergencyStopEnabled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisableEmergencyStop}
                      disabled={disableEmergencyStop.isPending}
                      className="rounded-none h-8 text-xs shrink-0"
                    >
                      {disableEmergencyStop.isPending && <Loader2Icon className="h-3 w-3 mr-1.5 animate-spin" />}
                      <PlayIcon className="h-3 w-3 mr-1.5" />
                      Resume
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="rounded-none h-8 text-xs shrink-0">
                          <StopCircleIcon className="h-3 w-3 mr-1.5" />
                          Stop
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-none max-w-sm">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-base">Activate Emergency Stop?</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs">
                            This will block all AI agent actions immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel className="rounded-none h-8 text-xs">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleEmergencyStop}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-none h-8 text-xs"
                          >
                            Activate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
