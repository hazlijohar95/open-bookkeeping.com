import {
  Dialog,
  DialogContent,
  DialogContentContainer,
  DialogDescription,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
} from "@/components/ui/dialog";
import { WarehouseIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  useDepreciationSchedule,
  useRunDepreciation,
  type FixedAsset,
  type FixedAssetStatus,
} from "@/api";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Play, Ban, AlertCircle, CheckCircle2 } from "@/components/ui/icons";

interface FixedAssetDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: FixedAsset | null;
}

const statusVariants: Record<FixedAssetStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  active: "default",
  fully_depreciated: "outline",
  disposed: "destructive",
};

const statusLabels: Record<FixedAssetStatus, string> = {
  draft: "Draft",
  active: "Active",
  fully_depreciated: "Fully Depreciated",
  disposed: "Disposed",
};

export function FixedAssetDetailModal({
  isOpen,
  onClose,
  asset,
}: FixedAssetDetailModalProps) {
  const { data: schedule, isLoading: isScheduleLoading } = useDepreciationSchedule(
    asset?.id ?? ""
  );
  const runDepreciation = useRunDepreciation();

  if (!asset) return null;

  const handleRunDepreciation = async (depreciationId: string) => {
    try {
      await runDepreciation.mutateAsync(depreciationId);
      toast.success("Depreciation posted successfully");
    } catch {
      toast.error("Failed to post depreciation");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeaderContainer>
          <DialogIcon>
            <WarehouseIcon />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {asset.name}
              <Badge variant={statusVariants[asset.status]}>
                {statusLabels[asset.status]}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {asset.assetCode} | Acquired {new Date(asset.acquisitionDate).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>

        <DialogContentContainer>
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="depreciation">
                Depreciation Schedule ({schedule?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-6">
              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Acquisition Cost</div>
                  <div className="text-xl font-semibold">
                    {formatCurrency(parseFloat(asset.acquisitionCost))}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Accumulated Depreciation</div>
                  <div className="text-xl font-semibold">
                    {formatCurrency(parseFloat(asset.accumulatedDepreciation))}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground">Net Book Value</div>
                  <div className="text-xl font-semibold">
                    {formatCurrency(parseFloat(asset.netBookValue))}
                  </div>
                </div>
              </div>

              {/* Asset Details */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Asset Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category:</span>{" "}
                    {asset.category?.name ?? "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vendor:</span>{" "}
                    {asset.vendor?.name ?? "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Serial Number:</span>{" "}
                    {asset.serialNumber || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span>{" "}
                    {asset.location || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Invoice Reference:</span>{" "}
                    {asset.invoiceReference || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Warranty Expiry:</span>{" "}
                    {asset.warrantyExpiry
                      ? new Date(asset.warrantyExpiry).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>
              </div>

              {/* Depreciation Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Depreciation Settings</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Method:</span>{" "}
                    {asset.depreciationMethod.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Useful Life:</span>{" "}
                    {asset.usefulLifeMonths} months ({(asset.usefulLifeMonths / 12).toFixed(1)} years)
                  </div>
                  <div>
                    <span className="text-muted-foreground">Salvage Value:</span>{" "}
                    {formatCurrency(parseFloat(asset.salvageValue))}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Start Date:</span>{" "}
                    {new Date(asset.depreciationStartDate).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Depreciation:</span>{" "}
                    {asset.lastDepreciationDate
                      ? new Date(asset.lastDepreciationDate).toLocaleDateString()
                      : "Not yet depreciated"}
                  </div>
                </div>
              </div>

              {/* Description */}
              {asset.description && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Description</h4>
                  <p className="text-sm text-muted-foreground">{asset.description}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="depreciation" className="mt-4">
              {isScheduleLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading depreciation schedule...
                </div>
              ) : !schedule?.length ? (
                <div className="py-8 text-center text-muted-foreground">
                  {asset.status === "draft"
                    ? "Activate the asset to generate depreciation schedule."
                    : "No depreciation schedule available."}
                </div>
              ) : (
                <div className="space-y-2">
                  {schedule.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                          {item.status === "posted" ? (
                            <CheckCircle2 className="size-5 text-green-600" />
                          ) : item.status === "skipped" ? (
                            <Ban className="size-5 text-muted-foreground" />
                          ) : (
                            <AlertCircle className="size-5 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">Year {item.year}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(item.periodStart).toLocaleDateString()} -{" "}
                            {new Date(item.periodEnd).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="font-medium">
                            {formatCurrency(parseFloat(item.depreciationAmount))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            NBV: {formatCurrency(parseFloat(item.netBookValue))}
                          </div>
                        </div>

                        <div className="w-24">
                          {item.status === "scheduled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRunDepreciation(item.id)}
                              disabled={runDepreciation.isPending}
                            >
                              <Play className="size-3 mr-1" />
                              Post
                            </Button>
                          )}
                          {item.status === "posted" && (
                            <Badge variant="default">Posted</Badge>
                          )}
                          {item.status === "skipped" && (
                            <Badge variant="secondary">Skipped</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContentContainer>
      </DialogContent>
    </Dialog>
  );
}
