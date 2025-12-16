import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import type { Vendor } from "@/types/common/vendor";
import { useDeleteVendor } from "@/api";
import { toast } from "sonner";

interface DeleteVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
}

export function DeleteVendorModal({
  isOpen,
  onClose,
  vendor,
}: DeleteVendorModalProps) {
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
    <ConfirmDeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title="Delete Vendor"
      entityName={vendor?.name}
      isLoading={deleteMutation.isPending}
    />
  );
}
