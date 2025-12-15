"use client";

import { useState, memo, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { useApproveAction, useRejectAction, type PendingApproval } from "@/api/agent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ChevronDownIcon,
  ChevronRightIcon,
  Eye,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

// Action labels mapping
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

// Action descriptions for better UX
const ACTION_DESCRIPTIONS: Record<string, string> = {
  create_invoice: "A new invoice will be created with the specified details",
  update_invoice: "The invoice will be updated with the new information",
  send_invoice: "The invoice will be sent to the customer",
  mark_invoice_paid: "The invoice will be marked as paid",
  void_invoice: "The invoice will be voided and cannot be used",
  create_bill: "A new bill will be created for tracking",
  create_journal_entry: "A new journal entry will be posted to the ledger",
};

interface InlineApprovalCardProps {
  approval: PendingApproval;
  onApproved?: () => void;
  onRejected?: () => void;
  compact?: boolean;
}

// Format currency
function formatCurrency(amount: number, currency = "MYR"): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Get impact display
function getImpactDisplay(impact: Record<string, unknown> | null): string | null {
  if (!impact) return null;
  if (typeof impact.amount === "number" && !isNaN(impact.amount)) {
    const currency = (impact.currency as string) || "MYR";
    return formatCurrency(impact.amount, currency);
  }
  return null;
}

export const InlineApprovalCard = memo(function InlineApprovalCard({
  approval,
  onApproved,
  onRejected,
  compact = false,
}: InlineApprovalCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const approveAction = useApproveAction();
  const rejectAction = useRejectAction();

  const isExpiringSoon = new Date(approval.expiresAt).getTime() - Date.now() < 3600000;
  const confidence = approval.confidence ? parseFloat(approval.confidence) : null;
  const impactDisplay = getImpactDisplay(approval.estimatedImpact);
  const actionLabel = ACTION_LABELS[approval.actionType] || approval.actionType;
  const actionDescription = ACTION_DESCRIPTIONS[approval.actionType];

  const handleApprove = useCallback(async () => {
    setIsProcessing(true);
    try {
      await approveAction.mutateAsync({ approvalId: approval.id });
      toast.success(`${actionLabel} approved`);
      onApproved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setIsProcessing(false);
    }
  }, [approval.id, approveAction, actionLabel, onApproved]);

  const handleReject = useCallback(async () => {
    setIsProcessing(true);
    try {
      await rejectAction.mutateAsync({
        approvalId: approval.id,
        notes: rejectReason || undefined,
      });
      toast.success(`${actionLabel} rejected`);
      setShowRejectDialog(false);
      setRejectReason("");
      onRejected?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
    } finally {
      setIsProcessing(false);
    }
  }, [approval.id, rejectAction, rejectReason, actionLabel, onRejected]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "my-2 border rounded-none overflow-hidden",
          "bg-gradient-to-r from-amber-500/5 to-transparent",
          "border-l-2 border-l-amber-500"
        )}
      >
        {/* Header */}
        <div className="px-3 py-2 flex items-start gap-3">
          {/* Icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-amber-500/10 border border-amber-500/20">
            <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">Action Requires Approval</span>
              {isExpiringSoon && (
                <Badge variant="destructive" className="rounded-none text-[9px] px-1 py-0 h-4 gap-0.5">
                  <ClockIcon className="h-2.5 w-2.5" />
                  Expiring
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-1">
              <FileTextIcon className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{actionLabel}</span>
              {impactDisplay && (
                <Badge variant="outline" className="rounded-none text-[10px] px-1.5 py-0 h-4 ml-1 font-mono">
                  {impactDisplay}
                </Badge>
              )}
            </div>

            {/* Reasoning preview */}
            {approval.reasoning && !compact && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                {approval.reasoning}
              </p>
            )}

            {/* Expandable details */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-2 overflow-hidden"
                >
                  {actionDescription && (
                    <p className="text-xs text-muted-foreground/70 italic">
                      {actionDescription}
                    </p>
                  )}

                  {approval.previewData && (
                    <div className="bg-muted/30 border rounded-none p-2">
                      <pre className="text-[10px] font-mono overflow-auto max-h-24 text-muted-foreground">
                        {JSON.stringify(approval.previewData, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>
                      Created {formatDistanceToNow(new Date(approval.createdAt), { addSuffix: true })}
                    </span>
                    {confidence !== null && (
                      <span className="font-mono">
                        {Math.round(confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-2.5">
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isProcessing}
                className="h-7 text-xs rounded-none bg-emerald-600 hover:bg-emerald-700 gap-1"
              >
                {isProcessing ? (
                  <Loader2Icon className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2Icon className="h-3 w-3" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                disabled={isProcessing}
                className="h-7 text-xs rounded-none gap-1"
              >
                <XCircleIcon className="h-3 w-3" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-7 text-xs rounded-none gap-1 text-muted-foreground"
              >
                <Eye className="h-3 w-3" />
                {isExpanded ? "Less" : "Details"}
                {isExpanded ? (
                  <ChevronDownIcon className="h-3 w-3" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-sm rounded-none">
          <DialogHeader>
            <DialogTitle className="text-base">Reject Action</DialogTitle>
            <DialogDescription className="text-xs">
              Provide a reason for rejecting "{actionLabel}"
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="rounded-none text-sm min-h-[80px]"
          />

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              className="rounded-none h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing}
              className="rounded-none h-8 text-xs gap-1"
            >
              {isProcessing && <Loader2Icon className="h-3 w-3 animate-spin" />}
              Reject Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

// Batch approval component for multiple pending approvals
interface InlineApprovalListProps {
  approvals: PendingApproval[];
  onApprovalChange?: () => void;
  maxVisible?: number;
}

export const InlineApprovalList = memo(function InlineApprovalList({
  approvals,
  onApprovalChange,
  maxVisible = 3,
}: InlineApprovalListProps) {
  const [showAll, setShowAll] = useState(false);

  if (approvals.length === 0) return null;

  const visibleApprovals = showAll ? approvals : approvals.slice(0, maxVisible);
  const hiddenCount = approvals.length - maxVisible;

  return (
    <div className="space-y-2">
      {visibleApprovals.map((approval) => (
        <InlineApprovalCard
          key={approval.id}
          approval={approval}
          onApproved={onApprovalChange}
          onRejected={onApprovalChange}
        />
      ))}

      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-dashed rounded-none"
        >
          Show {hiddenCount} more pending approval{hiddenCount > 1 ? "s" : ""}
        </button>
      )}

      {showAll && hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
});

export default InlineApprovalCard;
