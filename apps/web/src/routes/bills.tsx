import { createBillColumns, billColumnConfig } from "@/components/table-columns/bills";
import { DeleteBillModal } from "@/components/bills/delete-bill-modal";
import { BillFormModal } from "@/components/bills/bill-form-modal";
import { DataTable } from "@/components/ui/data-table";
import { useBills, type Bill } from "@/api";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeletons";
import { useAuth } from "@/providers/auth-provider";
import { ReceiptIcon } from "@/assets/icons";
import { Plus } from "@/components/ui/icons";
import { useMemo, useState } from "react";

export function Bills() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: bills, isLoading } = useBills({
    enabled: !!user && !isAuthLoading,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const handleEdit = (bill: Bill) => {
    setSelectedBill(bill);
    setIsFormOpen(true);
  };

  const handleDelete = (bill: Bill) => {
    setSelectedBill(bill);
    setIsDeleteOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedBill(null);
  };

  const handleDeleteClose = () => {
    setIsDeleteOpen(false);
    setSelectedBill(null);
  };

  const columns = useMemo(
    () => createBillColumns({ onEdit: handleEdit, onDelete: handleDelete }),
    []
  );

  if (isLoading || isAuthLoading) {
    return <PageSkeleton title="Bills" description="Manage your bills and payables" />;
  }

  return (
    <PageContainer>
      <PageHeader
        icon={ReceiptIcon}
        title="Bills"
        description="Track and manage bills you owe to vendors"
        action={
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="size-4" />
            Add Bill
          </Button>
        }
      />

      {!bills?.length ? (
        <EmptyState
          icon={ReceiptIcon}
          title="No bills yet"
          description="Add your first bill to start tracking your accounts payable."
          action={
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              Add Bill
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={bills}
          columnConfig={billColumnConfig}
          isLoading={false}
          defaultSorting={[{ id: "createdAt", desc: true }]}
        />
      )}

      <BillFormModal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        bill={selectedBill}
      />
      <DeleteBillModal
        isOpen={isDeleteOpen}
        onClose={handleDeleteClose}
        bill={selectedBill}
      />
    </PageContainer>
  );
}
