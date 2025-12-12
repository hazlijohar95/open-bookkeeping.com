import { useState, useMemo } from "react";
import { Plus } from "@/components/ui/icons";
import {
  useFixedAssets,
  useFixedAssetSummary,
  useDeleteFixedAsset,
  useActivateFixedAsset,
  type FixedAsset,
  type FixedAssetStatus,
} from "@/api";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeletons";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/providers/auth-provider";
import { WarehouseIcon } from "@/assets/icons";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { FixedAssetFormModal } from "@/components/fixed-assets/fixed-asset-form-modal";
import { FixedAssetDetailModal } from "@/components/fixed-assets/fixed-asset-detail-modal";
import { ConfirmDeleteModal } from "@/components/ui/confirm-delete-modal";
import {
  createFixedAssetColumns,
  fixedAssetColumnConfig,
} from "@/components/table-columns/fixed-assets";

export function FixedAssets() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | FixedAssetStatus>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);

  const { data: assetsData, isLoading: isAssetsLoading } = useFixedAssets({
    enabled: !!user && !isAuthLoading,
    status: activeTab === "all" ? undefined : activeTab,
  });

  const { data: summary, isLoading: isSummaryLoading } = useFixedAssetSummary();
  const deleteAsset = useDeleteFixedAsset();
  const activateAsset = useActivateFixedAsset();

  const handleCreate = () => {
    setSelectedAsset(null);
    setIsFormOpen(true);
  };

  const handleEdit = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setIsFormOpen(true);
  };

  const handleView = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setIsDetailOpen(true);
  };

  const handleDelete = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setIsDeleteOpen(true);
  };

  const handleActivate = async (asset: FixedAsset) => {
    try {
      await activateAsset.mutateAsync(asset.id);
      toast.success("Asset activated and depreciation schedule created");
    } catch {
      toast.error("Failed to activate asset");
    }
  };

  const confirmDelete = async () => {
    if (!selectedAsset) return;
    try {
      await deleteAsset.mutateAsync(selectedAsset.id);
      toast.success("Asset deleted");
      setIsDeleteOpen(false);
      setSelectedAsset(null);
    } catch {
      toast.error("Failed to delete asset. Only draft assets can be deleted.");
    }
  };

  const columns = useMemo(
    () =>
      createFixedAssetColumns({
        onView: handleView,
        onEdit: handleEdit,
        onActivate: handleActivate,
        onDelete: handleDelete,
      }),
    []
  );

  const isLoading = isAssetsLoading || isAuthLoading;

  if (isLoading) {
    return (
      <PageSkeleton
        title="Fixed Assets"
        description="Manage your capital assets and depreciation"
      />
    );
  }

  const assets = assetsData?.assets ?? [];

  return (
    <PageContainer>
      <PageHeader
        icon={WarehouseIcon}
        title="Fixed Assets"
        description="Manage your capital assets and track depreciation"
        action={
          <Button onClick={handleCreate}>
            <Plus className="size-4" />
            Add Asset
          </Button>
        }
      />

      {/* Summary Cards */}
      {!isSummaryLoading && summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalAssets}</div>
              <p className="text-xs text-muted-foreground">
                {summary.byStatus.active} active, {summary.byStatus.draft} draft
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(parseFloat(summary.totalCost ?? "0"))}
              </div>
              <p className="text-xs text-muted-foreground">Original acquisition cost</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Accumulated Depreciation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(parseFloat(summary.totalAccumulatedDepreciation ?? "0"))}
              </div>
              <p className="text-xs text-muted-foreground">Total depreciation to date</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Book Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(parseFloat(summary.totalNetBookValue ?? "0"))}
              </div>
              <p className="text-xs text-muted-foreground">Current carrying value</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs and Table */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="all">
            All ({summary?.totalAssets ?? 0})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({summary?.byStatus.active ?? 0})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft ({summary?.byStatus.draft ?? 0})
          </TabsTrigger>
          <TabsTrigger value="fully_depreciated">
            Depreciated ({summary?.byStatus.fullyDepreciated ?? 0})
          </TabsTrigger>
          <TabsTrigger value="disposed">
            Disposed ({summary?.byStatus.disposed ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {!assets.length ? (
            <EmptyState
              icon={WarehouseIcon}
              title="No fixed assets yet"
              description="Add your first fixed asset to start tracking depreciation."
              action={
                <Button onClick={handleCreate}>
                  <Plus className="size-4" />
                  Add Asset
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={assets}
              columnConfig={fixedAssetColumnConfig}
              isLoading={false}
              defaultSorting={[{ id: "acquisitionDate", desc: true }]}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <FixedAssetFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedAsset(null);
        }}
        asset={selectedAsset}
      />

      <FixedAssetDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedAsset(null);
        }}
        asset={selectedAsset}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setSelectedAsset(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Asset"
        description={`Are you sure you want to delete "${selectedAsset?.name}"? This action cannot be undone.`}
        isLoading={deleteAsset.isPending}
      />
    </PageContainer>
  );
}
