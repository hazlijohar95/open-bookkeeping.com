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
import { Vendor } from "@/types/common/vendor";
import { TrashIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { useDeleteVendor } from "@/api";
import { toast } from "sonner";

interface DeleteVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
}

export function DeleteVendorModal({ isOpen, onClose, vendor }: DeleteVendorModalProps) {
  const deleteMutation = useDeleteVendor();

  const handleDelete = () => {
    if (vendor) {
      deleteMutation.mutate(vendor.id, {
        onSuccess: () => {
          toast.success("Vendor deleted successfully");
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
            <DialogTitle>Delete Vendor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{vendor?.name}</strong>? This action cannot
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
