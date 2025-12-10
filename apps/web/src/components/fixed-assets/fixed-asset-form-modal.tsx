import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContentContainer,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { FilePenIcon, WarehouseIcon } from "@/assets/icons";
import { FormInput } from "@/components/ui/form/form-input";
import { zodResolver } from "@/lib/utils";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form/form";
import { Button } from "@/components/ui/button";
import {
  useCreateFixedAsset,
  useUpdateFixedAsset,
  useFixedAssetCategories,
  useSearchAccounts,
  useVendors,
  type FixedAsset,
  type CreateFixedAssetInput,
  type DepreciationMethod,
} from "@/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";

const depreciationMethods: { value: DepreciationMethod; label: string }[] = [
  { value: "straight_line", label: "Straight Line" },
  { value: "declining_balance", label: "Declining Balance" },
  { value: "double_declining", label: "Double Declining" },
];

const createFixedAssetSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid().optional(),
  acquisitionDate: z.string().min(1, "Acquisition date is required"),
  acquisitionCost: z.string().min(1, "Acquisition cost is required"),
  vendorId: z.string().uuid().optional(),
  invoiceReference: z.string().max(100).optional(),
  depreciationMethod: z.enum(["straight_line", "declining_balance", "double_declining"]),
  usefulLifeMonths: z.coerce.number().int().min(1).max(600),
  salvageValue: z.string().optional(),
  depreciationStartDate: z.string().min(1, "Depreciation start date is required"),
  assetAccountId: z.string().uuid({ message: "Asset account is required" }),
  depreciationExpenseAccountId: z.string().uuid({ message: "Depreciation expense account is required" }),
  accumulatedDepreciationAccountId: z.string().uuid({ message: "Accumulated depreciation account is required" }),
  location: z.string().max(200).optional(),
  serialNumber: z.string().max(100).optional(),
  warrantyExpiry: z.string().optional(),
});

type FormData = z.infer<typeof createFixedAssetSchema>;

interface FixedAssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset?: FixedAsset | null;
}

function FixedAssetFormContent({ isOpen, onClose, asset }: FixedAssetFormModalProps) {
  const isEditing = !!asset;

  const { data: categories } = useFixedAssetCategories();
  const { data: accounts } = useSearchAccounts("");
  const { data: vendors } = useVendors();

  const createMutation = useCreateFixedAsset();
  const updateMutation = useUpdateFixedAsset();

  const today = new Date().toISOString().split("T")[0];

  const form = useForm<FormData>({
    resolver: zodResolver(createFixedAssetSchema),
    defaultValues: asset
      ? {
          name: asset.name,
          description: asset.description || "",
          categoryId: asset.categoryId || undefined,
          acquisitionDate: asset.acquisitionDate,
          acquisitionCost: asset.acquisitionCost,
          vendorId: asset.vendorId || undefined,
          invoiceReference: asset.invoiceReference || "",
          depreciationMethod: asset.depreciationMethod,
          usefulLifeMonths: asset.usefulLifeMonths,
          salvageValue: asset.salvageValue || "0",
          depreciationStartDate: asset.depreciationStartDate,
          assetAccountId: asset.assetAccountId,
          depreciationExpenseAccountId: asset.depreciationExpenseAccountId,
          accumulatedDepreciationAccountId: asset.accumulatedDepreciationAccountId,
          location: asset.location || "",
          serialNumber: asset.serialNumber || "",
          warrantyExpiry: asset.warrantyExpiry || "",
        }
      : {
          name: "",
          description: "",
          acquisitionDate: today,
          acquisitionCost: "",
          depreciationMethod: "straight_line",
          usefulLifeMonths: 60,
          salvageValue: "0",
          depreciationStartDate: today,
          assetAccountId: "",
          depreciationExpenseAccountId: "",
          accumulatedDepreciationAccountId: "",
          location: "",
          serialNumber: "",
        },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = (data: FormData) => {
    if (isEditing && asset) {
      // For editing, only send allowed fields
      updateMutation.mutate(
        {
          id: asset.id,
          name: data.name,
          description: data.description,
          location: data.location,
          serialNumber: data.serialNumber,
        },
        {
          onSuccess: () => {
            toast.success("Asset updated successfully");
            handleClose();
          },
          onError: (error) => {
            toast.error(error.message || "Failed to update asset");
          },
        }
      );
    } else {
      const input: CreateFixedAssetInput = {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        acquisitionDate: data.acquisitionDate,
        acquisitionCost: data.acquisitionCost,
        vendorId: data.vendorId,
        invoiceReference: data.invoiceReference,
        depreciationMethod: data.depreciationMethod,
        usefulLifeMonths: data.usefulLifeMonths,
        salvageValue: data.salvageValue || "0",
        depreciationStartDate: data.depreciationStartDate,
        assetAccountId: data.assetAccountId,
        depreciationExpenseAccountId: data.depreciationExpenseAccountId,
        accumulatedDepreciationAccountId: data.accumulatedDepreciationAccountId,
        location: data.location,
        serialNumber: data.serialNumber,
        warrantyExpiry: data.warrantyExpiry,
      };

      createMutation.mutate(input, {
        onSuccess: () => {
          toast.success("Asset created successfully");
          handleClose();
        },
        onError: (error) => {
          toast.error(error.message || "Failed to create asset");
        },
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Filter accounts by type
  const assetAccounts = accounts?.filter((a) => a.accountType === "asset") ?? [];
  const expenseAccounts = accounts?.filter((a) => a.accountType === "expense") ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeaderContainer>
              <DialogIcon>
                {isEditing ? <FilePenIcon /> : <WarehouseIcon />}
              </DialogIcon>
              <DialogHeader>
                <DialogTitle>{isEditing ? "Edit Asset" : "Add Fixed Asset"}</DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? "Update the asset details below."
                    : "Record a new fixed asset for your business."}
                </DialogDescription>
              </DialogHeader>
            </DialogHeaderContainer>
            <DialogContentContainer>
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Basic Information</h4>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormInput
                    label="Asset Name"
                    name="name"
                    placeholder="e.g. Dell Laptop"
                    reactform={form}
                  />

                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormInput
                  label="Description"
                  name="description"
                  placeholder="Brief description of the asset"
                  reactform={form}
                  isOptional
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormInput
                    label="Serial Number"
                    name="serialNumber"
                    placeholder="e.g. SN123456"
                    reactform={form}
                    isOptional
                  />
                  <FormInput
                    label="Location"
                    name="location"
                    placeholder="e.g. Office Building A"
                    reactform={form}
                    isOptional
                  />
                </div>
              </div>

              {/* Acquisition Details */}
              {!isEditing && (
                <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-medium">Acquisition Details</h4>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormInput
                      label="Acquisition Date"
                      name="acquisitionDate"
                      type="date"
                      reactform={form}
                    />
                    <FormInput
                      label="Acquisition Cost"
                      name="acquisitionCost"
                      type="number"
                      placeholder="0.00"
                      reactform={form}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="vendorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                            <SelectContent>
                              {vendors?.map((vendor) => (
                                <SelectItem key={vendor.id} value={vendor.id}>
                                  {vendor.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormInput
                      label="Invoice Reference"
                      name="invoiceReference"
                      placeholder="e.g. INV-001"
                      reactform={form}
                      isOptional
                    />
                  </div>
                </div>
              )}

              {/* Depreciation Settings */}
              {!isEditing && (
                <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-medium">Depreciation Settings</h4>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="depreciationMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Depreciation Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                              {depreciationMethods.map((method) => (
                                <SelectItem key={method.value} value={method.value}>
                                  {method.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormInput
                      label="Useful Life (months)"
                      name="usefulLifeMonths"
                      type="number"
                      placeholder="60"
                      reactform={form}
                      description="e.g. 60 for 5 years"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormInput
                      label="Salvage Value"
                      name="salvageValue"
                      type="number"
                      placeholder="0.00"
                      reactform={form}
                      description="Estimated value at end of life"
                    />
                    <FormInput
                      label="Depreciation Start Date"
                      name="depreciationStartDate"
                      type="date"
                      reactform={form}
                    />
                  </div>
                </div>
              )}

              {/* Account Links */}
              {!isEditing && (
                <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-medium">Account Links</h4>

                  <FormField
                    control={form.control}
                    name="assetAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Asset Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select asset account" />
                          </SelectTrigger>
                          <SelectContent>
                            {assetAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="depreciationExpenseAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depreciation Expense Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select expense account" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accumulatedDepreciationAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accumulated Depreciation Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select contra asset account" />
                          </SelectTrigger>
                          <SelectContent>
                            {assetAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Warranty */}
              {!isEditing && (
                <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-medium">Additional Information</h4>
                  <FormInput
                    label="Warranty Expiry"
                    name="warrantyExpiry"
                    type="date"
                    reactform={form}
                    isOptional
                  />
                </div>
              )}
            </DialogContentContainer>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Add Asset"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function FixedAssetFormModal({ isOpen, onClose, asset }: FixedAssetFormModalProps) {
  return (
    <FixedAssetFormContent
      key={asset?.id ?? "new"}
      isOpen={isOpen}
      onClose={onClose}
      asset={asset}
    />
  );
}
