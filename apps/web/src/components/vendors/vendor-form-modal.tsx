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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { createVendorSchema, CreateVendorSchema } from "@/zod-schemas/vendor";
import { useFieldArray, useForm } from "react-hook-form";
import { TruckIcon, FilePenIcon, TrashIcon } from "@/assets/icons";
import { FormInput } from "@/components/ui/form/form-input";
import { zodResolver } from "@/lib/utils";
import { Form } from "@/components/ui/form/form";
import { Vendor } from "@/types/common/vendor";
import { Button } from "@/components/ui/button";
import { useCreateVendor, useUpdateVendor } from "@/api";
import { Building2, Receipt, CreditCard, User } from "@/components/ui/icons";
import { toast } from "sonner";

interface VendorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor?: Vendor | null;
}

const emptyDefaults: CreateVendorSchema = {
  name: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  bankName: "",
  bankAccountNumber: "",
  bankRoutingNumber: "",
  bankSwiftCode: "",
  taxId: "",
  vatNumber: "",
  registrationNumber: "",
  paymentTermsDays: "",
  preferredPaymentMethod: "",
  creditLimit: "",
  metadata: [],
};

// Inner component that gets remounted via key prop when vendor changes
function VendorFormContent({ isOpen, onClose, vendor }: VendorFormModalProps) {
  const isEditing = !!vendor;

  // Form initializes with correct values - no useEffect needed for reset
  const form = useForm<CreateVendorSchema>({
    resolver: zodResolver(createVendorSchema),
    defaultValues: vendor
      ? {
          name: vendor.name,
          email: vendor.email || "",
          phone: vendor.phone || "",
          address: vendor.address || "",
          website: vendor.website || "",
          bankName: vendor.bankName || "",
          bankAccountNumber: vendor.bankAccountNumber || "",
          bankRoutingNumber: vendor.bankRoutingNumber || "",
          bankSwiftCode: vendor.bankSwiftCode || "",
          taxId: vendor.taxId || "",
          vatNumber: vendor.vatNumber || "",
          registrationNumber: vendor.registrationNumber || "",
          paymentTermsDays: vendor.paymentTermsDays ?? "",
          preferredPaymentMethod: vendor.preferredPaymentMethod || "",
          creditLimit: vendor.creditLimit || "",
          metadata: vendor.metadata?.map((m) => ({ label: m.label, value: m.value })) || [],
        }
      : emptyDefaults,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "metadata",
  });

  const createMutation = useCreateVendor();
  const updateMutation = useUpdateVendor();

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = (data: CreateVendorSchema) => {
    // Clean up empty optional fields
    const cleanedData = {
      ...data,
      paymentTermsDays: data.paymentTermsDays === "" ? undefined : Number(data.paymentTermsDays),
    };

    if (isEditing && vendor) {
      updateMutation.mutate(
        { id: vendor.id, ...cleanedData },
        {
          onSuccess: () => {
            toast.success("Vendor updated successfully");
            handleClose();
          },
          onError: (error) => {
            toast.error(error.message);
          },
        }
      );
    } else {
      createMutation.mutate(cleanedData, {
        onSuccess: () => {
          toast.success("Vendor created successfully");
          handleClose();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeaderContainer>
              <DialogIcon>
                {isEditing ? <FilePenIcon /> : <TruckIcon />}
              </DialogIcon>
              <DialogHeader>
                <DialogTitle>{isEditing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? "Update the vendor/supplier details below."
                    : "Fill in the details to add a new vendor/supplier."}
                </DialogDescription>
              </DialogHeader>
            </DialogHeaderContainer>
            <DialogContentContainer>
              <Accordion type="multiple" defaultValue={["basic"]} className="w-full">
                {/* Basic Information */}
                <AccordionItem value="basic">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <User className="size-4" />
                      <span>Basic Information</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <FormInput
                      label="Name"
                      name="name"
                      placeholder="e.g. Supplier Inc."
                      reactform={form}
                      description="Vendor or supplier name"
                    />
                    <FormInput
                      label="Email"
                      name="email"
                      type="email"
                      placeholder="e.g. contact@supplier.com"
                      reactform={form}
                      isOptional
                      description="Vendor email address"
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormInput
                        label="Phone"
                        name="phone"
                        placeholder="e.g. +60 12-345 6789"
                        reactform={form}
                        isOptional
                      />
                      <FormInput
                        label="Website"
                        name="website"
                        placeholder="e.g. https://supplier.com"
                        reactform={form}
                        isOptional
                      />
                    </div>
                    <FormInput
                      label="Address"
                      name="address"
                      placeholder="e.g. 123 Industrial Park, Kuala Lumpur"
                      reactform={form}
                      isOptional
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* Bank Details */}
                <AccordionItem value="bank">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4" />
                      <span>Bank Details</span>
                      <span className="text-muted-foreground text-xs">(Optional)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <FormInput
                      label="Bank Name"
                      name="bankName"
                      placeholder="e.g. Maybank"
                      reactform={form}
                      isOptional
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormInput
                        label="Account Number"
                        name="bankAccountNumber"
                        placeholder="e.g. 1234567890"
                        reactform={form}
                        isOptional
                      />
                      <FormInput
                        label="Routing Number"
                        name="bankRoutingNumber"
                        placeholder="e.g. 123456789"
                        reactform={form}
                        isOptional
                      />
                    </div>
                    <FormInput
                      label="SWIFT Code"
                      name="bankSwiftCode"
                      placeholder="e.g. MABORKLXXX"
                      reactform={form}
                      isOptional
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* Tax Information */}
                <AccordionItem value="tax">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Receipt className="size-4" />
                      <span>Tax Information</span>
                      <span className="text-muted-foreground text-xs">(Optional)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormInput
                        label="Tax ID"
                        name="taxId"
                        placeholder="e.g. 12-3456789"
                        reactform={form}
                        isOptional
                      />
                      <FormInput
                        label="VAT Number"
                        name="vatNumber"
                        placeholder="e.g. MY123456789"
                        reactform={form}
                        isOptional
                      />
                    </div>
                    <FormInput
                      label="Registration Number"
                      name="registrationNumber"
                      placeholder="e.g. 123456-X"
                      reactform={form}
                      isOptional
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* Payment Terms */}
                <AccordionItem value="payment">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4" />
                      <span>Payment Terms</span>
                      <span className="text-muted-foreground text-xs">(Optional)</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormInput
                        label="Payment Terms (Days)"
                        name="paymentTermsDays"
                        type="number"
                        placeholder="e.g. 30"
                        reactform={form}
                        isOptional
                        description="Net payment days"
                      />
                      <FormInput
                        label="Preferred Payment Method"
                        name="preferredPaymentMethod"
                        placeholder="e.g. Bank Transfer"
                        reactform={form}
                        isOptional
                      />
                    </div>
                    <FormInput
                      label="Credit Limit"
                      name="creditLimit"
                      placeholder="e.g. 50000.00"
                      reactform={form}
                      isOptional
                      description="Maximum credit amount"
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Custom Metadata */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="text-sm font-medium">Additional Details</label>
                  <span className="text-muted-foreground text-xs">
                    Add custom fields for this vendor
                  </span>
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex flex-row items-end gap-2">
                    <FormInput
                      name={`metadata.${index}.label`}
                      reactform={form}
                      label="Label"
                      placeholder="e.g. Contact Person"
                    />
                    <FormInput
                      name={`metadata.${index}.value`}
                      reactform={form}
                      label="Value"
                      placeholder="e.g. John Doe"
                    />
                    <Button
                      className="mb-0.5"
                      variant="destructive"
                      size="icon"
                      type="button"
                      onClick={() => remove(index)}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  className="w-full border-dashed"
                  variant="outline"
                  type="button"
                  onClick={() => append({ label: "", value: "" })}
                >
                  Add More
                </Button>
              </div>
            </DialogContentContainer>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isLoading}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Add Vendor"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Wrapper that uses key prop to reset form state when vendor changes
export function VendorFormModal({ isOpen, onClose, vendor }: VendorFormModalProps) {
  return (
    <VendorFormContent
      key={vendor?.id ?? "new"}
      isOpen={isOpen}
      onClose={onClose}
      vendor={vendor}
    />
  );
}
