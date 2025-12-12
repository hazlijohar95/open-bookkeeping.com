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
import type { Customer } from "@/types/common/customer";
import { TrashIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { useDeleteCustomer } from "@/api";
import { toast } from "sonner";

interface DeleteCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

export function DeleteCustomerModal({ isOpen, onClose, customer }: DeleteCustomerModalProps) {
  const deleteMutation = useDeleteCustomer();

  const handleDelete = () => {
    if (customer) {
      deleteMutation.mutate(customer.id, {
        onSuccess: () => {
          toast.success("Customer deleted successfully");
          onClose();
        },
        onError: (error) => {
          toast.error(error.message);
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
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{customer?.name}</strong>? This action cannot
              be undone.
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
