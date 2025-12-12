import { useState, memo } from "react";
import { List } from "react-window";
import { formatDistanceToNow, format } from "date-fns";
import {
  useAuditLogs,
  useAuditStats,
  useExportAuditLogs,
  type AgentAuditLog,
} from "@/api/agent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2Icon,
  XCircleIcon,
  Download,
  Loader2Icon,
  Activity,
  TrendingUp,
  AlertTriangleIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  create_invoice: "Create Invoice",
  update_invoice: "Update Invoice",
  send_invoice: "SendIcon Invoice",
  mark_invoice_paid: "Mark Paid",
  void_invoice: "Void Invoice",
  create_bill: "Create Bill",
  update_bill: "Update Bill",
  mark_bill_paid: "Mark Paid",
  schedule_bill_payment: "Schedule Payment",
  create_journal_entry: "Journal Entry",
  reverse_journal_entry: "Reverse Entry",
  create_quotation: "Create Quotation",
  update_quotation: "Update Quotation",
  send_quotation: "SendIcon Quotation",
  convert_quotation: "Convert to Invoice",
  create_customer: "Create Customer",
  update_customer: "Update Customer",
  create_vendor: "Create Vendor",
  update_vendor: "Update Vendor",
  match_transaction: "Match Transaction",
  create_matching_entry: "Matching Entry",
  read_data: "Read Data",
  analyze_data: "Analyze Data",
};

const AuditLogRow = memo(({ log, onClick }: { log: AgentAuditLog; onClick: () => void }) => {
  const isSuccess = log.success === "yes";
  const financialImpact = log.financialImpact as { amount?: number; currency?: string } | null;

  return (
    <TableRow className="cursor-pointer hover:bg-muted/30" onClick={onClick}>
      <TableCell className="py-2.5">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircle2Icon className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <XCircleIcon className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className="text-xs font-medium jetbrains-mono">
            {ACTION_LABELS[log.action] || log.action}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-2.5">
        <Badge variant="outline" className="rounded-none text-[10px] px-1.5 py-0">
          {log.resourceType}
        </Badge>
      </TableCell>
      <TableCell className="py-2.5 text-muted-foreground max-w-[180px]">
        {log.reasoning ? (
          <span className="text-xs truncate block">{log.reasoning}</span>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="py-2.5">
        {financialImpact?.amount ? (
          <span className={cn(
            "text-xs font-medium jetbrains-mono",
            financialImpact.amount > 0 ? "text-emerald-600" : "text-destructive"
          )}>
            {financialImpact.currency ?? "MYR"} {financialImpact.amount.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="py-2.5">
        {log.approvalType && (
          <Badge variant={log.approvalType === "auto" ? "secondary" : "outline"} className="rounded-none text-[10px] px-1.5 py-0">
            {log.approvalType}
          </Badge>
        )}
      </TableCell>
      <TableCell className="py-2.5 text-muted-foreground text-xs">
        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
      </TableCell>
    </TableRow>
  );
});
AuditLogRow.displayName = "AuditLogRow";

const AuditLogDetails = memo(({ log, onClose }: { log: AgentAuditLog; onClose: () => void }) => {
  const isSuccess = log.success === "yes";
  const financialImpact = log.financialImpact as { amount?: number; currency?: string; type?: string } | null;

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg rounded-none">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2Icon className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircleIcon className="h-4 w-4 text-destructive" />
            )}
            <DialogTitle className="text-base jetbrains-mono">{ACTION_LABELS[log.action] || log.action}</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {format(new Date(log.createdAt), "PPpp")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Resource</Label>
              <p className="text-sm font-medium mt-0.5">{log.resourceType}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">ID</Label>
              <p className="text-xs font-medium mt-0.5 jetbrains-mono truncate">{log.resourceId ?? "—"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Approval</Label>
              <p className="text-sm font-medium mt-0.5">{log.approvalType ?? "None"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Confidence</Label>
              <p className="text-sm font-medium mt-0.5 jetbrains-mono">
                {log.confidence ? `${Math.round(parseFloat(log.confidence) * 100)}%` : "—"}
              </p>
            </div>
          </div>

          {log.reasoning && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Reasoning</Label>
              <p className="mt-1.5 text-sm bg-muted/50 p-3 rounded-none border">{log.reasoning}</p>
            </div>
          )}

          {financialImpact?.amount && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Financial Impact</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <TrendingUp className={cn(
                  "h-3.5 w-3.5",
                  financialImpact.amount > 0 ? "text-emerald-500" : "text-destructive"
                )} />
                <span className="text-sm font-medium jetbrains-mono">
                  {financialImpact.currency ?? "MYR"} {financialImpact.amount.toLocaleString()}
                </span>
                {financialImpact.type && (
                  <Badge variant="outline" className="rounded-none text-[10px]">{financialImpact.type}</Badge>
                )}
              </div>
            </div>
          )}

          {log.previousState && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Previous State</Label>
              <pre className="mt-1.5 text-xs bg-muted/50 p-3 rounded-none border overflow-auto max-h-28 jetbrains-mono">
                {JSON.stringify(log.previousState, null, 2)}
              </pre>
            </div>
          )}

          {log.newState && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">New State</Label>
              <pre className="mt-1.5 text-xs bg-muted/50 p-3 rounded-none border overflow-auto max-h-28 jetbrains-mono">
                {JSON.stringify(log.newState, null, 2)}
              </pre>
            </div>
          )}

          {!isSuccess && log.errorMessage && (
            <div>
              <Label className="text-xs text-destructive uppercase tracking-wide">Error</Label>
              <p className="mt-1.5 text-sm bg-destructive/10 text-destructive p-3 rounded-none border border-destructive/20">
                {log.errorMessage}
              </p>
              {log.errorDetails && (
                <pre className="mt-2 text-xs bg-muted/50 p-3 rounded-none border overflow-auto max-h-28 jetbrains-mono">
                  {JSON.stringify(log.errorDetails, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-3 border-t space-y-0.5 jetbrains-mono">
            <div>Session: {log.sessionId ?? "—"}</div>
            <div>Workflow: {log.workflowId ?? "—"}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-none h-8 text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
AuditLogDetails.displayName = "AuditLogDetails";

export function AuditLogs() {
  const [filters, setFilters] = useState<{
    action?: string;
    resourceType?: string;
    success?: string;
    limit?: number;
  }>({ limit: 50 });
  const [selectedLog, setSelectedLog] = useState<AgentAuditLog | null>(null);

  const { data: logs, isLoading: loadingLogs } = useAuditLogs(filters);
  const { data: stats, isLoading: loadingStats } = useAuditStats();
  const exportLogs = useExportAuditLogs();

  const handleExport = async (format: "json" | "csv") => {
    try {
      const result = await exportLogs.mutateAsync({ format });

      // Handle different result types
      if (result && typeof result === "object" && "url" in result) {
        // Result contains a download URL
        const url = (result as { url: string }).url;
        const link = document.createElement("a");
        link.href = url;
        link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported as ${format.toUpperCase()}`);
      } else if (Array.isArray(result)) {
        // Result is data directly - create a blob and download
        const data = format === "json"
          ? JSON.stringify(result, null, 2)
          : convertToCSV(result as Record<string, unknown>[]);
        const blob = new Blob([data], { type: format === "json" ? "application/json" : "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported as ${format.toUpperCase()}`);
      } else {
        // Fallback: use current logs data
        const exportData = logs ?? [];
        const data = format === "json"
          ? JSON.stringify(exportData, null, 2)
          : convertToCSV(exportData as unknown as Record<string, unknown>[]);
        const blob = new Blob([data], { type: format === "json" ? "application/json" : "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Exported as ${format.toUpperCase()}`);
      }
    } catch {
      toast.error("Failed to export");
    }
  };

  // Helper to convert array of objects to CSV
  const convertToCSV = (data: Record<string, unknown>[]): string => {
    if (!data?.length) return "";
    const firstItem = data[0];
    if (!firstItem) return "";
    const headers = Object.keys(firstItem);
    const rows = data.map(row =>
      headers.map(header => {
        const value = row[header];
        const stringValue = value === null || value === undefined ? "" : String(value);
        // Escape quotes and wrap in quotes if contains comma
        return stringValue.includes(",") || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  };

  const isLoading = loadingLogs || loadingStats;

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-none border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground jetbrains-mono">Total</p>
                  <p className="text-2xl font-semibold mt-1">{stats.totalActions}</p>
                </div>
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-none border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground jetbrains-mono">Successful</p>
                  <p className="text-2xl font-semibold mt-1">{stats.successfulActions}</p>
                </div>
                <CheckCircle2Icon className="h-5 w-5 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-none border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground jetbrains-mono">Failed</p>
                  <p className="text-2xl font-semibold mt-1">{stats.failedActions}</p>
                </div>
                <XCircleIcon className="h-5 w-5 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-none border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground jetbrains-mono">Pending</p>
                  <p className="text-2xl font-semibold mt-1">{stats.pendingApprovals}</p>
                </div>
                <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audit Logs Table */}
      <Card className="rounded-none border">
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium jetbrains-mono">Audit Log</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={exportLogs.isPending}
              className="h-7 text-xs rounded-none"
            >
              {exportLogs.isPending ? (
                <Loader2Icon className="h-3 w-3 animate-spin mr-1.5" />
              ) : (
                <Download className="h-3 w-3 mr-1.5" />
              )}
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 p-3 bg-muted/30 border-b">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Action</Label>
              <Select
                value={filters.action ?? "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, action: value === "all" ? undefined : value }))
                }
              >
                <SelectTrigger className="w-[140px] h-8 text-xs rounded-none">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="create_invoice">Create Invoice</SelectItem>
                  <SelectItem value="create_bill">Create Bill</SelectItem>
                  <SelectItem value="create_journal_entry">Journal Entry</SelectItem>
                  <SelectItem value="create_quotation">Create Quotation</SelectItem>
                  <SelectItem value="read_data">Read Data</SelectItem>
                  <SelectItem value="analyze_data">Analyze Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Resource</Label>
              <Select
                value={filters.resourceType ?? "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, resourceType: value === "all" ? undefined : value }))
                }
              >
                <SelectTrigger className="w-[120px] h-8 text-xs rounded-none">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="bill">Bill</SelectItem>
                  <SelectItem value="journal_entry">Journal</SelectItem>
                  <SelectItem value="quotation">Quotation</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</Label>
              <Select
                value={filters.success ?? "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, success: value === "all" ? undefined : value }))
                }
              >
                <SelectTrigger className="w-[100px] h-8 text-xs rounded-none">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Success</SelectItem>
                  <SelectItem value="no">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {(() => {
            const logsList = Array.isArray(logs) ? logs : [];

            if (isLoading) {
              return (
                <div className="flex items-center justify-center py-16">
                  <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              );
            }

            if (logsList.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-none bg-muted mb-3">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No logs yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Agent actions will appear here
                  </p>
                </div>
              );
            }

            // Fixed row height (py-2.5 on cells = ~40px total)
            const ROW_HEIGHT = 40;
            const HEADER_HEIGHT = 36;
            const CONTAINER_HEIGHT = 400;

            return (
              <div>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-wide font-medium h-9">Action</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide font-medium h-9">Resource</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide font-medium h-9">Reasoning</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide font-medium h-9">Impact</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide font-medium h-9">Approval</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wide font-medium h-9">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
                <div style={{ height: CONTAINER_HEIGHT - HEADER_HEIGHT }}>
                  <List<{ logs: AgentAuditLog[] }>
                    defaultHeight={CONTAINER_HEIGHT - HEADER_HEIGHT}
                    rowCount={logsList.length}
                    rowHeight={ROW_HEIGHT}
                    overscanCount={5}
                    rowProps={{ logs: logsList }}
                    rowComponent={({ index, style, logs }) => {
                      const log = logs[index];
                      if (!log) return <div style={style} />;

                      return (
                        <div style={style}>
                          <Table>
                            <TableBody>
                              <AuditLogRow
                                log={log}
                                onClick={() => setSelectedLog(log)}
                              />
                            </TableBody>
                          </Table>
                        </div>
                      );
                    }}
                  />
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {selectedLog && (
        <AuditLogDetails log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
