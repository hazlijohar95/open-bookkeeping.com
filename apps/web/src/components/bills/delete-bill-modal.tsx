import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import type { Bill } from "@/types/common/bill";
import { useDeleteBill } from "@/api/bills";
import { toast } from "sonner";

interface DeleteBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
}

export function DeleteBillModal({
  isOpen,
  onClose,
  bill,
}: DeleteBillModalProps) {
  const deleteMutation = useDeleteBill();

  const handleDelete = () => {
    if (bill) {
      deleteMutation.mutate(bill.id, {
        onSuccess: () => {
          toast.success("Bill deleted successfully");
          onClose();
        },
        onError: (error) => {
          toast.error(error.message ?? "Failed to delete bill");
        },
      });
    }
  };

  return (
    <ConfirmDeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title="Delete Bill"
      entityName={bill?.billNumber}
      isLoading={deleteMutation.isPending}
    />
  );
}
