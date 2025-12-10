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
import { createQuotationItemSchema, ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";
import { useFieldArray, useForm, UseFormReturn } from "react-hook-form";
import { BoxPlusIcon, FilePenIcon, BoxIcon, TrashIcon } from "@/assets/icons";
import { FormInput } from "@/components/ui/form/form-input";
import { formatCurrencyText } from "@/constants/currency";
import { zodResolver } from "@/lib/utils";
import { Form } from "@/components/ui/form/form";
import { Button } from "@/components/ui/button";
import { Plus } from "@/components/ui/icons";
import React, { useState } from "react";

interface QuotationItemsSectionProps {
  form: UseFormReturn<ZodCreateQuotationSchema>;
}
type QuotationItem = ZodCreateQuotationSchema["items"][number];

const QuotationItemsSection: React.FC<QuotationItemsSectionProps> = ({ form }) => {
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "items",
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Rendering the items */}
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
                    {formatCurrencyText(form.watch("quotationDetails.currency"), field.unitPrice)}{" "}
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
                        {formatCurrencyText(form.watch("quotationDetails.currency"), field.unitPrice * field.quantity)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Dialog for adding a new item */}
      <HandleItemModal type="add" append={append} update={update}>
        <Button type="button" className="w-full border-dashed" variant="outline">
          <Plus className="size-4" />
          Add Product or Service
        </Button>
      </HandleItemModal>
    </div>
  );
};

export default QuotationItemsSection;

interface AddItemModalProps {
  type: "add" | "edit";
  children: React.ReactNode;
  data?: QuotationItem;
  editingIndex?: number | null;
  append: (data: QuotationItem) => void;
  update: (index: number, data: QuotationItem) => void;
}

const HandleItemModal = ({ type, append, update, editingIndex, data, children }: AddItemModalProps) => {
  const [open, setOpen] = useState(false);

  const quotationItemForm = useForm<QuotationItem>({
    resolver: zodResolver(createQuotationItemSchema),
    defaultValues: {
      name: data?.name || "",
      description: data?.description || "",
      quantity: data?.quantity || 1,
      unitPrice: data?.unitPrice || 1,
    },
  });

  const onHandleSubmit = (data: QuotationItem) => {
    if (type === "edit" && typeof editingIndex === "number") {
      update(editingIndex, data);
    } else {
      append(data);
    }

    // Clean up the form
    quotationItemForm.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...quotationItemForm}>
          <form onSubmit={quotationItemForm.handleSubmit(onHandleSubmit)}>
            <DialogHeaderContainer>
              <DialogIcon>
                {type === "edit" ? <FilePenIcon /> : <BoxPlusIcon />}
              </DialogIcon>
              <DialogHeader>
                <DialogTitle>{type === "add" ? "Add Product or Service" : "Edit Item"}</DialogTitle>
                <DialogDescription>
                  {type === "add" ? "Add a billable item to your quotation" : "Update the item details below"}
                </DialogDescription>
              </DialogHeader>
            </DialogHeaderContainer>

            <DialogContentContainer>
              <FormInput
                label="Name"
                name="name"
                placeholder="e.g. Website Development, Consulting"
                reactform={quotationItemForm}
              />
              <FormInput
                label="Description"
                name="description"
                placeholder="e.g. 10-page responsive website with CMS"
                reactform={quotationItemForm}
                isOptional={true}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput
                  type="number"
                  label="Quantity"
                  name="quantity"
                  placeholder="1"
                  reactform={quotationItemForm}
                />
                <FormInput
                  type="number"
                  label="Unit Price"
                  name="unitPrice"
                  placeholder="1000"
                  reactform={quotationItemForm}
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
