/**
 * Delete Employee Modal
 * Confirmation dialog for deleting employees
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Employee } from "@/api/payroll";
import { useDeleteEmployee } from "@/api/payroll";
import { toast } from "sonner";

interface DeleteEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

export function DeleteEmployeeModal({ isOpen, onClose, employee }: DeleteEmployeeModalProps) {
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

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Employee</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">
              {employee.firstName} {employee.lastName}
            </span>{" "}
            ({employee.employeeCode})? This action cannot be undone and will remove all associated
            payroll records.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Employee"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
