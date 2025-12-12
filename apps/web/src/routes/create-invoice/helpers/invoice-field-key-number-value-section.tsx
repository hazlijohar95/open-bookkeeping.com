import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { FormSelect } from "@/components/ui/form/form-select";
import { FormInput } from "@/components/ui/form/form-input";
import { SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2Icon, Receipt } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import React from "react";
import type { SstTaxType } from "@/zod-schemas/common";

// SST Rate presets for Malaysian Sales and Service Tax
const SST_PRESETS = [
  { code: "ST_10", label: "Sales Tax 10%", rate: 10, taxType: "sales_tax" as SstTaxType },
  { code: "ST_5", label: "Sales Tax 5%", rate: 5, taxType: "sales_tax" as SstTaxType },
  { code: "ST_0", label: "Sales Tax 0%", rate: 0, taxType: "sales_tax" as SstTaxType },
  { code: "SVT_6", label: "Service Tax 6%", rate: 6, taxType: "service_tax" as SstTaxType },
  { code: "SVT_8", label: "Service Tax 8%", rate: 8, taxType: "service_tax" as SstTaxType },
];

interface InvoiceFieldKeyNumberValuesSectionProps {
  reactform: UseFormReturn<ZodCreateInvoiceSchema>;
  name: "invoiceDetails.billingDetails";
  className?: string;
  label?: string | undefined;
  description?: string | undefined;
  isOptional?: boolean;
}

const InvoiceFieldKeyNumberValuesSection: React.FC<InvoiceFieldKeyNumberValuesSectionProps> = ({
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

  const addSstPreset = (preset: (typeof SST_PRESETS)[number]) => {
    append({
      label: preset.label,
      value: preset.rate,
      type: "percentage",
      isSstTax: true,
      sstTaxType: preset.taxType,
      sstRateCode: preset.code,
    });
  };

  return (
    <div className={cn(className, "flex flex-col gap-2")}>
      <div className="flex flex-col gap-0.5">
        <Label>{label ?? "Taxes & Discounts"}</Label>
        {description && <span className="text-muted-foreground text-xs">{description}</span>}
      </div>
      {fields.map((field, index) => {
        const isSst = reactform.watch(`${name}.${index}.isSstTax`);
        return (
          <div className="flex flex-col items-center gap-2 sm:flex-row" key={field.id}>
            <div className="flex w-full flex-row gap-2 sm:w-2/3">
              <FormInput
                name={`${name}.${index}.label`}
                reactform={reactform}
                label="Name"
                isOptional={true}
                placeholder="e.g. SST, Discount"
                disabled={isSst}
              />
              <FormSelect
                name={`${name}.${index}.type`}
                reactform={reactform}
                label="Type"
                placeholder="Type"
                disabled={isSst}
              >
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
                disabled={isSst}
              />
              <Button variant="destructive" size="icon" onClick={() => remove(index)} type="button">
                <Trash2Icon className="size-4" />
              </Button>
            </div>
            {isSst && (
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                <Receipt className="size-3" />
                <span>SST</span>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1 border-dashed" variant="outline" onClick={addNewField} type="button">
          Add Tax or Discount
        </Button>
        <div className="flex flex-wrap gap-1">
          {SST_PRESETS.map((preset) => (
            <Button
              key={preset.code}
              variant="secondary"
              size="sm"
              onClick={() => addSstPreset(preset)}
              type="button"
              className="text-xs"
            >
              <Receipt className="mr-1 size-3" />
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InvoiceFieldKeyNumberValuesSection;
