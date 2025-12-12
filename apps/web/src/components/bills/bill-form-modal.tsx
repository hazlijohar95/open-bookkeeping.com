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
import type { CreateBillSchema } from "@/zod-schemas/bill";
import { createBillSchema } from "@/zod-schemas/bill";
import { useFieldArray, useForm } from "react-hook-form";
import { FilePenIcon, TrashIcon, ReceiptIcon } from "@/assets/icons";
import { FormInput } from "@/components/ui/form/form-input";
import { zodResolver } from "@/lib/utils";
import { Form } from "@/components/ui/form/form";
import type { Bill } from "@/types/common/bill";
import { Button } from "@/components/ui/button";
import { useCreateBill, useUpdateBill } from "@/api/bills";
import { useVendors } from "@/api/vendors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form/form";
import { Label } from "@/components/ui/label";
import { Plus, FileTextIcon, Package } from "@/components/ui/icons";
import { toast } from "sonner";
import Decimal from "decimal.js";

interface BillFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill?: Bill | null;
}

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const emptyDefaults: CreateBillSchema = {
  vendorId: null,
  billNumber: "",
  description: "",
  currency: "MYR",
  billDate: new Date(),
  dueDate: null,
  status: "pending",
  notes: "",
  attachmentUrl: "",
  items: [{ description: "", quantity: "1", unitPrice: "0" }],
};

function BillFormContent({ isOpen, onClose, bill }: BillFormModalProps) {
  const isEditing = !!bill;

  const { data: vendors } = useVendors();

  const form = useForm<CreateBillSchema>({
    resolver: zodResolver(createBillSchema),
    defaultValues: bill
      ? {
          vendorId: bill.vendorId,
          billNumber: bill.billNumber,
          description: bill.description ?? "",
          currency: bill.currency,
          billDate: new Date(bill.billDate),
          dueDate: bill.dueDate ? new Date(bill.dueDate) : null,
          status: bill.status,
          notes: bill.notes ?? "",
          attachmentUrl: bill.attachmentUrl ?? "",
          items: bill.items?.length
            ? bill.items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              }))
            : [{ description: "", quantity: "1", unitPrice: "0" }],
        }
      : emptyDefaults,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const createMutation = useCreateBill();
  const updateMutation = useUpdateBill();

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = (data: CreateBillSchema) => {
    const formattedData = {
      ...data,
      billDate: data.billDate.toISOString(),
      dueDate: data.dueDate ? data.dueDate.toISOString() : null,
    };

    if (isEditing && bill) {
      updateMutation.mutate(
        {
          id: bill.id,
          ...formattedData,
        },
        {
          onSuccess: () => {
            toast.success("Bill updated successfully");
            handleClose();
          },
          onError: (error) => {
            toast.error(error.message ?? "Failed to update bill");
          },
        }
      );
    } else {
      createMutation.mutate(formattedData, {
        onSuccess: () => {
          toast.success("Bill created successfully");
          handleClose();
        },
        onError: (error) => {
          toast.error(error.message ?? "Failed to create bill");
        },
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // Calculate total
  const watchedItems = form.watch("items");
  const total = watchedItems.reduce((sum, item) => {
    const qty = new Decimal(item.quantity ?? "0");
    const price = new Decimal(item.unitPrice ?? "0");
    return sum.plus(qty.times(price));
  }, new Decimal(0));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeaderContainer>
              <DialogIcon>
                {isEditing ? <FilePenIcon /> : <ReceiptIcon />}
              </DialogIcon>
              <DialogHeader>
                <DialogTitle>{isEditing ? "Edit Bill" : "Add Bill"}</DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? "Update the bill details below."
                    : "Record a bill you owe to a vendor."}
                </DialogDescription>
              </DialogHeader>
            </DialogHeaderContainer>
            <DialogContentContainer>
              {/* Bill Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileTextIcon className="size-4" />
                  <span>Bill Details</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormInput
                    label="Bill Number"
                    name="billNumber"
                    placeholder="e.g. BILL-001"
                    reactform={form}
                    description="Vendor's invoice/bill number"
                  />

                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value ?? undefined}
                        >
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
                </div>

                <FormInput
                  label="Description"
                  name="description"
                  placeholder="e.g. Office supplies for Q4"
                  reactform={form}
                  isOptional
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormInput
                    label="Bill Date"
                    name="billDate"
                    type="date"
                    reactform={form}
                  />

                  <FormInput
                    label="Due Date"
                    name="dueDate"
                    type="date"
                    reactform={form}
                    isOptional
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormInput
                    label="Currency"
                    name="currency"
                    placeholder="MYR"
                    reactform={form}
                    description="3-letter currency code"
                  />

                  <FormInput
                    label="Attachment URL"
                    name="attachmentUrl"
                    placeholder="https://..."
                    reactform={form}
                    isOptional
                    description="Link to bill document"
                  />
                </div>

                <FormInput
                  label="Notes"
                  name="notes"
                  placeholder="Additional notes..."
                  reactform={form}
                  isOptional
                />
              </div>

              {/* Line Items */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="size-4" />
                    <span>Line Items</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ description: "", quantity: "1", unitPrice: "0" })}
                  >
                    <Plus className="size-4" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="rounded-lg border bg-muted/30 p-3 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Label className="text-xs text-muted-foreground">
                          Item {index + 1}
                        </Label>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => remove(index)}
                          >
                            <TrashIcon className="size-3 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <FormInput
                        name={`items.${index}.description`}
                        reactform={form}
                        label="Description"
                        placeholder="e.g. Printer paper A4"
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <FormInput
                          name={`items.${index}.quantity`}
                          reactform={form}
                          label="Quantity"
                          placeholder="1"
                          type="number"
                        />
                        <FormInput
                          name={`items.${index}.unitPrice`}
                          reactform={form}
                          label="Unit Price"
                          placeholder="0.00"
                          type="number"
                        />
                      </div>

                      <div className="flex justify-end pt-1">
                        <span className="text-xs text-muted-foreground">
                          Subtotal:{" "}
                          <span className="font-medium text-foreground">
                            {form.watch("currency")}{" "}
                            {new Decimal(form.watch(`items.${index}.quantity`) ?? "0")
                              .times(new Decimal(form.watch(`items.${index}.unitPrice`) ?? "0"))
                              .toFixed(2)}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex justify-end rounded-lg bg-muted/50 p-3">
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <div className="text-lg font-semibold">
                      {form.watch("currency")} {total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContentContainer>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : isEditing ? "SaveIcon Changes" : "Add Bill"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function BillFormModal({ isOpen, onClose, bill }: BillFormModalProps) {
  return (
    <BillFormContent
      key={bill?.id ?? "new"}
      isOpen={isOpen}
      onClose={onClose}
      bill={bill}
    />
  );
}
