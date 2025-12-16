/**
 * Delete Employee Modal
 * Confirmation dialog for deleting employees
 */

import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import type { Employee } from "@/api/payroll";
import { useDeleteEmployee } from "@/api/payroll";
import { toast } from "sonner";

interface DeleteEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

export function DeleteEmployeeModal({
  isOpen,
  onClose,
  employee,
}: DeleteEmployeeModalProps) {
  const deleteMutation = useDeleteEmployee();

  const handleDelete = () => {
    if (!employee) return;

    deleteMutation.mutate(
      { id: employee.id },
      {
        onSuccess: () => {
          toast.success("Employee deleted successfully");
          onClose();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  if (!employee) return null;

  const employeeName = `${employee.firstName} ${employee.lastName}`;

  return (
    <ConfirmDeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title="Delete Employee"
      description={
        <>
          Are you sure you want to delete{" "}
          <strong>
            {employeeName} ({employee.employeeCode})
          </strong>
          ? This action cannot be undone and will remove all associated payroll
          records.
        </>
      }
      isLoading={deleteMutation.isPending}
      confirmText="Delete Employee"
    />
  );
}
