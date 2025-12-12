import { createVendorColumns, vendorColumnConfig } from "@/components/table-columns/vendors";
import { DeleteVendorModal } from "@/components/vendors/delete-vendor-modal";
import { VendorFormModal } from "@/components/vendors/vendor-form-modal";
import { VendorDetailModal } from "@/components/vendors/vendor-detail-modal";
import { DataTable } from "@/components/ui/data-table";
import type { Vendor } from "@/types/common/vendor";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeletons";
import { useVendors } from "@/api";
import { useAuth } from "@/providers/auth-provider";
import { TruckIcon } from "@/assets/icons";
import { Plus } from "@/components/ui/icons";
import { useMemo, useState } from "react";

export function Vendors() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: vendors, isLoading } = useVendors({
    enabled: !!user && !isAuthLoading,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const handleView = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDetailOpen(true);
  };

  const handleEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsFormOpen(true);
  };

  const handleDelete = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsDeleteOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedVendor(null);
  };

  const handleDeleteClose = () => {
    setIsDeleteOpen(false);
    setSelectedVendor(null);
  };

  const handleDetailClose = () => {
    setIsDetailOpen(false);
    setSelectedVendor(null);
  };

  const columns = useMemo(
    () => createVendorColumns({ onEdit: handleEdit, onDelete: handleDelete, onView: handleView }),
    []
  );

  if (isLoading || isAuthLoading) {
    return <PageSkeleton title="Vendors" description="Manage your vendors and suppliers" />;
  }

  return (
    <PageContainer>
      <PageHeader
        icon={TruckIcon}
        title="Vendors"
        description="Manage your vendors and suppliers"
        action={
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="size-4" />
            Add Vendor
          </Button>
        }
      />

      {!vendors?.length ? (
        <EmptyState
          icon={TruckIcon}
          title="No vendors yet"
          description="Add your first vendor to start managing your supplier relationships."
          action={
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4" />
              Add Vendor
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={vendors}
          columnConfig={vendorColumnConfig}
          isLoading={false}
          defaultSorting={[{ id: "createdAt", desc: true }]}
        />
      )}

      <VendorFormModal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        vendor={selectedVendor}
      />
      <DeleteVendorModal
        isOpen={isDeleteOpen}
        onClose={handleDeleteClose}
        vendor={selectedVendor}
      />
      <VendorDetailModal
        isOpen={isDetailOpen}
        onClose={handleDetailClose}
        vendor={selectedVendor}
      />
    </PageContainer>
  );
}
