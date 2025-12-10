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
} from "@/components/ui/dialog";
import { Bill } from "@/types/common/bill";
import { TrashIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { useDeleteBill } from "@/api/bills";
import { toast } from "sonner";

interface DeleteBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
}

export function DeleteBillModal({ isOpen, onClose, bill }: DeleteBillModalProps) {
  const deleteMutation = useDeleteBill();

  const handleDelete = () => {
    if (bill) {
      deleteMutation.mutate(bill.id, {
        onSuccess: () => {
          toast.success("Bill deleted successfully");
          onClose();
        },
        onError: (error) => {
          toast.error(error.message || "Failed to delete bill");
        },
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeaderContainer>
          <DialogIcon>
            <TrashIcon />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Delete Bill</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete bill <strong>{bill?.billNumber}</strong>? This action
              cannot be undone.
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
