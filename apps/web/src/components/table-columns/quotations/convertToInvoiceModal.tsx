import { useState } from "react";
import { ArrowRightLeft } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SyncIcon, CircleCheckIcon, FileFeatherIcon } from "@/assets/icons";
import { useConvertToInvoice } from "@/api/quotations";
import { toast } from "sonner";
import { QuotationStatusType, QuotationTypeType } from "@/types/common/quotation";
import { useNavigate } from "react-router-dom";

interface ConvertToInvoiceModalProps {
  quotationId: string;
  type: QuotationTypeType;
  currentStatus: QuotationStatusType;
}

export default function ConvertToInvoiceModal({
  quotationId,
  type,
  currentStatus,
}: ConvertToInvoiceModalProps) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const navigate = useNavigate();

  const convertMutation = useConvertToInvoice();

  const handleConvert = () => {
    if (type === "local") {
      toast.error("Local quotations cannot be converted from here");
      return;
    }
    convertMutation.mutate({ quotationId }, {
      onSuccess: (data) => {
        setSuccess(true);
        setInvoiceId(data.invoice.id);
        toast.success("Quotation converted to invoice successfully");
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });
  };

  const handleViewInvoice = () => {
    if (invoiceId) {
      setOpen(false);
      navigate(`/edit/server/${invoiceId}`);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSuccess(false);
    setInvoiceId(null);
  };

  // Don't show for already converted quotations
  if (currentStatus === "converted") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          className="text-primary"
          onSelect={(e) => e.preventDefault()}
        >
          <ArrowRightLeft className="size-4" />
          <span>Convert to Invoice</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        {!success ? (
          <>
            <DialogHeaderContainer>
              <DialogIcon>
                <SyncIcon />
              </DialogIcon>
              <DialogHeader>
                <DialogTitle>Convert to Invoice</DialogTitle>
                <DialogDescription>
                  This will create a new invoice from this quotation. The quotation status will be
                  changed to "Converted" and cannot be modified after this action.
                </DialogDescription>
              </DialogHeader>
            </DialogHeaderContainer>
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <FileFeatherIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <SyncIcon className="h-5 w-5 text-primary" />
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <FileFeatherIcon className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={convertMutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={handleConvert}
                disabled={convertMutation.isPending}
              >
                {convertMutation.isPending ? "Converting..." : "Convert"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeaderContainer>
              <DialogIcon>
                <CircleCheckIcon />
              </DialogIcon>
              <DialogHeader>
                <DialogTitle>Conversion Successful</DialogTitle>
                <DialogDescription>
                  Your quotation has been successfully converted to an invoice.
                </DialogDescription>
              </DialogHeader>
            </DialogHeaderContainer>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
              <Button onClick={handleViewInvoice}>
                View Invoice
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
