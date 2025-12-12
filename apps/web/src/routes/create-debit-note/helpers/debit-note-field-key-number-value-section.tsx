import type { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { FormSelect } from "@/components/ui/form/form-select";
import { FormInput } from "@/components/ui/form/form-input";
import { SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import React from "react";

interface DebitNoteFieldKeyNumberValuesSectionProps {
  reactform: UseFormReturn<ZodCreateDebitNoteSchema>;
  name: "debitNoteDetails.billingDetails";
  className?: string;
  label?: string | undefined;
  description?: string | undefined;
  isOptional?: boolean;
}

const DebitNoteFieldKeyNumberValuesSection: React.FC<DebitNoteFieldKeyNumberValuesSectionProps> = ({
  reactform,
  name,
  className,
  label,
  description,
}) => {
  const { fields, append, remove } = useFieldArray({
    control: reactform.control,
    name,
  });

  const addNewField = () => {
    append({
      label: "",
      value: 0,
      type: "percentage",
    });
  };

  return (
    <div className={cn(className, "flex flex-col gap-2")}>
      <div className="flex flex-col gap-0.5">
        <Label>{label ?? "Taxes & Adjustments"}</Label>
        {description && <span className="text-muted-foreground text-xs">{description}</span>}
      </div>
      {fields.map((field, index) => (
        <div className="flex flex-col items-center gap-2 sm:flex-row" key={field.id}>
          <div className="flex w-full flex-row gap-2 sm:w-2/3">
            <FormInput
              name={`${name}.${index}.label`}
              reactform={reactform}
              label="Name"
              isOptional={true}
              placeholder="e.g. SST, Adjustment"
            />
            <FormSelect name={`${name}.${index}.type`} reactform={reactform} label="Type" placeholder="Type">
              <SelectItem value="percentage">% Percent</SelectItem>
              <SelectItem value="fixed">RM Fixed</SelectItem>
            </FormSelect>
          </div>
          <div className="flex w-full flex-row items-end gap-2 sm:w-1/3">
            <FormInput
              type="number"
              name={`${name}.${index}.value`}
              reactform={reactform}
              label="Amount"
              placeholder="e.g. 6"
            />
            <Button variant="destructive" size="icon" onClick={() => remove(index)} type="button">
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button className="w-full border-dashed" variant="outline" onClick={addNewField} type="button">
        Add Tax or Adjustment
      </Button>
    </div>
  );
};

export default DebitNoteFieldKeyNumberValuesSection;
