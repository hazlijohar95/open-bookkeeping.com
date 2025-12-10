import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogContentContainer,
  DialogHeaderContainer,
  DialogIcon,
  DialogClose,
} from "@/components/ui/dialog";
import type { InvoiceTypeType, InvoiceStatusType } from "@/types/common/invoice";
import { useMutation } from "@tanstack/react-query";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FilePenIcon } from "@/assets/icons";
import { useUpdateInvoiceStatus } from "@/api";
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UpdateStatusModalProps {
  type: InvoiceTypeType;
  invoiceId: string;
  currentStatus: InvoiceStatusType;
}

const STATUS_OPTIONS: { value: InvoiceStatusType; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "success", label: "Paid" },
  { value: "error", label: "Failed" },
  { value: "expired", label: "Expired" },
  { value: "refunded", label: "Refunded" },
];

const UpdateStatusModal = ({ invoiceId, type, currentStatus }: UpdateStatusModalProps) => {
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatusType>(currentStatus);

  const updateServerInvoiceMutation = useUpdateInvoiceStatus();

  const updateIDBInvoiceMutation = useMutation({
    mutationFn: async () => {
      // For local invoices, we'd update IndexedDB here
      // This is a placeholder - implement as needed
      throw new Error("Local invoice status update not implemented");
    },
    onError: (error) => {
      toast.error("Failed to update status!", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const onSubmit = async () => {
    if (type === "server") {
      updateServerInvoiceMutation.mutate(
        { id: invoiceId, status: selectedStatus },
        {
          onSuccess: () => {
            toast.success("Invoice status updated!", {
              description: "The invoice status has been updated.",
            });
            setOpen(false);
          },
          onError: (error) => {
            toast.error("Failed to update status!", {
              description: error.message,
            });
          },
        }
      );
    } else {
      await updateIDBInvoiceMutation.mutateAsync();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <FilePenIcon />
          <span>Update Status</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeaderContainer>
          <DialogIcon>
            <FilePenIcon />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Update Invoice Status</DialogTitle>
            <DialogDescription>Change the status of this invoice.</DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogContentContainer>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as InvoiceStatusType)}>
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
          </div>
        </DialogContentContainer>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={updateServerInvoiceMutation.isPending || updateIDBInvoiceMutation.isPending}
          >
            {(updateServerInvoiceMutation.isPending || updateIDBInvoiceMutation.isPending) ? "Updating..." : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateStatusModal;
