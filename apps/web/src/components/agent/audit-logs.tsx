import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  useAuditLogs,
  useAuditStats,
  useExportAuditLogs,
  type AgentAuditLog,
} from "@/api/agent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  Activity,
  TrendingUp,
  AlertTriangle,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  create_invoice: "Create Invoice",
  update_invoice: "Update Invoice",
  send_invoice: "Send Invoice",
  mark_invoice_paid: "Mark Invoice Paid",
  void_invoice: "Void Invoice",
  create_bill: "Create Bill",
  update_bill: "Update Bill",
  mark_bill_paid: "Mark Bill Paid",
  schedule_bill_payment: "Schedule Payment",
  create_journal_entry: "Create Journal Entry",
  reverse_journal_entry: "Reverse Journal Entry",
  create_quotation: "Create Quotation",
  update_quotation: "Update Quotation",
  send_quotation: "Send Quotation",
  convert_quotation: "Convert Quotation",
  create_customer: "Create Customer",
  update_customer: "Update Customer",
  create_vendor: "Create Vendor",
  update_vendor: "Update Vendor",
  match_transaction: "Match Transaction",
  create_matching_entry: "Create Matching Entry",
  read_data: "Read Data",
  analyze_data: "Analyze Data",
};

function AuditLogRow({ log, onClick }: { log: AgentAuditLog; onClick: () => void }) {
  const isSuccess = log.success === "yes";
  const financialImpact = log.financialImpact as { amount?: number; currency?: string } | null;

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onClick}>
      <TableCell>
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          <span className="font-medium">
            {ACTION_LABELS[log.action] || log.action}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {log.resourceType}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {log.reasoning ? (
          <span className="truncate max-w-[200px] block">{log.reasoning}</span>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )}
      </TableCell>
      <TableCell>
        {financialImpact?.amount ? (
          <span className={cn(
            "font-medium",
            financialImpact.amount > 0 ? "text-success" : "text-destructive"
          )}>
            {financialImpact.currency || "MYR"} {financialImpact.amount.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )}
      </TableCell>
      <TableCell>
        {log.approvalType && (
          <Badge variant={log.approvalType === "auto" ? "secondary" : "default"} className="text-xs">
            {log.approvalType}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
      </TableCell>
    </TableRow>
  );
}

function AuditLogDetails({ log, onClose }: { log: AgentAuditLog; onClose: () => void }) {
  const isSuccess = log.success === "yes";
  const financialImpact = log.financialImpact as { amount?: number; currency?: string; type?: string } | null;

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <DialogTitle>{ACTION_LABELS[log.action] || log.action}</DialogTitle>
          </div>
          <DialogDescription>
            Executed {format(new Date(log.createdAt), "PPpp")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Resource Type</Label>
              <p className="font-medium">{log.resourceType}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Resource ID</Label>
              <p className="font-medium font-mono text-sm">{log.resourceId || "-"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Approval Type</Label>
              <p className="font-medium">{log.approvalType || "None required"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Confidence</Label>
              <p className="font-medium">
                {log.confidence ? `${Math.round(parseFloat(log.confidence) * 100)}%` : "-"}
              </p>
            </div>
          </div>

          {log.reasoning && (
            <div>
              <Label className="text-muted-foreground">AI Reasoning</Label>
              <p className="mt-1 text-sm bg-muted p-3 rounded-lg">{log.reasoning}</p>
            </div>
          )}

          {financialImpact && financialImpact.amount && (
            <div>
              <Label className="text-muted-foreground">Financial Impact</Label>
              <div className="mt-1 flex items-center gap-2">
                <TrendingUp className={cn(
                  "h-4 w-4",
                  financialImpact.amount > 0 ? "text-success" : "text-destructive"
                )} />
                <span className="font-medium">
                  {financialImpact.currency || "MYR"} {financialImpact.amount.toLocaleString()}
                </span>
                {financialImpact.type && (
                  <Badge variant="outline">{financialImpact.type}</Badge>
                )}
              </div>
            </div>
          )}

          {log.previousState && (
            <div>
              <Label className="text-muted-foreground">Previous State</Label>
              <pre className="mt-1 text-xs bg-muted p-3 rounded-lg overflow-auto max-h-32">
                {JSON.stringify(log.previousState, null, 2)}
              </pre>
            </div>
          )}

          {log.newState && (
            <div>
              <Label className="text-muted-foreground">New State</Label>
              <pre className="mt-1 text-xs bg-muted p-3 rounded-lg overflow-auto max-h-32">
                {JSON.stringify(log.newState, null, 2)}
              </pre>
            </div>
          )}

          {!isSuccess && log.errorMessage && (
            <div>
              <Label className="text-destructive">Error</Label>
              <p className="mt-1 text-sm bg-destructive/10 text-destructive p-3 rounded-lg">
                {log.errorMessage}
              </p>
              {log.errorDetails && (
                <pre className="mt-2 text-xs bg-muted p-3 rounded-lg overflow-auto max-h-32">
                  {JSON.stringify(log.errorDetails, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-4 border-t space-y-1">
            <div>Session ID: {log.sessionId || "-"}</div>
            <div>Workflow ID: {log.workflowId || "-"}</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
      toast.success(`Audit logs exported as ${format.toUpperCase()}`);
      // In a real app, this would trigger a download
      console.log("Export URL:", result);
    } catch {
      toast.error("Failed to export audit logs");
    }
  };

  const isLoading = loadingLogs || loadingStats;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Actions</p>
                  <p className="text-2xl font-bold">{stats.totalActions}</p>
                </div>
                <Activity className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Successful</p>
                  <p className="text-2xl font-bold">{stats.successfulActions}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold">{stats.failedActions}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                  <p className="text-2xl font-bold">{stats.pendingApprovals}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Complete history of all AI agent actions</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={exportLogs.isPending}
              >
                {exportLogs.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="ml-2">Export CSV</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <Label className="text-xs">Action</Label>
              <Select
                value={filters.action || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, action: value === "all" ? undefined : value }))
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="create_invoice">Create Invoice</SelectItem>
                  <SelectItem value="create_bill">Create Bill</SelectItem>
                  <SelectItem value="create_journal_entry">Create Journal Entry</SelectItem>
                  <SelectItem value="create_quotation">Create Quotation</SelectItem>
                  <SelectItem value="read_data">Read Data</SelectItem>
                  <SelectItem value="analyze_data">Analyze Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Resource</Label>
              <Select
                value={filters.resourceType || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, resourceType: value === "all" ? undefined : value }))
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="bill">Bill</SelectItem>
                  <SelectItem value="journal_entry">Journal Entry</SelectItem>
                  <SelectItem value="quotation">Quotation</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={filters.success || "all"}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, success: value === "all" ? undefined : value }))
                }
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="yes">Success</SelectItem>
                  <SelectItem value="no">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No audit logs found</p>
              <p className="text-xs text-muted-foreground mt-1">
                AI agent actions will appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Reasoning</TableHead>
                    <TableHead>Impact</TableHead>
                    <TableHead>Approval</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <AuditLogRow
                      key={log.id}
                      log={log}
                      onClick={() => setSelectedLog(log)}
                    />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {selectedLog && (
        <AuditLogDetails log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
