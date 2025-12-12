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
import type { CreateCustomerSchema } from "@/zod-schemas/customer";
import { createCustomerSchema } from "@/zod-schemas/customer";
import { useFieldArray, useForm } from "react-hook-form";
import { UsersIcon, FilePenIcon, TrashIcon } from "@/assets/icons";
import { FormInput } from "@/components/ui/form/form-input";
import { zodResolver } from "@/lib/utils";
import { Form } from "@/components/ui/form/form";
import type { Customer } from "@/types/common/customer";
import { Button } from "@/components/ui/button";
import { useCreateCustomer, useUpdateCustomer } from "@/api";
import { toast } from "sonner";

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
}

// Extract form logic to inner component that gets remounted via key prop
function CustomerFormContent({
  customer,
  onClose,
  isOpen
}: CustomerFormModalProps) {
  const isEditing = !!customer;

  // Form initializes with correct values - no useEffect needed for reset
  // When customer changes, parent remounts this component with new key
  const form = useForm<CreateCustomerSchema>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: customer
      ? {
          name: customer.name,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          address: customer.address ?? "",
          metadata: customer.metadata?.map((m) => ({ label: m.label, value: m.value })) ?? [],
        }
      : {
          name: "",
          email: "",
          phone: "",
          address: "",
          metadata: [],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "metadata",
  });

  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = (data: CreateCustomerSchema) => {
    if (isEditing && customer) {
      updateMutation.mutate(
        { id: customer.id, ...data },
        {
          onSuccess: () => {
            toast.success("Customer updated successfully");
            handleClose();
          },
          onError: (error) => {
            toast.error(error.message);
          },
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => {
          toast.success("Customer created successfully");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeaderContainer>
              <DialogIcon>
                {isEditing ? <FilePenIcon /> : <UsersIcon />}
              </DialogIcon>
              <DialogHeader>
                <DialogTitle>{isEditing ? "Edit Customer" : "Add Customer"}</DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? "Update the customer details below."
                    : "Fill in the details to add a new customer."}
                </DialogDescription>
              </DialogHeader>
            </DialogHeaderContainer>
            <DialogContentContainer>
              <FormInput
                label="Name"
                name="name"
                placeholder="e.g. Acme Corporation"
                reactform={form}
                description="Customer or company name"
              />
              <FormInput
                label="Email"
                name="email"
                type="email"
                placeholder="e.g. contact@acme.com"
                reactform={form}
                isOptional
                description="Customer email address"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput
                  label="Phone"
                  name="phone"
                  placeholder="e.g. +60 12-345 6789"
                  reactform={form}
                  isOptional
                  description="Contact number"
                />
              </div>
              <FormInput
                label="Address"
                name="address"
                placeholder="e.g. 123 Main Street, Kuala Lumpur"
                reactform={form}
                isOptional
                description="Billing or mailing address"
              />

              {/* Custom Metadata */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="text-sm font-medium">Additional Details</label>
                  <span className="text-muted-foreground text-xs">
                    Add custom fields for this customer
                  </span>
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex flex-row items-end gap-2">
                    <FormInput
                      name={`metadata.${index}.label`}
                      reactform={form}
                      label="Label"
                      placeholder="e.g. SSM No."
                    />
                    <FormInput
                      name={`metadata.${index}.value`}
                      reactform={form}
                      label="Value"
                      placeholder="e.g. 123456-X"
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
                {isLoading ? "Saving..." : isEditing ? "SaveIcon Changes" : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Wrapper that uses key prop to reset form state when customer changes
// This avoids the useEffect anti-pattern for resetting state on prop change
export function CustomerFormModal({ isOpen, onClose, customer }: CustomerFormModalProps) {
  // Using customer?.id as key - when it changes, the form content remounts with fresh state
  // "new" is used for creating new customers to distinguish from editing
  return (
    <CustomerFormContent
      key={customer?.id ?? "new"}
      isOpen={isOpen}
      onClose={onClose}
      customer={customer}
    />
  );
}
