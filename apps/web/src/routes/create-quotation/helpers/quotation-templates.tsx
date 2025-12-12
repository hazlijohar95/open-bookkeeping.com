import type { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";
import type { PdfTemplateName } from "@/lib/invoice/create-pdf-blob";
import { FormSelect } from "@/components/ui/form/form-select";
import { SelectItem } from "@/components/ui/select";
import type { UseFormReturn } from "react-hook-form";
import { BoxIcon, SyncIcon, FileFeatherIcon } from "@/assets/icons";

interface PdfTemplate {
  name: PdfTemplateName;
  label: string;
  icon: React.ReactNode;
}

// Available Template Array for Quotations
export const availableQuotationTemplates: PdfTemplate[] = [
  {
    name: "default",
    label: "Default",
    icon: <BoxIcon className="size-4" />,
  },
  {
    name: "cynco",
    label: "Cynco",
    icon: <SyncIcon className="size-4" />,
  },
  {
    name: "classic",
    label: "Classic",
    icon: <FileFeatherIcon className="size-4" />,
  },
];

export const QuotationTemplateSelector = ({ form }: { form: UseFormReturn<ZodCreateQuotationSchema> }) => {
  return (
    <FormSelect
      name="quotationDetails.theme.template"
      reactform={form}
      defaultValue="default"
      placeholder="Select template"
      className="min-w-34"
    >
      {availableQuotationTemplates.map((template) => {
        // if the template is undefined, don't render it
        if (!template.name) return null;

        return (
          <SelectItem key={template.name} value={template.name}>
            <div className="flex flex-row items-center gap-2">{template.icon}</div>
            <span>{template.label}</span>
          </SelectItem>
        );
      })}
    </FormSelect>
  );
};
