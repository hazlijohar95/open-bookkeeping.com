/**
 * Delete Payroll Run Confirmation Modal
 */

import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import type { PayrollRun } from "@/api/payroll";
import { useDeletePayrollRun } from "@/api/payroll";
import { toast } from "sonner";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface DeletePayrollRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollRun: PayrollRun | null;
}

export function DeletePayrollRunModal({
  isOpen,
  onClose,
  payrollRun,
}: DeletePayrollRunModalProps) {
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
    <ConfirmDeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title="Delete Payroll Run"
      description={
        <>
          Are you sure you want to delete the payroll run for{" "}
          <strong>
            {periodLabel} ({payrollRun.runNumber})
          </strong>
          ?
          <br />
          <br />
          This action cannot be undone. All associated pay slips will also be
          deleted.
        </>
      }
      isLoading={deleteMutation.isPending}
    />
  );
}
