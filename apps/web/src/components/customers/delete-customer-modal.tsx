import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import type { Customer } from "@/types/common/customer";
import { useDeleteCustomer } from "@/api";
import { toast } from "sonner";

interface DeleteCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

export function DeleteCustomerModal({
  isOpen,
  onClose,
  customer,
}: DeleteCustomerModalProps) {
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
    <ConfirmDeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title="Delete Customer"
      entityName={customer?.name}
      isLoading={deleteMutation.isPending}
    />
  );
}
