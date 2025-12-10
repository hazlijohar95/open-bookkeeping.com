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
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCreditNoteItemSchema, ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";
import { useFieldArray, useForm, UseFormReturn } from "react-hook-form";
import { BoxPlusIcon, FilePenIcon, BoxIcon, TrashIcon } from "@/assets/icons";
import { FormInput } from "@/components/ui/form/form-input";
import { formatCurrencyText } from "@/constants/currency";
import { zodResolver } from "@/lib/utils";
import { Form } from "@/components/ui/form/form";
import { Button } from "@/components/ui/button";
import { Plus } from "@/components/ui/icons";
import React, { useState } from "react";

interface CreditNoteItemsSectionProps {
  form: UseFormReturn<ZodCreateCreditNoteSchema>;
}
type CreditNoteItem = ZodCreateCreditNoteSchema["items"][number];

const CreditNoteItemsSection: React.FC<CreditNoteItemsSectionProps> = ({ form }) => {
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "items",
  });

  return (
    <div className="flex flex-col gap-2">
      {fields.length > 0 && (
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <div className="bg-muted/50 flex w-full flex-row justify-between gap-2 rounded-md p-3" key={field.id}>
              <div className="flex w-full flex-row gap-2">
                <div className="bg-muted-foreground/20 grid aspect-square h-full place-items-center rounded-md">
                  <BoxIcon className="size-4" />
                </div>
                <div className="w-full">
                  <div className="line-clamp-1 text-sm font-medium">{field.name}</div>
                  <div className="text-muted-foreground line-clamp-1 text-xs">{field.description}</div>
                  <div className="text-primary text-[10px] font-medium">
                    {formatCurrencyText(form.watch("creditNoteDetails.currency"), field.unitPrice)}{" "}
                    <span className="text-muted-foreground">x {field.quantity} Qty</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-row gap-2">
                <div className="flex flex-col items-end justify-between gap-1">
                  <div className="flex flex-row gap-1.5">
                    <HandleItemModal type="edit" append={append} update={update} editingIndex={index} data={field}>
                      <Button
                        type="button"
                        className="text-muted-foreground h-5.5 w-5.5 rounded"
                        variant="ghost"
                        size="icon"
                      >
                        <FilePenIcon className="size-3" />
                      </Button>
                    </HandleItemModal>
                    <Button
                      className="h-5.5 w-5.5 rounded"
                      variant="destructive"
                      size="icon"
                      onClick={() => remove(index)}
                    >
                      <TrashIcon className="size-3" />
                    </Button>
                  </div>
                  <div className="flex flex-row items-center gap-1">
                    <p className="space-x-1 text-[10px] whitespace-nowrap">
                      <span>Total:</span>
                      <span>
                        {formatCurrencyText(form.watch("creditNoteDetails.currency"), field.unitPrice * field.quantity)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <HandleItemModal type="add" append={append} update={update}>
        <Button type="button" className="w-full border-dashed" variant="outline">
          <Plus className="size-4" />
          Add Credit Item
        </Button>
      </HandleItemModal>
    </div>
  );
};

export default CreditNoteItemsSection;

interface AddItemModalProps {
  type: "add" | "edit";
  children: React.ReactNode;
  data?: CreditNoteItem;
  editingIndex?: number | null;
  append: (data: CreditNoteItem) => void;
  update: (index: number, data: CreditNoteItem) => void;
}

const HandleItemModal = ({ type, append, update, editingIndex, data, children }: AddItemModalProps) => {
  const [open, setOpen] = useState(false);

  const creditNoteItemForm = useForm<CreditNoteItem>({
    resolver: zodResolver(createCreditNoteItemSchema),
    defaultValues: {
      name: data?.name || "",
      description: data?.description || "",
      quantity: data?.quantity || 1,
      unitPrice: data?.unitPrice || 1,
    },
  });

  const onHandleSubmit = (data: CreditNoteItem) => {
    if (type === "edit" && typeof editingIndex === "number") {
      update(editingIndex, data);
    } else {
      append(data);
    }
    creditNoteItemForm.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...creditNoteItemForm}>
          <form onSubmit={creditNoteItemForm.handleSubmit(onHandleSubmit)}>
            <DialogHeaderContainer>
              <DialogIcon>
                {type === "edit" ? <FilePenIcon /> : <BoxPlusIcon />}
              </DialogIcon>
              <DialogHeader>
                <DialogTitle>{type === "add" ? "Add Credit Item" : "Edit Item"}</DialogTitle>
                <DialogDescription>
                  {type === "add" ? "Add a credit item to your note" : "Update the item details below"}
                </DialogDescription>
              </DialogHeader>
            </DialogHeaderContainer>

            <DialogContentContainer>
              <FormInput
                label="Name"
                name="name"
                placeholder="e.g. Product Return, Service Adjustment"
                reactform={creditNoteItemForm}
              />
              <FormInput
                label="Description"
                name="description"
                placeholder="e.g. Returned item - defective"
                reactform={creditNoteItemForm}
                isOptional={true}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput
                  type="number"
                  label="Quantity"
                  name="quantity"
                  placeholder="1"
                  reactform={creditNoteItemForm}
                />
                <FormInput
                  type="number"
                  label="Unit Price"
                  name="unitPrice"
                  placeholder="100"
                  reactform={creditNoteItemForm}
                />
              </div>
            </DialogContentContainer>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">{type === "add" ? "Add Item" : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
