/**
 * Delete Payroll Run Confirmation Modal
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
import { Loader2Icon } from "@/components/ui/icons";
import type { PayrollRun } from "@/api/payroll";
import { useDeletePayrollRun } from "@/api/payroll";
import { toast } from "sonner";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface DeletePayrollRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollRun: PayrollRun | null;
}

export function DeletePayrollRunModal({ isOpen, onClose, payrollRun }: DeletePayrollRunModalProps) {
  const deleteMutation = useDeletePayrollRun();

  const handleDelete = async () => {
    if (!payrollRun) return;

    try {
      await deleteMutation.mutateAsync({ id: payrollRun.id });
      toast.success("Payroll run deleted successfully");
      onClose();
    } catch {
      toast.error("Failed to delete payroll run");
    }
  };

  if (!payrollRun) return null;

  const periodLabel = `${monthNames[payrollRun.periodMonth - 1]} ${payrollRun.periodYear}`;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Payroll Run</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the payroll run for{" "}
            <strong>{periodLabel}</strong> ({payrollRun.runNumber})?
            <br />
            <br />
            This action cannot be undone. All associated pay slips will also be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
