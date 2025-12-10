import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileCheckIcon, TriangleWarningIcon } from "@/assets/icons";
import { Loader2, ChevronDown, RefreshCw, XCircle } from "@/components/ui/icons";
import {
  useEInvoiceSettings,
  useValidateInvoice,
  useSubmitInvoice,
  useCancelDocument,
} from "@/api/einvoice";
import { useQueryClient } from "@tanstack/react-query";
import { einvoiceKeys } from "@/api/einvoice";
import { toast } from "sonner";
import type { EInvoiceStatus } from "./submission-status-badge";

interface SubmitButtonProps {
  invoiceId: string;
  status: EInvoiceStatus;
  documentType?: "invoice" | "credit_note" | "debit_note";
  onSuccess?: () => void;
  disabled?: boolean;
}

export function EInvoiceSubmitButton({
  invoiceId,
  status,
  documentType = "invoice",
  onSuccess,
  disabled = false,
}: SubmitButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const queryClient = useQueryClient();

  const submitMutation = useSubmitInvoice();
  const cancelMutation = useCancelDocument();

  const { data: einvoiceSettings } = useEInvoiceSettings();
  const { data: validation } = useValidateInvoice(invoiceId);

  const isEInvoiceEnabled = einvoiceSettings?.enabled;
  const isConfigured =
    einvoiceSettings?.tin && einvoiceSettings?.brn && einvoiceSettings?.msicCode;
  const canSubmit =
    isEInvoiceEnabled &&
    isConfigured &&
    validation?.valid &&
    (!status || status === "invalid");
  const canCancel = status === "valid";
  const canRefresh = status === "submitted";

  const handleSubmit = () => {
    setShowConfirmDialog(false);
    submitMutation.mutate(
      { invoiceId },
      {
        onSuccess: () => {
          toast.success("Invoice submitted to MyInvois");
          queryClient.invalidateQueries({ queryKey: einvoiceKeys.history(invoiceId) });
          onSuccess?.();
        },
        onError: (error) => {
          toast.error(`Failed to submit: ${error.message}`);
        },
      }
    );
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }
    cancelMutation.mutate(
      { invoiceId, reason: cancelReason },
      {
        onSuccess: () => {
          toast.success("E-invoice cancelled successfully");
          queryClient.invalidateQueries({ queryKey: einvoiceKeys.history(invoiceId) });
          setShowCancelDialog(false);
          onSuccess?.();
        },
        onError: (error) => {
          toast.error(`Failed to cancel: ${error.message}`);
        },
      }
    );
  };

  // Not enabled or not configured
  if (!isEInvoiceEnabled) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <FileCheckIcon className="size-4" />
        E-Invoice Not Enabled
      </Button>
    );
  }

  if (!isConfigured) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <TriangleWarningIcon className="size-4" />
        Configure E-Invoice
      </Button>
    );
  }

  // Already submitted and valid - show dropdown with cancel option
  if (status === "valid" || status === "submitted") {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={disabled}
            >
              <FileCheckIcon className="size-4" />
              E-Invoice
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canRefresh && (
              <DropdownMenuItem
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: einvoiceKeys.history(invoiceId) });
                  toast.success("Refreshing submission status...");
                }}
              >
                <RefreshCw className="mr-2 size-4" />
                Refresh Status
              </DropdownMenuItem>
            )}
            {canCancel && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <XCircle className="mr-2 size-4" />
                  Cancel E-Invoice
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Cancel Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel E-Invoice</DialogTitle>
              <DialogDescription>
                This will cancel the validated e-invoice in MyInvois. This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="reason" className="text-sm font-medium">
                  Cancellation Reason
                </label>
                <textarea
                  id="reason"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Enter reason for cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(false)}
              >
                Keep E-Invoice
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={cancelMutation.isPending || !cancelReason.trim()}
              >
                {cancelMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Cancel E-Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Show submit button for new or invalid invoices
  return (
    <>
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={disabled || !canSubmit || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileCheckIcon className="size-4" />
            )}
            {status === "invalid" ? "Resubmit E-Invoice" : "Submit E-Invoice"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit to MyInvois</DialogTitle>
            <DialogDescription>
              This will submit the {documentType.replace("_", " ")} to Malaysia's
              MyInvois e-invoicing system. Once submitted, the document will be
              validated by LHDN.
            </DialogDescription>
          </DialogHeader>
          {validation && !validation.valid && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="font-medium text-destructive">Validation Errors:</p>
              <ul className="mt-2 list-disc pl-4 text-sm text-destructive">
                {validation.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || !validation?.valid}
            >
              {submitMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Submit to MyInvois
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
