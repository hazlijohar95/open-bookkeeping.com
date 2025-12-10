import { useState } from "react";
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
import { TrashIcon } from "@/assets/icons";
import { Trash2 } from "@/components/ui/icons";
import { useDeleteQuotation } from "@/api/quotations";
import { toast } from "sonner";
import { QuotationTypeType } from "@/types/common/quotation";

interface DeleteQuotationModalProps {
  quotationId: string;
  type: QuotationTypeType;
}

export default function DeleteQuotationModal({ quotationId, type }: DeleteQuotationModalProps) {
  const [open, setOpen] = useState(false);

  const deleteMutation = useDeleteQuotation();

  const handleDelete = () => {
    if (type === "local") {
      toast.error("Local quotations cannot be deleted from here");
      return;
    }
    deleteMutation.mutate(quotationId, {
      onSuccess: () => {
        toast.success("Quotation deleted successfully");
        setOpen(false);
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => e.preventDefault()}
        >
          <Trash2 className="size-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeaderContainer>
          <DialogIcon>
            <TrashIcon />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Delete Quotation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this quotation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={deleteMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
