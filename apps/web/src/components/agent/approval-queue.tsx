import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  usePendingApprovals,
  useApproveAction,
  useRejectAction,
  type PendingApproval,
} from "@/api/agent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  FileTextIcon,
  Loader2Icon,
  CurrencyDollarIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  create_invoice: "Create Invoice",
  update_invoice: "Update Invoice",
  send_invoice: "Send Invoice",
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
  send_quotation: "Send Quotation",
  convert_quotation: "Convert to Invoice",
  create_customer: "Create Customer",
  update_customer: "Update Customer",
  create_vendor: "Create Vendor",
  update_vendor: "Update Vendor",
  match_transaction: "Match Transaction",
  create_matching_entry: "Matching Entry",
};

interface ApprovalCardProps {
  approval: PendingApproval;
  onApprove: () => void;
  onReject: () => void;
}

function ApprovalCard({ approval, onApprove, onReject }: ApprovalCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  const approveAction = useApproveAction();
  const rejectAction = useRejectAction();

  const isExpiringSoon = new Date(approval.expiresAt).getTime() - Date.now() < 3600000; // 1 hour
  const confidence = approval.confidence ? parseFloat(approval.confidence) : null;

  const [actionError, setActionError] = useState<string | null>(null);

  const handleAction = async () => {
    setActionError(null);
    try {
      if (actionType === "approve") {
        await approveAction.mutateAsync({ approvalId: approval.id, notes: notes ?? undefined });
        onApprove();
        setActionType(null);
        setNotes("");
      } else if (actionType === "reject") {
        await rejectAction.mutateAsync({ approvalId: approval.id, notes: notes ?? undefined });
        onReject();
        setActionType(null);
        setNotes("");
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed. Please try again.");
    }
  };

  const handleDialogClose = () => {
    setActionType(null);
    setNotes("");
    setActionError(null);
  };

  const impact = approval.estimatedImpact as {
    type?: string;
    amount?: number;
    currency?: string;
  } | null;

  return (
    <>
      <Card className="rounded-none border border-l-2 border-l-amber-500">
        <CardHeader className="pb-2 px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <CardTitle className="text-sm font-medium flex items-center gap-2 jetbrains-mono">
                <FileTextIcon className="h-3.5 w-3.5 shrink-0" />
                {ACTION_LABELS[approval.actionType] || approval.actionType}
              </CardTitle>
              <CardDescription className="text-xs">
                {formatDistanceToNow(new Date(approval.createdAt), { addSuffix: true })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {confidence !== null && (
                <Badge variant="outline" className="rounded-none text-[10px] px-1.5 py-0.5">
                  {Math.round(confidence * 100)}%
                </Badge>
              )}
              {isExpiringSoon && (
                <Badge variant="destructive" className="rounded-none text-[10px] px-1.5 py-0.5 gap-1">
                  <ClockIcon className="h-2.5 w-2.5" />
                  Expiring
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          {approval.reasoning && (
            <p className="text-xs text-muted-foreground line-clamp-2">{approval.reasoning}</p>
          )}

          {impact && typeof impact.amount === "number" && !isNaN(impact.amount) && (
            <div className="flex items-center gap-1.5 text-xs">
              <CurrencyDollarIcon className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium jetbrains-mono">
                {impact.currency ?? "MYR"} {impact.amount.toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDetails(true)}
              className="h-7 text-xs rounded-none"
            >
              Details
            </Button>
            <Button
              size="sm"
              onClick={() => setActionType("approve")}
              className="h-7 text-xs rounded-none bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2Icon className="h-3 w-3 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setActionType("reject")}
              className="h-7 text-xs rounded-none"
            >
              <XCircleIcon className="h-3 w-3 mr-1" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="text-base jetbrains-mono">{ACTION_LABELS[approval.actionType] || approval.actionType}</DialogTitle>
            <DialogDescription className="text-xs">Review action details</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {approval.reasoning && (
              <div>
                <h4 className="text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wide">Reasoning</h4>
                <p className="text-sm bg-muted/50 p-3 rounded-none border">
                  {approval.reasoning}
                </p>
              </div>
            )}

            <div>
              <h4 className="text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wide">Payload</h4>
              <pre className="text-xs bg-muted/50 p-3 rounded-none border overflow-auto max-h-40 jetbrains-mono">
                {JSON.stringify(approval.actionPayload, null, 2)}
              </pre>
            </div>

            {approval.previewData && (
              <div>
                <h4 className="text-xs font-medium mb-1.5 text-muted-foreground uppercase tracking-wide">Preview</h4>
                <pre className="text-xs bg-muted/50 p-3 rounded-none border overflow-auto max-h-40 jetbrains-mono">
                  {JSON.stringify(approval.previewData, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs pt-2 border-t">
              <div>
                <span className="text-muted-foreground">Expires</span>{" "}
                <span className={cn("jetbrains-mono", isExpiringSoon && "text-destructive font-medium")}>
                  {formatDistanceToNow(new Date(approval.expiresAt), { addSuffix: true })}
                </span>
              </div>
              {confidence !== null && (
                <div>
                  <span className="text-muted-foreground">Confidence</span>{" "}
                  <span className="jetbrains-mono">{Math.round(confidence * 100)}%</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)} className="rounded-none h-8 text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionType !== null} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-sm rounded-none">
          <DialogHeader>
            <DialogTitle className="text-base">
              {actionType === "approve" ? "Approve Action" : "Reject Action"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {actionType === "approve"
                ? "Add optional notes for the audit log."
                : "Provide a reason for rejection."}
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-none border border-destructive/20">
              {actionError}
            </div>
          )}

          <Textarea
            placeholder={actionType === "approve" ? "Optional notes..." : "Reason for rejection..."}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px] rounded-none text-sm resize-none"
          />

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleDialogClose} className="rounded-none h-8 text-xs">
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={approveAction.isPending || rejectAction.isPending}
              className={cn("rounded-none h-8 text-xs", actionType === "approve" && "bg-emerald-600 hover:bg-emerald-700")}
            >
              {(approveAction.isPending || rejectAction.isPending) && (
                <Loader2Icon className="h-3 w-3 mr-1.5 animate-spin" />
              )}
              {actionType === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ApprovalQueue() {
  const { data: approvals, isLoading, error } = usePendingApprovals(20);

  const approvalsList = Array.isArray(approvals) ? approvals : [];
  const pendingApprovals = approvalsList.filter((a) => a.status === "pending");

  return (
    <Card className="rounded-none border">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium jetbrains-mono">Pending Approvals</CardTitle>
            {pendingApprovals.length > 0 && (
              <Badge variant="secondary" className="rounded-none text-[10px] px-1.5 py-0 h-5">{pendingApprovals.length}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <XCircleIcon className="h-8 w-8 text-destructive mb-2" />
            <p className="text-xs text-destructive">Failed to load approvals</p>
          </div>
        ) : pendingApprovals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-none bg-emerald-500/10 mb-3">
              <CheckCircle2Icon className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs text-muted-foreground mt-1">
              No actions waiting for approval
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2 p-3">
              {pendingApprovals.map((approval) => (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  onApprove={() => {}}
                  onReject={() => {}}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
