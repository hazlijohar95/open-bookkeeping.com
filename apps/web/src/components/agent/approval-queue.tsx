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
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Loader2,
  DollarSign,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

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

  const handleAction = async () => {
    if (actionType === "approve") {
      await approveAction.mutateAsync({ approvalId: approval.id, notes: notes || undefined });
      onApprove();
    } else if (actionType === "reject") {
      await rejectAction.mutateAsync({ approvalId: approval.id, notes: notes || undefined });
      onReject();
    }
    setActionType(null);
    setNotes("");
  };

  const impact = approval.estimatedImpact as {
    type?: string;
    amount?: number;
    currency?: string;
  } | null;

  return (
    <>
      <Card className="border-l-4 border-l-warning">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {ACTION_LABELS[approval.actionType] || approval.actionType}
              </CardTitle>
              <CardDescription className="text-xs">
                Requested {formatDistanceToNow(new Date(approval.createdAt), { addSuffix: true })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {confidence !== null && (
                <Badge variant={confidence >= 0.8 ? "default" : confidence >= 0.5 ? "secondary" : "outline"}>
                  {Math.round(confidence * 100)}% confidence
                </Badge>
              )}
              {isExpiringSoon && (
                <Badge variant="destructive" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Expiring soon
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {approval.reasoning && (
            <p className="text-sm text-muted-foreground">{approval.reasoning}</p>
          )}

          {impact && impact.amount && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {impact.currency || "MYR"} {impact.amount.toLocaleString()}
              </span>
              <span className="text-muted-foreground">estimated impact</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDetails(true)}
            >
              View Details
            </Button>
            <Button
              size="sm"
              variant="default"
              className="bg-success hover:bg-success/90"
              onClick={() => setActionType("approve")}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setActionType("reject")}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{ACTION_LABELS[approval.actionType] || approval.actionType}</DialogTitle>
            <DialogDescription>Review the action details before approving or rejecting</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {approval.reasoning && (
              <div>
                <h4 className="text-sm font-medium mb-1">AI Reasoning</h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  {approval.reasoning}
                </p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-1">Action Payload</h4>
              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">
                {JSON.stringify(approval.actionPayload, null, 2)}
              </pre>
            </div>

            {approval.previewData && (
              <div>
                <h4 className="text-sm font-medium mb-1">Preview</h4>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">
                  {JSON.stringify(approval.previewData, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Expires:</span>{" "}
                <span className={cn(isExpiringSoon && "text-destructive font-medium")}>
                  {formatDistanceToNow(new Date(approval.expiresAt), { addSuffix: true })}
                </span>
              </div>
              {confidence !== null && (
                <div>
                  <span className="text-muted-foreground">Confidence:</span>{" "}
                  <span>{Math.round(confidence * 100)}%</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionType !== null} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Action" : "Reject Action"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? "This will execute the AI action. Add optional notes for the audit log."
                : "This will reject the AI action. Add a reason for the rejection."}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder={actionType === "approve" ? "Optional notes..." : "Reason for rejection..."}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[80px]"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={approveAction.isPending || rejectAction.isPending}
            >
              {(approveAction.isPending || rejectAction.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ApprovalQueue() {
  const { data: approvals, isLoading, error } = usePendingApprovals(20);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load pending approvals</p>
        </CardContent>
      </Card>
    );
  }

  const pendingApprovals = approvals?.filter((a) => a.status === "pending") || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <Badge variant="secondary">{pendingApprovals.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              AI actions waiting for your approval
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {pendingApprovals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-success mb-3" />
            <p className="text-sm text-muted-foreground">
              No pending approvals
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              All AI actions have been processed
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
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
