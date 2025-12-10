import { useState } from "react";
import { RefreshCw } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContentContainer,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileRefreshIcon } from "@/assets/icons";
import { useUpdateQuotationStatus } from "@/api/quotations";
import { toast } from "sonner";
import { QuotationStatusType, QuotationTypeType } from "@/types/common/quotation";

interface UpdateStatusModalProps {
  quotationId: string;
  type: QuotationTypeType;
  currentStatus: QuotationStatusType;
}

const STATUS_OPTIONS: { value: QuotationStatusType; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

export default function UpdateStatusModal({
  quotationId,
  type,
  currentStatus,
}: UpdateStatusModalProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<QuotationStatusType>(currentStatus);

  const updateMutation = useUpdateQuotationStatus();

  const handleUpdate = () => {
    if (type === "local") {
      toast.error("Local quotations cannot be updated from here");
      return;
    }
    if (status === "converted") {
      toast.error("Cannot manually set status to converted. Use 'Convert to Invoice' instead.");
      return;
    }
    updateMutation.mutate({ id: quotationId, status }, {
      onSuccess: () => {
        toast.success("Status updated successfully");
        setOpen(false);
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });
  };

  // Don't show for converted quotations
  if (currentStatus === "converted") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <RefreshCw className="size-4" />
          <span>Update Status</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeaderContainer>
          <DialogIcon>
            <FileRefreshIcon />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Update Quotation Status</DialogTitle>
            <DialogDescription>
              Change the status of this quotation.
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogContentContainer>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as QuotationStatusType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DialogContentContainer>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={updateMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleUpdate}
            disabled={updateMutation.isPending || status === currentStatus}
          >
            {updateMutation.isPending ? "Updating..." : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
