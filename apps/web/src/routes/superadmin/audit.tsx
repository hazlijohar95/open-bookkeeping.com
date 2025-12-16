import { useState } from "react";
import {
  FileTextIcon,
  FilterIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import { useAdminAuditLogs } from "@/api/admin";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type AdminActionType =
  | "user_role_changed"
  | "user_suspended"
  | "user_unsuspended"
  | "user_deleted"
  | "org_created"
  | "org_updated"
  | "org_deleted"
  | "org_subscription_changed"
  | "system_setting_updated"
  | "feature_flag_toggled"
  | "maintenance_mode_toggled"
  | "quota_override_set"
  | "quota_override_removed"
  | "api_key_revoked"
  | "session_terminated";

/**
 * Action Badge Component
 */
function ActionBadge({ action }: { action: string }) {
  const actionConfig: Record<string, { className: string; label: string }> = {
    user_role_changed: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Role Changed" },
    user_suspended: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "User Suspended" },
    user_unsuspended: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "User Unsuspended" },
    user_deleted: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "User Deleted" },
    org_created: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Org Created" },
    org_updated: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Org Updated" },
    org_deleted: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Org Deleted" },
    org_subscription_changed: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", label: "Subscription Changed" },
    system_setting_updated: { className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", label: "Setting Updated" },
    feature_flag_toggled: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Flag Toggled" },
    maintenance_mode_toggled: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", label: "Maintenance Toggle" },
    quota_override_set: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Quota Override" },
    quota_override_removed: { className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", label: "Override Removed" },
    api_key_revoked: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "API Key Revoked" },
    session_terminated: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Session Terminated" },
  };

  const config = actionConfig[action] ?? { className: "bg-gray-100 text-gray-800", label: action };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

/**
 * Audit Log Item Component
 */
function AuditLogItem({
  log,
}: {
  log: {
    id: string;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    reason?: string | null;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    createdAt: string | Date;
    admin?: { email: string; name: string | null } | null;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50">
            <div className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <ShieldIcon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <ActionBadge action={log.action} />
                  {log.targetType && (
                    <span className="text-sm text-muted-foreground">
                      on {log.targetType}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  by {log.admin?.email ?? "Unknown"} -{" "}
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            {isOpen ? (
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {log.targetId && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Target ID</p>
                  <p className="font-mono text-sm">{log.targetId}</p>
                </div>
              )}
              {log.reason && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Reason</p>
                  <p className="text-sm">{log.reason}</p>
                </div>
              )}
              {log.ipAddress && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">IP Address</p>
                  <p className="font-mono text-sm">{log.ipAddress}</p>
                </div>
              )}
              {log.beforeState && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Before</p>
                  <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-auto">
                    {JSON.stringify(log.beforeState, null, 2)}
                  </pre>
                </div>
              )}
              {log.afterState && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">After</p>
                  <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-auto">
                    {JSON.stringify(log.afterState, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Audit Logs Page
 */
export default function SuperadminAudit() {
  const [actionFilter, setActionFilter] = useState<AdminActionType | "all">("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  // Fetch audit logs
  const { data, isLoading } = useAdminAuditLogs({
    action: actionFilter !== "all" ? actionFilter : undefined,
    targetType: targetTypeFilter !== "all" ? targetTypeFilter : undefined,
    limit,
    offset: page * limit,
  });

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all administrative actions on the platform
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FilterIcon className="size-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Select
                value={actionFilter}
                onValueChange={(v) => setActionFilter(v as AdminActionType | "all")}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="user_role_changed">Role Changed</SelectItem>
                  <SelectItem value="user_suspended">User Suspended</SelectItem>
                  <SelectItem value="user_unsuspended">User Unsuspended</SelectItem>
                  <SelectItem value="user_deleted">User Deleted</SelectItem>
                  <SelectItem value="org_created">Org Created</SelectItem>
                  <SelectItem value="org_updated">Org Updated</SelectItem>
                  <SelectItem value="org_subscription_changed">Subscription Changed</SelectItem>
                  <SelectItem value="system_setting_updated">Setting Updated</SelectItem>
                  <SelectItem value="feature_flag_toggled">Flag Toggled</SelectItem>
                  <SelectItem value="maintenance_mode_toggled">Maintenance Toggle</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={targetTypeFilter}
                onValueChange={setTargetTypeFilter}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All targets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All targets</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileTextIcon className="size-5" />
              Activity Log
            </CardTitle>
            <CardDescription>
              {data?.total ?? 0} total log entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : data?.logs.length === 0 ? (
              <div className="py-12 text-center">
                <FileTextIcon className="mx-auto size-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No audit logs</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Administrative actions will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.logs.map((log) => (
                  <AuditLogItem key={log.id} log={log} />
                ))}
              </div>
            )}
          </CardContent>

          {/* Pagination */}
          {data && data.total > limit && (
            <div className="flex items-center justify-between border-t px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Showing {page * limit + 1} to {Math.min((page + 1) * limit, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * limit >= data.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardContent className="flex items-start gap-4 p-4">
            <ShieldIcon className="mt-0.5 size-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Compliance & Security
              </p>
              <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                All administrative actions are automatically logged for compliance and security
                purposes. Logs are retained for 90 days and cannot be modified or deleted.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
