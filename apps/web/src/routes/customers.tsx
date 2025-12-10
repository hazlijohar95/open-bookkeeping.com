import { createCustomerColumns, customerColumnConfig } from "@/components/table-columns/customers";
import { DeleteCustomerModal } from "@/components/customers/delete-customer-modal";
import { CustomerFormModal } from "@/components/customers/customer-form-modal";
import { CustomerDetailModal } from "@/components/customers/customer-detail-modal";
import { DataTable } from "@/components/ui/data-table";
import { Customer } from "@/types/common/customer";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomers } from "@/api";
import { useAuth } from "@/providers/auth-provider";
import { UsersIcon } from "@/assets/icons";
import { Plus } from "@/components/ui/icons";
import { useMemo, useState } from "react";

export function Customers() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: customers, isLoading } = useCustomers({
    enabled: !!user && !isAuthLoading,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const showSkeleton = isLoading || isAuthLoading;

  const handleView = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsFormOpen(true);
  };

  const handleDelete = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedCustomer(null);
  };

  const handleDeleteClose = () => {
    setIsDeleteOpen(false);
    setSelectedCustomer(null);
  };

  const handleDetailClose = () => {
    setIsDetailOpen(false);
    setSelectedCustomer(null);
  };

  const columns = useMemo(
    () => createCustomerColumns({ onEdit: handleEdit, onDelete: handleDelete, onView: handleView }),
    []
  );

  return (
    <PageContainer>
      <PageHeader
        icon={UsersIcon}
        title="Customers"
        description="Manage your customers and their information"
        action={
          showSkeleton ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              Add Customer
            </Button>
          )
        }
      />

      {showSkeleton ? (
        <DataTable
          columns={columns}
          data={[]}
          columnConfig={customerColumnConfig}
          isLoading={true}
          defaultSorting={[{ id: "createdAt", desc: true }]}
        />
      ) : !customers?.length ? (
        <EmptyState
          icon={UsersIcon}
          title="No customers yet"
          description="Add your first customer to start managing your client relationships."
          action={
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              Add Customer
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={customers}
          columnConfig={customerColumnConfig}
          isLoading={false}
          defaultSorting={[{ id: "createdAt", desc: true }]}
        />
      )}

      <CustomerFormModal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        customer={selectedCustomer}
      />
      <DeleteCustomerModal
        isOpen={isDeleteOpen}
        onClose={handleDeleteClose}
        customer={selectedCustomer}
      />
      <CustomerDetailModal
        isOpen={isDetailOpen}
        onClose={handleDetailClose}
        customer={selectedCustomer}
      />
    </PageContainer>
  );
}
