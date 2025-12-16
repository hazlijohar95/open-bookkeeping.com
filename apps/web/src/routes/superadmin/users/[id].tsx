import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  UserIcon,
  MailIcon,
  CalendarIcon,
  ShieldIcon,
  BanIcon,
  CheckCircleIcon,
  FileTextIcon,
  UsersIcon,
  BuildingIcon,
  ClockIcon,
  AlertTriangleIcon,
  ZapIcon,
  SettingsIcon,
  SaveIcon,
  RefreshCwIcon,
} from "@/components/ui/icons";
import {
  useAdminUser,
  useSuspendUser,
  useUnsuspendUser,
  useUpdateUserRole,
  useUserQuotas,
  useUpdateUserQuotas,
  useEnableEmergencyStop,
  useDisableEmergencyStop,
  useResetUserDailyUsage,
} from "@/api/admin";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type UserRole = "superadmin" | "admin" | "user" | "viewer";

/**
 * Role Badge Component
 */
function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    superadmin: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Superadmin" },
    admin: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Admin" },
    user: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "User" },
    viewer: { className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", label: "Viewer" },
  };

  const variant = variants[role] ?? variants.user!;

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

/**
 * Stat Card Component
 */
function StatCard({
  title,
  value,
  icon: Icon,
  isLoading,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <div>
          {isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Usage Progress Bar Component
 */
function UsageProgressBar({
  label,
  current,
  limit,
  icon: Icon,
}: {
  label: string;
  current: number;
  limit: number;
  icon: React.ElementType;
}) {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span>{label}</span>
        </div>
        <span className={isAtLimit ? "text-red-600 font-medium" : isNearLimit ? "text-amber-600" : ""}>
          {current} / {limit}
        </span>
      </div>
      <Progress
        value={percentage}
        className={isAtLimit ? "[&>div]:bg-red-500" : isNearLimit ? "[&>div]:bg-amber-500" : ""}
      />
    </div>
  );
}

/**
 * User Detail Page
 */
export default function SuperadminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Dialog states
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [roleDialog, setRoleDialog] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [quotaDialog, setQuotaDialog] = useState(false);
  const [emergencyStopDialog, setEmergencyStopDialog] = useState(false);
  const [emergencyStopReason, setEmergencyStopReason] = useState("");

  // Quota edit state
  const [quotaEdits, setQuotaEdits] = useState({
    dailyInvoiceLimit: 100,
    dailyBillLimit: 100,
    dailyJournalEntryLimit: 200,
    dailyQuotationLimit: 100,
    dailyTokenLimit: 1000000,
    maxActionsPerMinute: 30,
    maxSingleInvoiceAmount: "",
    maxDailyTotalAmount: "",
  });

  // Fetch user
  const { data: user, isLoading, refetch } = useAdminUser(id ?? "");

  // Fetch quotas
  const { data: quotaData, isLoading: quotasLoading, refetch: refetchQuotas } = useUserQuotas(id ?? "");

  // Mutations
  const suspendMutation = useSuspendUser();
  const unsuspendMutation = useUnsuspendUser();
  const updateRoleMutation = useUpdateUserRole();
  const updateQuotasMutation = useUpdateUserQuotas();
  const enableEmergencyStopMutation = useEnableEmergencyStop();
  const disableEmergencyStopMutation = useDisableEmergencyStop();
  const resetDailyUsageMutation = useResetUserDailyUsage();

  const handleSuspend = async () => {
    if (!id || !suspendReason.trim()) return;

    try {
      await suspendMutation.mutateAsync({
        userId: id,
        reason: suspendReason,
      });
      toast.success("User suspended successfully");
      setSuspendDialog(false);
      setSuspendReason("");
      void refetch();
    } catch {
      toast.error("Failed to suspend user");
    }
  };

  const handleUnsuspend = async () => {
    if (!id) return;

    try {
      await unsuspendMutation.mutateAsync({ userId: id });
      toast.success("User unsuspended successfully");
      void refetch();
    } catch {
      toast.error("Failed to unsuspend user");
    }
  };

  const handleRoleChange = async () => {
    if (!id) return;

    try {
      await updateRoleMutation.mutateAsync({
        userId: id,
        newRole,
      });
      toast.success("User role updated successfully");
      setRoleDialog(false);
      void refetch();
    } catch {
      toast.error("Failed to update user role");
    }
  };

  const handleOpenQuotaDialog = () => {
    if (quotaData) {
      setQuotaEdits({
        dailyInvoiceLimit: quotaData.quotas.dailyInvoiceLimit,
        dailyBillLimit: quotaData.quotas.dailyBillLimit,
        dailyJournalEntryLimit: quotaData.quotas.dailyJournalEntryLimit,
        dailyQuotationLimit: quotaData.quotas.dailyQuotationLimit,
        dailyTokenLimit: quotaData.quotas.dailyTokenLimit,
        maxActionsPerMinute: quotaData.quotas.maxActionsPerMinute,
        maxSingleInvoiceAmount: quotaData.quotas.maxSingleInvoiceAmount ?? "",
        maxDailyTotalAmount: quotaData.quotas.maxDailyTotalAmount ?? "",
      });
    }
    setQuotaDialog(true);
  };

  const handleSaveQuotas = async () => {
    if (!id) return;

    try {
      await updateQuotasMutation.mutateAsync({
        userId: id,
        dailyInvoiceLimit: quotaEdits.dailyInvoiceLimit,
        dailyBillLimit: quotaEdits.dailyBillLimit,
        dailyJournalEntryLimit: quotaEdits.dailyJournalEntryLimit,
        dailyQuotationLimit: quotaEdits.dailyQuotationLimit,
        dailyTokenLimit: quotaEdits.dailyTokenLimit,
        maxActionsPerMinute: quotaEdits.maxActionsPerMinute,
        maxSingleInvoiceAmount: quotaEdits.maxSingleInvoiceAmount || null,
        maxDailyTotalAmount: quotaEdits.maxDailyTotalAmount || null,
      });
      toast.success("Quotas updated successfully");
      setQuotaDialog(false);
      void refetchQuotas();
    } catch {
      toast.error("Failed to update quotas");
    }
  };

  const handleEnableEmergencyStop = async () => {
    if (!id) return;

    try {
      await enableEmergencyStopMutation.mutateAsync({
        userId: id,
        reason: emergencyStopReason || undefined,
      });
      toast.success("Emergency stop enabled");
      setEmergencyStopDialog(false);
      setEmergencyStopReason("");
      void refetchQuotas();
    } catch {
      toast.error("Failed to enable emergency stop");
    }
  };

  const handleDisableEmergencyStop = async () => {
    if (!id) return;

    try {
      await disableEmergencyStopMutation.mutateAsync({ userId: id });
      toast.success("Emergency stop disabled");
      void refetchQuotas();
    } catch {
      toast.error("Failed to disable emergency stop");
    }
  };

  const handleResetDailyUsage = async () => {
    if (!id) return;

    try {
      await resetDailyUsageMutation.mutateAsync({ userId: id });
      toast.success("Daily usage counters reset successfully");
      void refetchQuotas();
    } catch {
      toast.error("Failed to reset daily usage");
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-16">
          <UserIcon className="size-16 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">User not found</h2>
          <p className="text-muted-foreground">The user you're looking for doesn't exist.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/superadmin/users")}>
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Users
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" asChild>
          <Link to="/superadmin/users">
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Users
          </Link>
        </Button>

        {/* User Profile Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || ""}
                  className="size-16 rounded-full"
                />
              ) : (
                <UserIcon className="size-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{user.name || "No name"}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MailIcon className="size-4" />
                <span>{user.email}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RoleBadge role={user.role} />
            {user.isSuspended ? (
              <Badge variant="destructive">Suspended</Badge>
            ) : (
              <Badge variant="outline" className="bg-green-100 text-green-800">Active</Badge>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-4">
              <StatCard
                title="Invoices"
                value={user.stats?.invoices ?? 0}
                icon={FileTextIcon}
              />
              <StatCard
                title="Bills"
                value={user.stats?.bills ?? 0}
                icon={FileTextIcon}
              />
              <StatCard
                title="Customers"
                value={user.stats?.customers ?? 0}
                icon={UsersIcon}
              />
              <StatCard
                title="Vendors"
                value={user.stats?.vendors ?? 0}
                icon={BuildingIcon}
              />
            </div>

            {/* Quotas & Usage */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ZapIcon className="size-5" />
                    Quotas & Limits
                  </CardTitle>
                  <CardDescription>Daily usage limits and restrictions</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetDailyUsage}
                    disabled={resetDailyUsageMutation.isPending}
                  >
                    <RefreshCwIcon className={`mr-2 size-4 ${resetDailyUsageMutation.isPending ? "animate-spin" : ""}`} />
                    {resetDailyUsageMutation.isPending ? "Resetting..." : "Reset Usage"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenQuotaDialog}>
                    <SettingsIcon className="mr-2 size-4" />
                    Edit Limits
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Emergency Stop Banner */}
                {quotaData?.quotas.emergencyStopEnabled && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangleIcon className="size-5 text-red-600" />
                        <div>
                          <p className="font-medium text-red-800 dark:text-red-200">Emergency Stop Active</p>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            {quotaData.quotas.emergencyStopReason || "All AI agent actions are blocked"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisableEmergencyStop}
                        disabled={disableEmergencyStopMutation.isPending}
                      >
                        {disableEmergencyStopMutation.isPending ? "Disabling..." : "Disable"}
                      </Button>
                    </div>
                  </div>
                )}

                {quotasLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : quotaData ? (
                  <>
                    {/* Today's Usage */}
                    <div>
                      <h4 className="mb-4 text-sm font-medium">Today's Usage</h4>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <UsageProgressBar
                          label="Invoices"
                          current={quotaData.usage.invoicesCreated}
                          limit={quotaData.quotas.dailyInvoiceLimit}
                          icon={FileTextIcon}
                        />
                        <UsageProgressBar
                          label="Bills"
                          current={quotaData.usage.billsCreated}
                          limit={quotaData.quotas.dailyBillLimit}
                          icon={FileTextIcon}
                        />
                        <UsageProgressBar
                          label="Journal Entries"
                          current={quotaData.usage.journalEntriesCreated}
                          limit={quotaData.quotas.dailyJournalEntryLimit}
                          icon={FileTextIcon}
                        />
                        <UsageProgressBar
                          label="Quotations"
                          current={quotaData.usage.quotationsCreated}
                          limit={quotaData.quotas.dailyQuotationLimit}
                          icon={FileTextIcon}
                        />
                        <UsageProgressBar
                          label="AI Tokens"
                          current={quotaData.usage.tokensUsed}
                          limit={quotaData.quotas.dailyTokenLimit}
                          icon={ZapIcon}
                        />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Total Actions Today</span>
                            <span className="font-medium">{quotaData.usage.totalActions}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Amount Processed</span>
                            <span className="font-medium">
                              RM {parseFloat(quotaData.usage.totalAmountProcessed ?? "0").toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Limits Summary */}
                    <div>
                      <h4 className="mb-4 text-sm font-medium">Configured Limits</h4>
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div className="flex justify-between p-2 rounded bg-muted/50">
                          <span className="text-muted-foreground">Max Single Invoice</span>
                          <span className="font-medium">
                            {quotaData.quotas.maxSingleInvoiceAmount
                              ? `RM ${parseFloat(quotaData.quotas.maxSingleInvoiceAmount).toLocaleString()}`
                              : "No limit"}
                          </span>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-muted/50">
                          <span className="text-muted-foreground">Max Daily Total</span>
                          <span className="font-medium">
                            {quotaData.quotas.maxDailyTotalAmount
                              ? `RM ${parseFloat(quotaData.quotas.maxDailyTotalAmount).toLocaleString()}`
                              : "No limit"}
                          </span>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-muted/50">
                          <span className="text-muted-foreground">Actions per Minute</span>
                          <span className="font-medium">{quotaData.quotas.maxActionsPerMinute}</span>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-muted/50">
                          <span className="text-muted-foreground">Concurrent Workflows</span>
                          <span className="font-medium">{quotaData.quotas.maxConcurrentWorkflows}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Unable to load quota data</p>
                )}
              </CardContent>
            </Card>

            {/* User Details */}
            <Card>
              <CardHeader>
                <CardTitle>User Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">User ID</p>
                    <p className="font-mono text-sm">{user.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="text-sm">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="text-sm">{user.name || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <RoleBadge role={user.role} />
                  </div>
                </div>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Joined</p>
                      <p className="text-sm">{new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClockIcon className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Last Active</p>
                      <p className="text-sm">
                        {user.lastActiveAt
                          ? new Date(user.lastActiveAt).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Suspension Info */}
            {user.isSuspended && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Suspension Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Suspended At</p>
                    <p className="text-sm">
                      {user.suspendedAt
                        ? new Date(user.suspendedAt).toLocaleString()
                        : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reason</p>
                    <p className="text-sm">{user.suspendedReason || "No reason provided"}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setNewRole(user.role as UserRole);
                    setRoleDialog(true);
                  }}
                >
                  <ShieldIcon className="mr-2 size-4" />
                  Change Role
                </Button>

                {user.isSuspended ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-green-600 hover:text-green-700"
                    onClick={handleUnsuspend}
                    disabled={unsuspendMutation.isPending}
                  >
                    <CheckCircleIcon className="mr-2 size-4" />
                    {unsuspendMutation.isPending ? "Unsuspending..." : "Unsuspend User"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={() => setSuspendDialog(true)}
                    disabled={user.role === "superadmin"}
                  >
                    <BanIcon className="mr-2 size-4" />
                    Suspend User
                  </Button>
                )}

                <Separator />

                {/* Emergency Stop */}
                {quotaData?.quotas.emergencyStopEnabled ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-green-600 hover:text-green-700"
                    onClick={handleDisableEmergencyStop}
                    disabled={disableEmergencyStopMutation.isPending}
                  >
                    <CheckCircleIcon className="mr-2 size-4" />
                    {disableEmergencyStopMutation.isPending ? "Disabling..." : "Disable Emergency Stop"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:text-red-700"
                    onClick={() => setEmergencyStopDialog(true)}
                  >
                    <AlertTriangleIcon className="mr-2 size-4" />
                    Emergency Stop
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span>{user.isSuspended ? "Suspended" : "Active"}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="capitalize">{user.role}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Documents</span>
                  <span>
                    {(user.stats?.invoices ?? 0) + (user.stats?.bills ?? 0)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Emergency Stop</span>
                  <span className={quotaData?.quotas.emergencyStopEnabled ? "text-red-600" : "text-green-600"}>
                    {quotaData?.quotas.emergencyStopEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialog} onOpenChange={setSuspendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>
              Suspend {user.email}. They will be logged out and unable to access the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for suspension</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for suspending this user..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspendMutation.isPending}
            >
              {suspendMutation.isPending ? "Suspending..." : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change the role for {user.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={updateRoleMutation.isPending || newRole === user.role}
            >
              {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Quotas Dialog */}
      <Dialog open={quotaDialog} onOpenChange={setQuotaDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User Quotas</DialogTitle>
            <DialogDescription>
              Configure daily limits and restrictions for {user.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dailyInvoiceLimit">Daily Invoice Limit</Label>
              <Input
                id="dailyInvoiceLimit"
                type="number"
                min={1}
                max={10000}
                value={quotaEdits.dailyInvoiceLimit}
                onChange={(e) => setQuotaEdits({ ...quotaEdits, dailyInvoiceLimit: parseInt(e.target.value) || 100 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyBillLimit">Daily Bill Limit</Label>
              <Input
                id="dailyBillLimit"
                type="number"
                min={1}
                max={10000}
                value={quotaEdits.dailyBillLimit}
                onChange={(e) => setQuotaEdits({ ...quotaEdits, dailyBillLimit: parseInt(e.target.value) || 100 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyJournalEntryLimit">Daily Journal Entry Limit</Label>
              <Input
                id="dailyJournalEntryLimit"
                type="number"
                min={1}
                max={10000}
                value={quotaEdits.dailyJournalEntryLimit}
                onChange={(e) => setQuotaEdits({ ...quotaEdits, dailyJournalEntryLimit: parseInt(e.target.value) || 200 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyQuotationLimit">Daily Quotation Limit</Label>
              <Input
                id="dailyQuotationLimit"
                type="number"
                min={1}
                max={10000}
                value={quotaEdits.dailyQuotationLimit}
                onChange={(e) => setQuotaEdits({ ...quotaEdits, dailyQuotationLimit: parseInt(e.target.value) || 100 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyTokenLimit">Daily Token Limit</Label>
              <Input
                id="dailyTokenLimit"
                type="number"
                min={1000}
                max={100000000}
                value={quotaEdits.dailyTokenLimit}
                onChange={(e) => setQuotaEdits({ ...quotaEdits, dailyTokenLimit: parseInt(e.target.value) || 1000000 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxActionsPerMinute">Max Actions per Minute</Label>
              <Input
                id="maxActionsPerMinute"
                type="number"
                min={1}
                max={100}
                value={quotaEdits.maxActionsPerMinute}
                onChange={(e) => setQuotaEdits({ ...quotaEdits, maxActionsPerMinute: parseInt(e.target.value) || 30 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxSingleInvoiceAmount">Max Single Invoice (RM)</Label>
              <Input
                id="maxSingleInvoiceAmount"
                type="text"
                placeholder="No limit"
                value={quotaEdits.maxSingleInvoiceAmount}
                onChange={(e) => setQuotaEdits({ ...quotaEdits, maxSingleInvoiceAmount: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Leave empty for no limit</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxDailyTotalAmount">Max Daily Total (RM)</Label>
              <Input
                id="maxDailyTotalAmount"
                type="text"
                placeholder="No limit"
                value={quotaEdits.maxDailyTotalAmount}
                onChange={(e) => setQuotaEdits({ ...quotaEdits, maxDailyTotalAmount: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Leave empty for no limit</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuotas} disabled={updateQuotasMutation.isPending}>
              <SaveIcon className="mr-2 size-4" />
              {updateQuotasMutation.isPending ? "Saving..." : "Save Quotas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emergency Stop Dialog */}
      <Dialog open={emergencyStopDialog} onOpenChange={setEmergencyStopDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangleIcon className="size-5" />
              Enable Emergency Stop
            </DialogTitle>
            <DialogDescription>
              This will immediately block ALL AI agent actions for {user.email}.
              The user will not be able to use AI features until you disable this.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyStopReason">Reason (optional)</Label>
              <Textarea
                id="emergencyStopReason"
                placeholder="Enter the reason for enabling emergency stop..."
                value={emergencyStopReason}
                onChange={(e) => setEmergencyStopReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmergencyStopDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEnableEmergencyStop}
              disabled={enableEmergencyStopMutation.isPending}
            >
              {enableEmergencyStopMutation.isPending ? "Enabling..." : "Enable Emergency Stop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
