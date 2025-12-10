import { useState, useEffect } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Shield,
  Loader2,
  AlertTriangle,
  Settings,
  Zap,
  Save,
  StopCircle,
  Play,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AgentSettings() {
  const { data: approvalSettings, isLoading: loadingApproval } = useApprovalSettings();
  const { data: quotas, isLoading: loadingQuotas } = useAgentQuotas();
  const { data: usage, isLoading: loadingUsage } = useUsageSummary();

  const updateApprovalSettings = useUpdateApprovalSettings();
  const updateQuotas = useUpdateQuotas();
  const enableEmergencyStop = useEnableEmergencyStop();
  const disableEmergencyStop = useDisableEmergencyStop();

  // Local state for form
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

  // Update form when data loads
  useEffect(() => {
    if (approvalSettings) {
      setApprovalForm({
        requireApproval: approvalSettings.requireApproval,
        invoiceThreshold: approvalSettings.invoiceThreshold || "",
        billThreshold: approvalSettings.billThreshold || "",
        journalEntryThreshold: approvalSettings.journalEntryThreshold || "",
        autoApproveReadOnly: approvalSettings.autoApproveReadOnly,
        autoApproveRecurring: approvalSettings.autoApproveRecurring,
        approvalTimeoutHours: approvalSettings.approvalTimeoutHours || "24",
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
        maxSingleInvoiceAmount: quotas.maxSingleInvoiceAmount || "",
        maxSingleBillAmount: quotas.maxSingleBillAmount || "",
        maxDailyTotalAmount: quotas.maxDailyTotalAmount || "",
        maxActionsPerMinute: quotas.maxActionsPerMinute,
        maxConcurrentWorkflows: quotas.maxConcurrentWorkflows,
      });
    }
  }, [quotas]);

  const handleSaveApprovalSettings = async () => {
    try {
      await updateApprovalSettings.mutateAsync({
        requireApproval: approvalForm.requireApproval,
        invoiceThreshold: approvalForm.invoiceThreshold || null,
        billThreshold: approvalForm.billThreshold || null,
        journalEntryThreshold: approvalForm.journalEntryThreshold || null,
        autoApproveReadOnly: approvalForm.autoApproveReadOnly,
        autoApproveRecurring: approvalForm.autoApproveRecurring,
        approvalTimeoutHours: approvalForm.approvalTimeoutHours,
        notifyOnApprovalRequired: approvalForm.notifyOnApprovalRequired,
        notifyOnAutoApproved: approvalForm.notifyOnAutoApproved,
      });
      toast.success("Approval settings saved");
    } catch {
      toast.error("Failed to save approval settings");
    }
  };

  const handleSaveQuotas = async () => {
    try {
      await updateQuotas.mutateAsync({
        dailyInvoiceLimit: quotaForm.dailyInvoiceLimit,
        dailyBillLimit: quotaForm.dailyBillLimit,
        dailyJournalEntryLimit: quotaForm.dailyJournalEntryLimit,
        dailyQuotationLimit: quotaForm.dailyQuotationLimit,
        dailyTokenLimit: quotaForm.dailyTokenLimit,
        maxSingleInvoiceAmount: quotaForm.maxSingleInvoiceAmount || null,
        maxSingleBillAmount: quotaForm.maxSingleBillAmount || null,
        maxDailyTotalAmount: quotaForm.maxDailyTotalAmount || null,
        maxActionsPerMinute: quotaForm.maxActionsPerMinute,
        maxConcurrentWorkflows: quotaForm.maxConcurrentWorkflows,
      });
      toast.success("Quota settings saved");
    } catch {
      toast.error("Failed to save quota settings");
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await enableEmergencyStop.mutateAsync("Manual emergency stop activated");
      toast.success("Emergency stop activated - all AI actions are blocked");
    } catch {
      toast.error("Failed to activate emergency stop");
    }
  };

  const handleDisableEmergencyStop = async () => {
    try {
      await disableEmergencyStop.mutateAsync();
      toast.success("Emergency stop disabled - AI actions resumed");
    } catch {
      toast.error("Failed to disable emergency stop");
    }
  };

  const isLoading = loadingApproval || loadingQuotas || loadingUsage;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Emergency Stop Banner */}
      {usage?.emergencyStopEnabled && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StopCircle className="h-6 w-6 text-destructive" />
                <div>
                  <h3 className="font-semibold text-destructive">Emergency Stop Active</h3>
                  <p className="text-sm text-muted-foreground">
                    All AI agent actions are currently blocked
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleDisableEmergencyStop}>
                <Play className="h-4 w-4 mr-2" />
                Resume AI Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Overview */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Today's Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <UsageCard
                label="Invoices"
                used={usage.today.invoicesCreated}
                limit={usage.limits.dailyInvoiceLimit}
                remaining={usage.remaining.invoices}
              />
              <UsageCard
                label="Bills"
                used={usage.today.billsCreated}
                limit={usage.limits.dailyBillLimit}
                remaining={usage.remaining.bills}
              />
              <UsageCard
                label="Journal Entries"
                used={usage.today.journalEntriesCreated}
                limit={usage.limits.dailyJournalEntryLimit}
                remaining={usage.remaining.journalEntries}
              />
              <UsageCard
                label="Tokens"
                used={usage.today.tokensUsed}
                limit={usage.limits.dailyTokenLimit}
                remaining={usage.remaining.tokens}
                format="compact"
              />
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">
                  Total actions: <span className="font-medium text-foreground">{usage.today.totalActions}</span>
                </span>
                <span className="text-muted-foreground">
                  Mutations: <span className="font-medium text-foreground">{usage.today.totalMutations}</span>
                </span>
                <span className="text-muted-foreground">
                  Reads: <span className="font-medium text-foreground">{usage.today.totalReads}</span>
                </span>
              </div>
              {usage.today.totalAmountProcessed > 0 && (
                <span className="text-muted-foreground">
                  Amount processed: <span className="font-medium text-foreground">
                    MYR {usage.today.totalAmountProcessed.toLocaleString()}
                  </span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="approval" className="space-y-4">
        <TabsList>
          <TabsTrigger value="approval" className="gap-2">
            <Shield className="h-4 w-4" />
            Approval Settings
          </TabsTrigger>
          <TabsTrigger value="quotas" className="gap-2">
            <Settings className="h-4 w-4" />
            Quotas & Limits
          </TabsTrigger>
          <TabsTrigger value="safety" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Safety Controls
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approval">
          <Card>
            <CardHeader>
              <CardTitle>Approval Settings</CardTitle>
              <CardDescription>
                Configure when AI actions require human approval
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Approval for All Actions</Label>
                  <p className="text-sm text-muted-foreground">
                    All AI mutations will require manual approval
                  </p>
                </div>
                <Switch
                  checked={approvalForm.requireApproval}
                  onCheckedChange={(checked) =>
                    setApprovalForm((prev) => ({ ...prev, requireApproval: checked }))
                  }
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Threshold-Based Approval</h4>
                <p className="text-sm text-muted-foreground">
                  Require approval for transactions above these amounts
                </p>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceThreshold">Invoice Threshold (MYR)</Label>
                    <Input
                      id="invoiceThreshold"
                      type="number"
                      placeholder="e.g., 10000"
                      value={approvalForm.invoiceThreshold}
                      onChange={(e) =>
                        setApprovalForm((prev) => ({ ...prev, invoiceThreshold: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billThreshold">Bill Threshold (MYR)</Label>
                    <Input
                      id="billThreshold"
                      type="number"
                      placeholder="e.g., 10000"
                      value={approvalForm.billThreshold}
                      onChange={(e) =>
                        setApprovalForm((prev) => ({ ...prev, billThreshold: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="journalThreshold">Journal Entry Threshold (MYR)</Label>
                    <Input
                      id="journalThreshold"
                      type="number"
                      placeholder="e.g., 50000"
                      value={approvalForm.journalEntryThreshold}
                      onChange={(e) =>
                        setApprovalForm((prev) => ({ ...prev, journalEntryThreshold: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Auto-Approval Rules</h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-approve Read-Only Actions</Label>
                    <p className="text-sm text-muted-foreground">
                      Data fetching and reporting don't require approval
                    </p>
                  </div>
                  <Switch
                    checked={approvalForm.autoApproveReadOnly}
                    onCheckedChange={(checked) =>
                      setApprovalForm((prev) => ({ ...prev, autoApproveReadOnly: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-approve Recurring Workflows</Label>
                    <p className="text-sm text-muted-foreground">
                      Scheduled tasks run without approval each time
                    </p>
                  </div>
                  <Switch
                    checked={approvalForm.autoApproveRecurring}
                    onCheckedChange={(checked) =>
                      setApprovalForm((prev) => ({ ...prev, autoApproveRecurring: checked }))
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Notifications</h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notify on Approval Required</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when actions need your approval
                    </p>
                  </div>
                  <Switch
                    checked={approvalForm.notifyOnApprovalRequired}
                    onCheckedChange={(checked) =>
                      setApprovalForm((prev) => ({ ...prev, notifyOnApprovalRequired: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notify on Auto-Approved</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when actions are auto-approved
                    </p>
                  </div>
                  <Switch
                    checked={approvalForm.notifyOnAutoApproved}
                    onCheckedChange={(checked) =>
                      setApprovalForm((prev) => ({ ...prev, notifyOnAutoApproved: checked }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeoutHours">Approval Timeout (hours)</Label>
                  <Input
                    id="timeoutHours"
                    type="number"
                    className="w-32"
                    value={approvalForm.approvalTimeoutHours}
                    onChange={(e) =>
                      setApprovalForm((prev) => ({ ...prev, approvalTimeoutHours: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Pending approvals expire after this many hours
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveApprovalSettings}
                  disabled={updateApprovalSettings.isPending}
                >
                  {updateApprovalSettings.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  Save Approval Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotas">
          <Card>
            <CardHeader>
              <CardTitle>Quotas & Limits</CardTitle>
              <CardDescription>
                Set daily limits for AI agent actions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dailyInvoiceLimit">Daily Invoice Limit</Label>
                  <Input
                    id="dailyInvoiceLimit"
                    type="number"
                    value={quotaForm.dailyInvoiceLimit}
                    onChange={(e) =>
                      setQuotaForm((prev) => ({ ...prev, dailyInvoiceLimit: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyBillLimit">Daily Bill Limit</Label>
                  <Input
                    id="dailyBillLimit"
                    type="number"
                    value={quotaForm.dailyBillLimit}
                    onChange={(e) =>
                      setQuotaForm((prev) => ({ ...prev, dailyBillLimit: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyJournalLimit">Daily Journal Entry Limit</Label>
                  <Input
                    id="dailyJournalLimit"
                    type="number"
                    value={quotaForm.dailyJournalEntryLimit}
                    onChange={(e) =>
                      setQuotaForm((prev) => ({ ...prev, dailyJournalEntryLimit: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyQuotationLimit">Daily Quotation Limit</Label>
                  <Input
                    id="dailyQuotationLimit"
                    type="number"
                    value={quotaForm.dailyQuotationLimit}
                    onChange={(e) =>
                      setQuotaForm((prev) => ({ ...prev, dailyQuotationLimit: parseInt(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Amount Limits</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="maxInvoiceAmount">Max Single Invoice (MYR)</Label>
                    <Input
                      id="maxInvoiceAmount"
                      type="number"
                      placeholder="No limit"
                      value={quotaForm.maxSingleInvoiceAmount}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, maxSingleInvoiceAmount: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxBillAmount">Max Single Bill (MYR)</Label>
                    <Input
                      id="maxBillAmount"
                      type="number"
                      placeholder="No limit"
                      value={quotaForm.maxSingleBillAmount}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, maxSingleBillAmount: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxDailyAmount">Max Daily Total (MYR)</Label>
                    <Input
                      id="maxDailyAmount"
                      type="number"
                      placeholder="No limit"
                      value={quotaForm.maxDailyTotalAmount}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, maxDailyTotalAmount: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Rate Limits</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="actionsPerMinute">Max Actions per Minute</Label>
                    <Input
                      id="actionsPerMinute"
                      type="number"
                      value={quotaForm.maxActionsPerMinute}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, maxActionsPerMinute: parseInt(e.target.value) || 1 }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="concurrentWorkflows">Max Concurrent Workflows</Label>
                    <Input
                      id="concurrentWorkflows"
                      type="number"
                      value={quotaForm.maxConcurrentWorkflows}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, maxConcurrentWorkflows: parseInt(e.target.value) || 1 }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dailyTokenLimit">Daily Token Limit</Label>
                    <Input
                      id="dailyTokenLimit"
                      type="number"
                      value={quotaForm.dailyTokenLimit}
                      onChange={(e) =>
                        setQuotaForm((prev) => ({ ...prev, dailyTokenLimit: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveQuotas} disabled={updateQuotas.isPending}>
                  {updateQuotas.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  Save Quota Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety">
          <Card>
            <CardHeader>
              <CardTitle>Safety Controls</CardTitle>
              <CardDescription>
                Emergency controls and safety features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2 text-destructive">
                      <StopCircle className="h-5 w-5" />
                      Emergency Stop
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Immediately block all AI agent actions. Use this if you notice unexpected
                      behavior or need to investigate issues.
                    </p>
                    {usage?.emergencyStopEnabled && (
                      <Badge variant="destructive" className="mt-2">
                        Currently Active
                      </Badge>
                    )}
                  </div>

                  {usage?.emergencyStopEnabled ? (
                    <Button
                      variant="outline"
                      onClick={handleDisableEmergencyStop}
                      disabled={disableEmergencyStop.isPending}
                    >
                      {disableEmergencyStop.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      <Play className="h-4 w-4 mr-2" />
                      Resume AI Agent
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          <StopCircle className="h-4 w-4 mr-2" />
                          Activate Emergency Stop
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Activate Emergency Stop?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will immediately block all AI agent actions. Active workflows will
                            be paused and no new actions can be executed until you manually resume.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleEmergencyStop}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Activate Emergency Stop
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsageCard({
  label,
  used,
  limit,
  remaining,
  format = "number",
}: {
  label: string;
  used: number;
  limit: number;
  remaining: number;
  format?: "number" | "compact";
}) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  const formatValue = (value: number) => {
    if (format === "compact") {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", isCritical && "text-destructive", isWarning && !isCritical && "text-warning")}>
          {formatValue(used)} / {formatValue(limit)}
        </span>
      </div>
      <Progress
        value={percentage}
        className={cn(
          "h-2",
          isCritical && "[&>div]:bg-destructive",
          isWarning && !isCritical && "[&>div]:bg-warning"
        )}
      />
      <p className="text-xs text-muted-foreground">
        {formatValue(remaining)} remaining
      </p>
    </div>
  );
}
