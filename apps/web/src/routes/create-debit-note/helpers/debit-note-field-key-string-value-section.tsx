import { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";
import { useFieldArray, UseFormReturn } from "react-hook-form";
import { FormInput } from "@/components/ui/form/form-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import React from "react";

interface DebitNoteFieldKeyStringValuesSectionProps {
  reactform: UseFormReturn<ZodCreateDebitNoteSchema>;
  name: "companyDetails.metadata" | "clientDetails.metadata";
  className?: string;
  label?: string | undefined;
  description?: string | undefined;
  isOptional?: boolean;
}

const DebitNoteFieldKeyStringValuesSection: React.FC<DebitNoteFieldKeyStringValuesSectionProps> = ({
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
      value: "",
    });
  };

  // Context-specific placeholders based on the field name
  const getPlaceholders = () => {
    if (name === "companyDetails.metadata") {
      return { label: "e.g. SSM No.", value: "e.g. 123456-X" };
    }
    if (name === "clientDetails.metadata") {
      return { label: "e.g. Contact Person", value: "e.g. Ahmad" };
    }
    return { label: "Label", value: "Value" };
  };

  const placeholders = getPlaceholders();

  return (
    <div className={cn(className, "flex flex-col gap-2")}>
      <div className="flex flex-col gap-0.5">
        <Label>{label ?? "Additional Details"}</Label>
        {description && <span className="text-muted-foreground text-xs">{description}</span>}
      </div>
      {fields.map((field, index) => (
        <div className="flex flex-row items-end gap-2" key={field.id}>
          <FormInput
            name={`${name}.${index}.label`}
            reactform={reactform}
            label="Name"
            placeholder={placeholders.label}
          />
          <FormInput
            name={`${name}.${index}.value`}
            reactform={reactform}
            label="Details"
            placeholder={placeholders.value}
          />
          <Button className="mb-0.5" variant="destructive" size="icon" onClick={() => remove(index)} type="button">
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button className="w-full border-dashed" variant="outline" onClick={addNewField} type="button">
        Add More
      </Button>
    </div>
  );
};

export default DebitNoteFieldKeyStringValuesSection;
