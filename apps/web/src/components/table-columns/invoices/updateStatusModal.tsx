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
import type {
  InvoiceTypeType,
  InvoiceStatusV2Type,
} from "@/types/common/invoice";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { updateInvoiceStatus as updateLocalInvoiceStatus } from "@/lib/indexdb-queries/invoice";
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
  currentStatus: InvoiceStatusV2Type;
}

const STATUS_OPTIONS: { value: InvoiceStatusV2Type; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
  { value: "uncollectible", label: "Uncollectible" },
  { value: "refunded", label: "Refunded" },
];

const UpdateStatusModal = ({
  invoiceId,
  type,
  currentStatus,
}: UpdateStatusModalProps) => {
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<InvoiceStatusV2Type>(currentStatus);
  const queryClient = useQueryClient();

  const updateServerInvoiceMutation = useUpdateInvoiceStatus();

  const updateIDBInvoiceMutation = useMutation({
    mutationFn: async () => {
      await updateLocalInvoiceStatus(invoiceId, selectedStatus);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["idb-invoices"] });
      toast.success("Invoice status updated!", {
        description: "The invoice status has been updated.",
      });
      setOpen(false);
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
      // Local invoice - use IndexedDB
      updateIDBInvoiceMutation.mutate();
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
            <DialogDescription>
              Change the status of this invoice.
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogContentContainer>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select
              value={selectedStatus}
              onValueChange={(v) => setSelectedStatus(v as InvoiceStatusV2Type)}
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
          </div>
        </DialogContentContainer>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={
              updateServerInvoiceMutation.isPending ||
              updateIDBInvoiceMutation.isPending
            }
          >
            {updateServerInvoiceMutation.isPending ||
            updateIDBInvoiceMutation.isPending
              ? "Updating..."
              : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateStatusModal;
